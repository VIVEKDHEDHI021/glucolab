import { PushNotifications } from "@capacitor/push-notifications";
import { Device } from "@capacitor/device";
import { toast } from "sonner";
import { deviceService } from "@/services/deviceService";
import { handleNotificationNavigation } from "@/services/notificationService";

export const pushService = {
  async register(_userId?: string) {
    try {
      // 1. Request permission
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== "granted") {
        console.warn("[pushService] Push Notifications permission denied");
        return;
      }

      // 2. Register with Apple/Google APNS/FCM
      await PushNotifications.register();

      // 3. Listen for the registration event
      PushNotifications.addListener("registration", async (token) => {
        console.log("[pushService] Push Registration Token received:", token.value);

        const info = await Device.getInfo();
        const deviceName = `${info.manufacturer || ""} ${info.model || ""}`.trim() || info.platform;

        // Register token with backend Laravel / TanStack API securely
        await deviceService.registerDevice(token.value, info.platform, deviceName);
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("[pushService] Push Registration Error:", error);
      });

      // 4. Handle notification received while app is in foreground
      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        toast.info(notification.title || "GlucoLab Update", {
          description: notification.body,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("health-data-updated"));
        }
      });

      // 5. Handle notification click / tap
      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = action.notification?.data;
        const targetAction = data?.action || "open_dashboard";
        handleNotificationNavigation(targetAction);
      });
    } catch (e) {
      console.error("[pushService] Push Notification Setup Error:", e);
    }
  },
};
