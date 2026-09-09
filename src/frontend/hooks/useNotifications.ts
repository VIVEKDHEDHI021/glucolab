import { useEffect } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

/**
 * Hook for initializing notification permissions on mobile devices.
 * Realtime channel events and multi-device sync are managed by NotificationProvider.
 */
export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Request Local Notification permissions on mobile if needed
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.requestPermissions().catch((e) =>
        console.warn("[useNotifications] Mobile permission request:", e),
      );
    }
  }, [user]);
}
