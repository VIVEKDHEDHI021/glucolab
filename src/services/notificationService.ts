import { getToken } from "firebase/messaging";
import { messaging, vapidKey } from "../lib/firebase";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

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
          description: "Health alerts and reminders",
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

        PushNotifications.addListener("registration", (token) => {
          console.log("[Native Push] Token registered successfully:", token.value);
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
          console.log("[Native Push Received]:", notification);
          showLocalNotification(
            notification.title || "Health Alert",
            notification.body || "",
          );
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
  } else {
    console.warn(
      "[Notification Service] Cannot show notification, permission status:",
      Notification.permission,
    );
  }
}

export async function triggerPushNotification(userId: string, title: string, body: string) {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/send-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, title, body }),
    });
    if (!res.ok) {
      const errData = await res.json();
      console.warn("Failed to trigger background push notification:", errData);
    } else {
      console.log("Successfully triggered background push notification call.");
    }
  } catch (err) {
    console.error("Error triggering background push notification:", err);
  }
}

/**
 * Dispatch action-specific notification to both local browser and all user devices via FCM push
 */
export async function notifyReadingAction(userId: string, title: string, body: string) {
  showLocalNotification(title, body);
  await triggerPushNotification(userId, title, body);
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

  let title = `🩸 Glucose Reading: ${glucose} mg/dL`;
  let body = `Blood sugar level of ${glucose} mg/dL (${typeLabel}) was recorded.`;

  if (glucose < lowTarget) {
    title = `🚨 CRITICAL LOW SUGAR WARNING: ${glucose} mg/dL`;
    body = `URGENT: Blood sugar level of ${glucose} mg/dL (${typeLabel}) is dangerously LOW (< ${lowTarget} mg/dL). Please consume 15g of fast-acting sugar immediately!`;
  } else if (glucose > highTarget) {
    title = `⚠️ HIGH SUGAR ALERT: ${glucose} mg/dL`;
    body = `WARNING: Blood sugar level of ${glucose} mg/dL (${typeLabel}) exceeds high target (${highTarget} mg/dL). Consider checking your insulin dose or drinking water.`;
  }

  await notifyReadingAction(userId, title, body);
}

export async function notifyInsulinAdded(userId: string, scheduleStr: string, totalUnits: number, entryDate: string) {
  const title = "💉 New Insulin Dosage Logged";
  const body = `Insulin schedule (${scheduleStr} - total ${totalUnits} units) recorded for ${entryDate}.`;
  await notifyReadingAction(userId, title, body);
}

export async function notifyWeightAdded(userId: string, weightKg: number, entryDate: string) {
  const title = "⚖️ New Weight Reading Logged";
  const body = `Weight entry of ${weightKg} kg was recorded for ${entryDate}.`;
  await notifyReadingAction(userId, title, body);
}

export async function notifyScanReadingAdded(userId: string, deviceType: string, data: any) {
  let title = `📷 New ${deviceType} Scan Saved`;
  let body = `A new ${deviceType} reading was scanned and saved.`;

  if (deviceType === "Blood Glucose Meter" && data.glucose !== undefined) {
    title = "🩸 Scanned Glucose Reading Saved";
    body = `Smart Scan Glucose: ${data.glucose} ${data.unit || "mg/dL"} (${data.glucose_reading_type || "Fasting"}).`;
  } else if (deviceType === "Blood Pressure Monitor" && data.systolic !== undefined) {
    title = "🫀 Scanned Blood Pressure Reading Saved";
    body = `Smart Scan BP: ${data.systolic}/${data.diastolic} mmHg${data.pulse ? ` (Pulse: ${data.pulse} bpm)` : ""}.`;
  } else if (deviceType === "Pulse Oximeter" && data.spo2 !== undefined) {
    title = "🫁 Scanned SpO₂ Reading Saved";
    body = `Smart Scan SpO₂: ${data.spo2}%${data.pulse ? ` (Pulse: ${data.pulse} bpm)` : ""}.`;
  } else if (deviceType === "Thermometer" && data.temperature !== undefined) {
    title = "🌡️ Scanned Temperature Reading Saved";
    body = `Smart Scan Temperature: ${data.temperature} ${data.unit || "°C"}.`;
  } else if (deviceType === "Weight Scale" && data.weight !== undefined) {
    title = "⚖️ Scanned Weight Reading Saved";
    body = `Smart Scan Weight: ${data.weight} ${data.unit || "kg"}.`;
  }

  await notifyReadingAction(userId, title, body);
}

