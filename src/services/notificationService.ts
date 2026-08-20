import { getToken } from "firebase/messaging";
import { messaging, vapidKey } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { deviceService } from "./deviceService";
import { supabase } from "@/db/client";

export async function requestNotificationPermission(): Promise<string | null> {
  console.log("Notification service started");

  if (typeof window === "undefined") {
    console.warn("[Notification Service] Running on server-side, skipping registration");
    return null;
  }

  // 1. Native Capacitor Platform Handling (Android / iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      console.log("[Notification Service] Initializing Native Mobile Notifications...");

      if (Capacitor.getPlatform() === "android") {
        await LocalNotifications.createChannel({
          id: "default",
          name: "Default Notifications",
          description: "Health alerts and updates",
          importance: 4,
          visibility: 1,
          vibration: true,
        }).catch((e) => console.warn("[Native Channel] Failed to create default channel:", e));
      }

      await LocalNotifications.requestPermissions();
      const pushPerm = await PushNotifications.requestPermissions();

      if (pushPerm.receive !== "granted") {
        console.warn("[Notification Service] Push notification permission denied on native device.");
        return null;
      }

      return new Promise<string | null>((resolve) => {
        let resolved = false;

        PushNotifications.addListener("registration", async (token) => {
          console.log("[Native Push] Token registered successfully:", token.value);
          await deviceService.setCurrentDeviceToken(token.value);
          if (!resolved) {
            resolved = true;
            resolve(token.value);
          }
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("[Native Push] Registration error:", err);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("[Native Push Received in Foreground]:", notification);
          showLocalNotification(
            notification.title || "GlucoLab Update",
            notification.body || "A new update was recorded on your account.",
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("health-data-updated"));
          }
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("[Native Push Action Clicked]:", action);
          const data = action.notification?.data;
          const targetAction = data?.action || "open_dashboard";
          handleNotificationNavigation(targetAction);
        });

        PushNotifications.register().catch((e) => {
          console.error("[Native Push] PushNotifications.register failed:", e);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.warn("[Native Push] Token registration timed out.");
            resolve(null);
          }
        }, 10000);
      });
    } catch (err) {
      console.error("[Notification Service] Native setup error:", err);
      return null;
    }
  }

  // 2. Web Browser Handling
  if (!("Notification" in window)) {
    console.error("[Notification Service] This browser does not support desktop notifications.");
    return null;
  }

  if (!("serviceWorker" in navigator)) {
    console.error("[Notification Service] Service Workers are not supported in this browser.");
    return null;
  }

  if (!("PushManager" in window)) {
    console.error("[Notification Service] Push messaging is not supported in this browser.");
    return null;
  }

  if (
    window.location.protocol !== "https:" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    console.error(
      "[Notification Service] Notifications require a secure context (HTTPS or localhost).",
    );
    return null;
  }

  try {
    console.log("[Notification Service] Requesting web notification permission...");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn(`[Notification Service] Notification permission denied/ignored: ${permission}`);
      return null;
    }
    console.log("Permission granted");

    console.log("[Notification Service] Registering Service Worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    console.log("[Notification Service] Service Worker registered successfully:", registration);

    if (!messaging) {
      console.error("[Notification Service] Firebase messaging client is not initialized.");
      return null;
    }

    console.log("[Notification Service] Retrieving FCM Token...");
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("FCM Token:", token);
      await deviceService.setCurrentDeviceToken(token);
      return token;
    } else {
      console.warn("[Notification Service] No registration token available.");
      return null;
    }
  } catch (error) {
    console.error("[Notification Service] Error during notification setup:", error);
    return null;
  }
}

/**
 * Navigate to target screen when a notification action is tapped
 */
export function handleNotificationNavigation(action: string) {
  if (typeof window === "undefined") return;

  switch (action) {
    case "open_reports":
      window.location.hash = "/reports";
      break;
    case "open_history":
      window.location.hash = "/history";
      break;
    case "open_scanner":
      window.location.hash = "/dashboard";
      break;
    case "open_dashboard":
    default:
      window.location.hash = "/dashboard";
      break;
  }
}

