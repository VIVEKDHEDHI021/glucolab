import { Capacitor } from "@capacitor/core";
import { handleNotificationNavigation } from "./notificationService";
import { deviceService } from "./deviceService";

// Fallback placeholder - User will provide real App ID in .env via VITE_ONESIGNAL_APP_ID
export const ONESIGNAL_APP_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ONESIGNAL_APP_ID) ||
  (typeof process !== "undefined" && process.env?.VITE_ONESIGNAL_APP_ID) ||
  "YOUR_ONESIGNAL_APP_ID";

let _isInitialized = false;

// Dynamic accessor for OneSignal plugin across Cordova / Capacitor environments
function getOneSignalPlugin(): any {
  if (typeof window === "undefined") return null;
  const win = window as any;
  return win.plugins?.OneSignal || win.OneSignal || null;
}

export const oneSignalService = {
  /**
   * Initialize OneSignal on Android / Native Mobile devices
   */
  async init(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || typeof window === "undefined") {
      return false;
    }

    if (_isInitialized) return true;

    try {
      // Dynamic import to support build across web and mobile
      let OneSignal = getOneSignalPlugin();
      if (!OneSignal) {
        try {
          const mod = await import("onesignal-cordova-plugin");
          OneSignal = mod.default || mod;
        } catch (e) {
          OneSignal = getOneSignalPlugin();
        }
      }

      if (!OneSignal) {
        console.warn("[OneSignal] Plugin not found on window or module.");
        return false;
      }

      console.log("[OneSignal] Initializing OneSignal SDK with App ID:", ONESIGNAL_APP_ID);

      // 1. Initialize with App ID
      if (typeof OneSignal.initialize === "function") {
        OneSignal.initialize(ONESIGNAL_APP_ID);
      } else if (typeof OneSignal.setAppId === "function") {
        OneSignal.setAppId(ONESIGNAL_APP_ID);
      }

      // 2. Request Notification Permission without blocking
      if (OneSignal.Notifications?.requestPermission) {
        OneSignal.Notifications.requestPermission(true).then((accepted: boolean) => {
          console.log("[OneSignal] Notification permission granted:", accepted);
        }).catch((e: any) => console.warn("[OneSignal] Permission request warning:", e));
      }

      // 3. Foreground Notification Handler
      if (OneSignal.Notifications?.addEventListener) {
        OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event: any) => {
          console.log("[OneSignal] Foreground notification received:", event);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("health-data-updated"));
          }
        });

        // 4. Notification Click / Tap Handler
        OneSignal.Notifications.addEventListener("click", (event: any) => {
          console.log("[OneSignal] Notification clicked:", event);
          const notificationData = event?.notification?.additionalData || {};
          const targetAction = notificationData.action || "open_dashboard";
          handleNotificationNavigation(targetAction);
        });
      }

      // 5. Subscription Change Listener (Capture OneSignal Subscription ID)
      if (OneSignal.User?.pushSubscription?.addEventListener) {
        OneSignal.User.pushSubscription.addEventListener("change", async (state: any) => {
          const subscriptionId = state?.current?.id;
          if (subscriptionId) {
            console.log("[OneSignal] Subscription ID updated:", subscriptionId);
            await deviceService.setCurrentDeviceToken(subscriptionId);
          }
        });
      }

      // Capture initial Subscription ID if already available
      const initialSubId = OneSignal.User?.pushSubscription?.id || OneSignal.User?.pushSubscription?.token;
      if (initialSubId) {
        await deviceService.setCurrentDeviceToken(initialSubId);
      }

      _isInitialized = true;
      console.log("[OneSignal] SDK successfully initialized.");
      return true;
    } catch (err) {
      console.error("[OneSignal] Initialization error:", err);
      return false;
    }
  },

  /**
   * Link the current device's OneSignal subscription to the authenticated GlucoLab User ID
   */
  async login(userId: string): Promise<void> {
    if (!userId || !Capacitor.isNativePlatform()) return;

    try {
      await this.init();
      const OneSignal = getOneSignalPlugin();
      if (!OneSignal) return;

      console.log(`[OneSignal] Linking device to GlucoLab user ID: ${userId}`);

      if (typeof OneSignal.login === "function") {
        // OneSignal v5+ External User ID identity
        await OneSignal.login(userId);
      } else if (typeof OneSignal.setExternalUserId === "function") {
        // OneSignal v4 fallback
        await OneSignal.setExternalUserId(userId);
      }

      // Retrieve device subscription ID and register with backend
      const subscriptionId =
        OneSignal.User?.pushSubscription?.id ||
        (await deviceService.getCurrentDeviceToken());

      if (subscriptionId) {
        const platform = Capacitor.getPlatform();
        const deviceName =
          typeof navigator !== "undefined"
            ? navigator.userAgent.substring(0, 100)
            : "GlucoLab Android";

        await deviceService.registerDevice(subscriptionId, platform, deviceName);
      }
    } catch (err) {
      console.error("[OneSignal] Error during user login mapping:", err);
    }
  },

  /**
   * Unlink current device on logout without affecting user's other devices
   */
  async logout(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const OneSignal = getOneSignalPlugin();
      if (!OneSignal) return;

      console.log("[OneSignal] Logging out device from OneSignal identity...");

      if (typeof OneSignal.logout === "function") {
        await OneSignal.logout();
      } else if (typeof OneSignal.removeExternalUserId === "function") {
        await OneSignal.removeExternalUserId();
      }
    } catch (err) {
      console.error("[OneSignal] Error during logout unlinking:", err);
    }
  },

  /**
   * Get current device's OneSignal Subscription ID
   */
  async getSubscriptionId(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null;
    const OneSignal = getOneSignalPlugin();
    return (
      OneSignal?.User?.pushSubscription?.id ||
      (await deviceService.getCurrentDeviceToken())
    );
  },
};
