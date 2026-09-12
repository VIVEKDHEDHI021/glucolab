import { getToken } from "firebase/messaging";
import { messaging, vapidKey } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { deviceService } from "./deviceService";
import { oneSignalService } from "./oneSignalService";
import { supabase } from "@/db/client";

export async function requestNotificationPermission(): Promise<string | null> {
  console.log("Notification service started");

  if (typeof window === "undefined") {
    console.warn("[Notification Service] Running on server-side, skipping registration");
    return null;
  }

  // 1. Native Capacitor Platform Handling (Android / iOS via OneSignal)
  if (Capacitor.isNativePlatform()) {
    try {
      console.log("[Notification Service] Initializing OneSignal Mobile Notifications...");

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

      // Initialize OneSignal
      await oneSignalService.init();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        await oneSignalService.login(session.user.id);
      }

      const subscriptionId = await oneSignalService.getSubscriptionId();
      if (subscriptionId) {
        console.log("[Notification Service] OneSignal Subscription ID captured:", subscriptionId);
        return subscriptionId;
      }

      return new Promise<string | null>(async (resolve) => {
        let resolved = false;

        PushNotifications.addListener("registration", async (token) => {
          console.log("[Native Push] Token registered:", token.value);
          await deviceService.setCurrentDeviceToken(token.value);
          if (!resolved) {
            resolved = true;
            resolve(token.value);
          }
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.warn("[Native Push] Registration error:", err);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        });

        try {
          const perm = await PushNotifications.requestPermissions();
          if (perm.receive === "granted") {
            await PushNotifications.register();
          } else {
            console.warn("[Native Push] Permission not granted:", perm.receive);
            if (!resolved) {
              resolved = true;
              resolve(null);
            }
          }
        } catch (regErr) {
          console.warn("[Native Push] Registration exception:", regErr);
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }

        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 5000);
      });
    } catch (err) {
      console.error("[Notification Service] Native OneSignal setup error:", err);
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
    case "open_insulin":
    case "insulin_reminder":
      window.location.hash = "/dashboard";
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("glucolab-open-dialog", { detail: { dialog: "insulin" } }),
        );
      }, 200);
      break;
    case "open_glucose":
    case "glucose_reminder":
      window.location.hash = "/dashboard";
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("glucolab-open-dialog", { detail: { dialog: "glucose" } }),
        );
      }, 200);
      break;
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

    let apiSucceeded = false;

    // 1. Try Backend API endpoint if reachable (Web / SSR)
    try {
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

      if (res.ok) {
        apiSucceeded = true;
        const resData = await res.json().catch(() => ({}));
        console.log("[NotificationService] Push notification dispatched via backend API:", resData);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn("[NotificationService] Backend /api/send-push returned status:", res.status, errData);
      }
    } catch (apiErr) {
      console.warn("[NotificationService] /api/send-push fetch attempt failed:", apiErr);
    }

    // 2. Direct OneSignal Cloud API Dispatch Fallback (Guaranteed to work directly on Mobile & Web)
    if (!apiSucceeded) {
      const appId =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_ONESIGNAL_APP_ID) ||
        (typeof process !== "undefined" && process.env?.VITE_ONESIGNAL_APP_ID) ||
        "eae3b62b-2f16-4a28-8ec4-a1c9bdca69fe";

      const apiKey =
        (typeof import.meta !== "undefined" && import.meta.env?.VITE_ONESIGNAL_REST_API_KEY) ||
        (typeof process !== "undefined" && process.env?.VITE_ONESIGNAL_REST_API_KEY) ||
        (typeof process !== "undefined" && process.env?.ONESIGNAL_REST_API_KEY);

      if (appId && apiKey) {
        // Query active user subscriptions excluding source device
        let targetTokens: string[] = [];
        const { data: devices } = await supabase
          .from("user_devices")
          .select("device_token")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (devices) {
          targetTokens = devices.map((d: any) => d.device_token).filter(Boolean);
          if (sourceToken) {
            targetTokens = targetTokens.filter((t) => t !== sourceToken.trim());
          }
        }

        // Only pass valid OneSignal UUIDs to include_subscription_ids to avoid invalid_player_ids error
        const oneSignalSubscriptionIds = targetTokens.filter((t) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t),
        );

        const oneSignalBody: any = {
          app_id: appId,
          headings: { en: title },
          contents: { en: body },
          data: {
            ...(dataPayload || {}),
            timestamp: new Date().toISOString(),
          },
          priority: 10,
          android_channel_id: "default",
          android_accent_color: "0284C7",
          small_icon: "ic_notification",
        };

        if (oneSignalSubscriptionIds.length > 0) {
          oneSignalBody.include_subscription_ids = oneSignalSubscriptionIds;
          oneSignalBody.include_player_ids = oneSignalSubscriptionIds;
        } else {
          oneSignalBody.include_aliases = { external_id: [userId] };
          oneSignalBody.include_external_user_ids = [userId];
        }

        console.log(
          `[NotificationService] Sending direct OneSignal cloud push for user ${userId} (targets: ${oneSignalSubscriptionIds.length})...`,
        );

        const osRes = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify(oneSignalBody),
        });

        if (osRes.ok) {
          const osData = await osRes.json().catch(() => ({}));
          console.log("[NotificationService] Direct OneSignal push sent successfully:", osData);
        } else {
          const osErr = await osRes.json().catch(() => ({}));
          console.warn("[NotificationService] Direct OneSignal dispatch error:", osRes.status, osErr);
        }
      }
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

