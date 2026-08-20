import { Capacitor } from "@capacitor/core";
import { supabase } from "@/db/client";

const DEVICE_TOKEN_KEY = "glucolab_current_device_token";
let _inMemoryToken: string | null = null;

export const deviceService = {
  /**
   * Get current device's FCM push token from local storage
   */
  async getCurrentDeviceToken(): Promise<string | null> {
    if (_inMemoryToken) return _inMemoryToken;

    if (typeof window === "undefined") return null;

    try {
      if (Capacitor.isNativePlatform()) {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: DEVICE_TOKEN_KEY });
        _inMemoryToken = value || null;
        return _inMemoryToken;
      } else {
        _inMemoryToken = localStorage.getItem(DEVICE_TOKEN_KEY);
        return _inMemoryToken;
      }
    } catch (e) {
      console.warn("[DeviceService] Failed to read current device token:", e);
      return null;
    }
  },

  /**
   * Synchronously get in-memory cached device token (for fast dispatch during mutations)
   */
  getCachedDeviceToken(): string | null {
    if (_inMemoryToken) return _inMemoryToken;
    if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
      try {
        _inMemoryToken = localStorage.getItem(DEVICE_TOKEN_KEY);
      } catch (e) {}
    }
    return _inMemoryToken;
  },

  /**
   * Save current device token locally
   */
  async setCurrentDeviceToken(token: string | null): Promise<void> {
    _inMemoryToken = token;
    if (typeof window === "undefined") return;

    try {
      if (Capacitor.isNativePlatform()) {
        const { Preferences } = await import("@capacitor/preferences");
        if (token) {
          await Preferences.set({ key: DEVICE_TOKEN_KEY, value: token });
        } else {
          await Preferences.remove({ key: DEVICE_TOKEN_KEY });
        }
      } else {
        if (token) {
          localStorage.setItem(DEVICE_TOKEN_KEY, token);
        } else {
          localStorage.removeItem(DEVICE_TOKEN_KEY);
        }
      }
    } catch (e) {
      console.warn("[DeviceService] Failed to save current device token locally:", e);
    }
  },

  /**
   * Register the device token with the backend Laravel/TanStack API
   */
  async registerDevice(
    deviceToken: string,
    deviceType?: string,
    deviceName?: string,
  ): Promise<boolean> {
    try {
      if (!deviceToken) return false;

      await this.setCurrentDeviceToken(deviceToken);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.warn("[DeviceService] No active session found during device registration.");
        return false;
      }

      const inferredType =
        deviceType || (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web");
      const inferredName =
        deviceName || (typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "GlucoLab Client");

      const response = await fetch("/api/device/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          device_token: deviceToken,
          device_type: inferredType,
          device_name: inferredName,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.warn("[DeviceService] Device registration failed on backend:", err);
        return false;
      }

      console.log("[DeviceService] Device registered and activated successfully with backend.");
      return true;
    } catch (err) {
      console.error("[DeviceService] Error registering device token:", err);
      return false;
    }
  },

  /**
   * Deactivate ONLY the current device on logout
   */
  async deactivateCurrentDevice(): Promise<void> {
    try {
      const currentToken = await this.getCurrentDeviceToken();
      if (!currentToken) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        console.log("[DeviceService] Deactivating current device on backend before signout...");
        await fetch("/api/device/deactivate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            device_token: currentToken,
          }),
        }).catch((e) => console.warn("[DeviceService] Deactivate request failed:", e));
      }

      await this.setCurrentDeviceToken(null);
    } catch (err) {
      console.error("[DeviceService] Error during device deactivation on logout:", err);
    }
  },

  /**
   * Handle FCM token rotation/refresh
   */
  async refreshDeviceToken(oldToken: string | null, newToken: string): Promise<boolean> {
    try {
      if (!newToken) return false;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return false;

      const deviceType = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web";
      const deviceName = typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "GlucoLab Client";

      const res = await fetch("/api/device/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          old_token: oldToken,
          new_token: newToken,
          device_type: deviceType,
          device_name: deviceName,
        }),
      });

      if (res.ok) {
        await this.setCurrentDeviceToken(newToken);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[DeviceService] Error refreshing device token:", err);
      return false;
    }
  },
};
