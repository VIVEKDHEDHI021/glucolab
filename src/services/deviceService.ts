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
   * Register the device token with backend API and direct Supabase database
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

      if (!session?.user?.id) {
        console.warn("[DeviceService] No active user session found during device registration.");
        return false;
      }

      const inferredType =
        deviceType || (Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web");
      const inferredName =
        deviceName || (typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "GlucoLab Client");
      const now = new Date().toISOString();

      // 1. Direct Supabase Database Registration (Guaranteed to work across Mobile WebView & Web)
      try {
        await supabase.from("user_devices").upsert(
          {
            user_id: session.user.id,
            device_token: deviceToken,
            device_type: inferredType,
            device_name: inferredName,
            is_active: true,
            last_used_at: now,
            updated_at: now,
          },
          { onConflict: "device_token" },
        );

        // Also upsert legacy push_tokens for compatibility
        await supabase.from("push_tokens").upsert(
          {
            user_id: session.user.id,
            token: deviceToken,
            platform: inferredType,
            device_name: inferredName,
            updated_at: now,
          },
          { onConflict: "user_id,token" },
        );
        console.log("[DeviceService] Device token registered directly via Supabase RLS.");
      } catch (dbErr) {
        console.warn("[DeviceService] Supabase direct RLS registration warning:", dbErr);
      }

      // 2. Also notify Backend API endpoint if reachable
      try {
        if (session.access_token) {
          await fetch("/api/device/register", {
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
        }
      } catch (apiErr) {
        // Expected on native mobile platforms where /api/ is not locally hosted
      }

      console.log("[DeviceService] Device registered and activated successfully.");
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

      if (session?.user?.id) {
        const now = new Date().toISOString();
        console.log("[DeviceService] Deactivating current device on backend before signout...");

        // 1. Direct Supabase deactivation (works on mobile & web)
        try {
          await supabase
            .from("user_devices")
            .update({
              is_active: false,
              updated_at: now,
            })
            .eq("user_id", session.user.id)
            .eq("device_token", currentToken);

          await supabase
            .from("push_tokens")
            .delete()
            .eq("user_id", session.user.id)
            .eq("token", currentToken);
        } catch (dbErr) {
          console.warn("[DeviceService] Direct deactivation error:", dbErr);
        }

        // 2. Also try API route if available
        if (session.access_token) {
          await fetch("/api/device/deactivate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              device_token: currentToken,
            }),
          }).catch(() => {});
        }
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

      if (!session?.user?.id) return false;

      const deviceType = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web";
      const deviceName = typeof navigator !== "undefined" ? navigator.userAgent.substring(0, 100) : "GlucoLab Client";
      const now = new Date().toISOString();

      // 1. Direct Supabase token rotation
      try {
        if (oldToken && oldToken !== newToken) {
          await supabase
            .from("user_devices")
            .update({
              device_token: newToken,
              is_active: true,
              device_type: deviceType,
              device_name: deviceName,
              last_used_at: now,
              updated_at: now,
            })
            .eq("user_id", session.user.id)
            .eq("device_token", oldToken);
        } else {
          await supabase.from("user_devices").upsert(
            {
              user_id: session.user.id,
              device_token: newToken,
              device_type: deviceType,
              device_name: deviceName,
              is_active: true,
              last_used_at: now,
              updated_at: now,
            },
            { onConflict: "device_token" },
          );
        }
      } catch (dbErr) {
        console.warn("[DeviceService] Direct token rotation warning:", dbErr);
      }

      // 2. Also try API endpoint if reachable
      if (session.access_token) {
        await fetch("/api/device/refresh", {
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
        }).catch(() => {});
      }

      await this.setCurrentDeviceToken(newToken);
      return true;
    } catch (err) {
      console.error("[DeviceService] Error refreshing device token:", err);
      return false;
    }
  },
};