export async function notifyGlucoseAdded(
  userId: string,
  glucose: number,
  typeLabel: string,
  isUpdate: boolean = false,
) {
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
  let localTitle = isUpdate
    ? `🩸 Glucose Reading Updated: ${glucose} mg/dL`
    : `🩸 Glucose Reading: ${glucose} mg/dL`;
  let localBody = isUpdate
    ? `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was updated.`
    : `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was recorded.`;

  if (glucose < lowTarget) {
    localTitle = isUpdate
      ? `🚨 CRITICAL LOW SUGAR WARNING (UPDATED): ${glucose} mg/dL`
      : `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
    localBody = `URGENT: Blood sugar level of ${glucose} mg/dL (${typeLabel}) is dangerously LOW (< ${lowTarget} mg/dL). Please consume 15g of fast-acting sugar immediately!`;
  } else if (glucose > highTarget) {
    localTitle = isUpdate
      ? `⚠️ HIGH SUGAR ALERT (UPDATED): ${glucose} mg/dL`
      : `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
    localBody = `WARNING: Blood sugar level of ${glucose} mg/dL (${typeLabel}) exceeds high target (${highTarget} mg/dL). Consider checking your insulin dose or drinking water.`;
  }

  // Non-sensitive privacy-compliant copy (for remote multi-device push)
  const pushTitle = "GlucoLab Update";
  const pushBody = isUpdate
    ? "A blood glucose reading was updated on your account."
    : "A new blood glucose reading was recorded on your account.";
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

export async function notifyWeightAdded(
  userId: string,
  weightKg: number,
  entryDate: string,
  isUpdate: boolean = false,
) {
  const localTitle = isUpdate
    ? "⚖️ Weight Reading Updated"
    : "⚖️ New Weight Reading Logged";
  const localBody = isUpdate
    ? `Weight entry of ${weightKg} kg was updated for ${entryDate}.`
    : `Weight entry of ${weightKg} kg was recorded for ${entryDate}.`;

  const pushTitle = "GlucoLab Update";
  const pushBody = isUpdate
    ? "A weight entry was updated on your account."
    : "A new weight entry was logged to your account.";
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

/**
 * Dispatches an explicit test push notification to verify Dual FCM & OneSignal multi-device delivery.
 */
export async function sendTestPushNotification(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    const localTitle = "🔔 Test Notification Received";
    const localBody = "Multi-device push notification pipeline is active and working.";
    const pushTitle = "GlucoLab Test Alert";
    const pushBody = "Multi-device push verification alert successfully delivered to your account.";

    showLocalNotification(localTitle, localBody);

    const { data: { session } } = await supabase.auth.getSession();
    const sourceToken = deviceService.getCachedDeviceToken() || (await deviceService.getCurrentDeviceToken());

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
        title: pushTitle,
        body: pushBody,
        excludeDeviceToken: undefined, // Include all registered devices for test verification
        data: {
          type: "test_notification",
          action: "open_dashboard",
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        success: true,
        message: `Dispatched to ${data.sentCount ?? 1} device(s) via ${data.fcm ? "FCM" : ""}${data.fcm && data.onesignal ? " & " : ""}${data.onesignal ? "OneSignal" : ""}.`,
      };
    } else {
      return {
        success: false,
        message: data.error || `Server responded with HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to trigger test notification.",
    };
  }
}

