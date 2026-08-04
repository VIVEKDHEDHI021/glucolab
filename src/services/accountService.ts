import { supabase, getLocalDbService } from "@/db/client";
import { Capacitor } from "@capacitor/core";

export interface DeleteAccountResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const accountService = {
  /**
   * Permanently deletes user account from server and clears all local data.
   */
  async deleteAccount(password: string): Promise<DeleteAccountResponse> {
    // 1. Check network connectivity
    if (typeof window !== "undefined" && !navigator.onLine) {
      return {
        success: false,
        error: "Internet connection is required to permanently delete your account.",
      };
    }

    // 2. Fetch current access token
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      return {
        success: false,
        error: "Session expired or unauthorized. Please log in again.",
      };
    }

    try {
      // 3. Call DELETE /api/account backend endpoint
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || resData.error) {
        return {
          success: false,
          error: resData.error || `Server responded with status ${response.status}`,
        };
      }

      // 4. Server deletion succeeded — Now clean up all local client state
      await this.clearAllLocalUserData();

      // 5. Sign out of Supabase auth
      await supabase.auth.signOut().catch((e) => {
        console.warn("[Account Service] SignOut after deletion notice:", e);
      });

      return {
        success: true,
        message: "Account and associated data deleted successfully.",
      };
    } catch (err: any) {
      console.error("[Account Service] Error deleting account:", err);
      return {
        success: false,
        error: err?.message || "Failed to communicate with the server. Please check your connection.",
      };
    }
  },

  /**
   * Completely clears all local storage, SQLite database, Capacitor preferences, and notification tokens.
   */
  async clearAllLocalUserData(): Promise<void> {
    try {
      // Clear SQLite database cache on native mobile
      if (Capacitor.isNativePlatform()) {
        try {
          const localDb = await getLocalDbService();
          await localDb.clearAllCaches();
        } catch (sqliteErr) {
          console.warn("[Account Service] SQLite cache clear error:", sqliteErr);
        }

        // Clear Capacitor Preferences
        try {
          const { Preferences } = await import("@capacitor/preferences");
          await Preferences.clear();
        } catch (prefErr) {
          console.warn("[Account Service] Capacitor Preferences clear error:", prefErr);
        }

        // Cancel scheduled local notifications if any
        try {
          const { LocalNotifications } = await import("@capacitor/local-notifications");
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length > 0) {
            await LocalNotifications.cancel(pending);
          }
        } catch (notifErr) {
          console.warn("[Account Service] Local Notifications clear error:", notifErr);
        }
      }

      // Clear LocalStorage in browser/webview
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.clear();
      }
    } catch (err) {
      console.error("[Account Service] Error during local data cleanup:", err);
    }
  },
};