export async function showLocalNotification(title: string, body: string) {
  if (typeof window === "undefined") return;

  // 1. Native Capacitor Platform
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 100000) + 1,
            schedule: { at: new Date(Date.now() + 100) },
            channelId: "default",
          },
        ],
      });
      console.log("[LocalNotifications] Scheduled native notification:", title);
    } catch (e) {
      console.error("[LocalNotifications] Failed to schedule native notification:", e);
    }
    return;
  }

  // 2. Web Browser Fallback
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body: body,
            icon: "/logo.png",
          });
        })
        .catch((err) => {
          console.error("Service worker not ready for notification:", err);
          try {
            new Notification(title, { body, icon: "/logo.png" });
          } catch (e) {
            console.error("Failed to show legacy notification fallback:", e);
          }
        });
    } else {
      try {
        new Notification(title, { body, icon: "/logo.png" });
      } catch (e) {
        console.error("Failed to show legacy notification:", e);
      }
    }
  }
}

/**
 * Trigger background multi-device push notification via backend API.
 * Automatically attaches authentication Bearer token and sourceDeviceToken to exclude the originating device.
 */
export async function triggerPushNotification(
  userId: string,
  title: string,
  body: string,
  dataPayload?: Record<string, string>,
) {
  if (typeof window === "undefined") return;

  try {
    const sourceToken = deviceService.getCachedDeviceToken() || (await deviceService.getCurrentDeviceToken());
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    const res = await fetch("/api/send-push", {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId,
        title,
        body,
        excludeDeviceToken: sourceToken || undefined,
        data: dataPayload,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn("[NotificationService] Background push notification response:", errData);
    } else {
      const resData = await res.json().catch(() => ({}));
      console.log("[NotificationService] Push notification successfully queued/sent:", resData);
    }
  } catch (err) {
    console.error("[NotificationService] Non-blocking push notification error:", err);
  }
}

/**
 * Dispatch action-specific notification:
 * 1. Immediate local in-app feedback on current device
 * 2. Privacy-preserving push notification to other user devices (source excluded)
 */
export async function notifyReadingAction(
  userId: string,
  localTitle: string,
  localBody: string,
  pushTitle: string,
  pushBody: string,
  dataPayload?: Record<string, string>,
) {
  // Show local in-app alert on the originating device
  showLocalNotification(localTitle, localBody);

  // Send privacy-preserving push to all other active devices belonging to the account
  triggerPushNotification(userId, pushTitle, pushBody, dataPayload).catch((e) =>
    console.error("[NotificationService] Failed to trigger background multi-device push:", e),
  );
}

export async function notifyGlucoseAdded(userId: string, glucose: number, typeLabel: string) {
  let lowTarget = 70;
  let highTarget = 180;

  if (typeof window !== "undefined") {
    try {
      const savedTargets = localStorage.getItem(`glucolab_targets_${userId}`);
      if (savedTargets) {
        const parsed = JSON.parse(savedTargets);
        if (parsed.lowTarget) lowTarget = Number(parsed.lowTarget) || 70;
        if (parsed.highTarget) highTarget = Number(parsed.highTarget) || 180;
      }
    } catch (e) {
      console.warn("Could not parse saved target levels:", e);
    }
  }

  // Local notification copy (on current device)
  let localTitle = `🩸 Glucose Reading: ${glucose} mg/dL`;
  let localBody = `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was recorded.`;

  if (glucose < lowTarget) {
    localTitle = `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
    localBody = `URGENT: Blood sugar level of ${glucose} mg/dL (${typeLabel}) is dangerously LOW (< ${lowTarget} mg/dL). Please consume 15g of fast-acting sugar immediately!`;
  } else if (glucose > highTarget) {
    localTitle = `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
    localBody = `WARNING: Blood sugar level of ${glucose} mg/dL (${typeLabel}) exceeds high target (${highTarget} mg/dL). Consider checking your insulin dose or drinking water.`;
  }

  // Non-sensitive privacy-compliant copy (for remote multi-device push)
  const pushTitle = "GlucoLab Update";
  const pushBody = "A new blood glucose reading was recorded on your account.";
  const dataPayload = {
    type: "glucose_entry",
    action: "open_dashboard",
  };

  await notifyReadingAction(userId, localTitle, localBody, pushTitle, pushBody, dataPayload);
}

export async function notifyInsulinAdded(
  userId: string,
  scheduleStr: string,
  totalUnits: number,
  entryDate: string,
) {
  const localTitle = "💉 New Insulin Dosage Logged";
  const localBody = `Insulin schedule (${scheduleStr} - total ${totalUnits} units) recorded for ${entryDate}.`;

  const pushTitle = "GlucoLab Update";
  const pushBody = "A new insulin dosage was logged to your account.";
  const dataPayload = {
    type: "insulin_entry",
    action: "open_dashboard",
  };

  await notifyReadingAction(userId, localTitle, localBody, pushTitle, pushBody, dataPayload);
}

export async function notifyWeightAdded(userId: string, weightKg: number, entryDate: string) {
  const localTitle = "⚖️ New Weight Reading Logged";
  const localBody = `Weight entry of ${weightKg} kg was recorded for ${entryDate}.`;

  const pushTitle = "GlucoLab Update";
  const pushBody = "A new weight entry was logged to your account.";
  const dataPayload = {
    type: "weight_entry",
    action: "open_dashboard",
  };

  await notifyReadingAction(userId, localTitle, localBody, pushTitle, pushBody, dataPayload);
}

export async function notifyScanReadingAdded(userId: string, deviceType: string, data: any) {
  let localTitle = `📷 New ${deviceType} Scan Saved`;
  let localBody = `A new ${deviceType} reading was scanned and saved.`;

  if (deviceType === "Blood Glucose Meter" && data.glucose !== undefined) {
    localTitle = "🩸 Scanned Glucose Reading Saved";
    localBody = `Smart Scan Glucose: ${data.glucose} ${data.unit || "mg/dL"} (${data.glucose_reading_type || "Fasting"}).`;
  } else if (deviceType === "Blood Pressure Monitor" && data.systolic !== undefined) {
    localTitle = "🫀 Scanned Blood Pressure Reading Saved";
    localBody = `Smart Scan BP: ${data.systolic}/${data.diastolic} mmHg${data.pulse ? ` (Pulse: ${data.pulse} bpm)` : ""}.`;
  } else if (deviceType === "Pulse Oximeter" && data.spo2 !== undefined) {
    localTitle = "🫁 Scanned SpO₂ Reading Saved";
    localBody = `Smart Scan SpO₂: ${data.spo2}%${data.pulse ? ` (Pulse: ${data.pulse} bpm)` : ""}.`;
  } else if (deviceType === "Thermometer" && data.temperature !== undefined) {
    localTitle = "🌡️ Scanned Temperature Reading Saved";
    localBody = `Smart Scan Temperature: ${data.temperature} ${data.unit || "°C"}.`;
  } else if (deviceType === "Weight Scale" && data.weight !== undefined) {
    localTitle = "⚖️ Scanned Weight Reading Saved";
    localBody = `Smart Scan Weight: ${data.weight} ${data.unit || "kg"}.`;
  }

  const pushTitle = "GlucoLab Update";
  const pushBody = `A new ${deviceType} reading was scanned and saved to your account.`;
  const dataPayload = {
    type: "scan_reading",
    action: "open_dashboard",
  };

  await notifyReadingAction(userId, localTitle, localBody, pushTitle, pushBody, dataPayload);
}

export async function notifyReportUploaded(userId: string, reportName?: string) {
  const localTitle = "📊 Report Export Generated";
  const localBody = reportName ? `Report ${reportName} was generated successfully.` : "Your clinical report was generated.";

  const pushTitle = "GlucoLab Update";
  const pushBody = "A new report was uploaded to your account.";
  const dataPayload = {
    type: "report_uploaded",
    action: "open_reports",
  };

  await notifyReadingAction(userId, localTitle, localBody, pushTitle, pushBody, dataPayload);
}
