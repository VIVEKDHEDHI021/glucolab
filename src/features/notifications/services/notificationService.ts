import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/db/client";
import type { PatientNotificationSettings, NotificationCategory } from "../types";
import {
  NOTIFICATION_CHANNELS,
  ACTION_TYPES,
  getDefaultNotificationSettings,
  SETTINGS_STORAGE_KEY_PREFIX,
} from "../constants";
import { notificationChannels } from "./notificationChannels";
import { notificationScheduler } from "./notificationScheduler";
import { notificationActions } from "./notificationActions";
import { notificationHealth } from "./notificationHealth";

let currentUserId: string | null = null;
let currentSettings: PatientNotificationSettings | null = null;
let cleanupActions: (() => void) | null = null;

export const notificationService = {
  /**
   * Initialize notification system for current user
   */
  async initialize(userId: string): Promise<void> {
    if (!userId) return;
    currentUserId = userId;

    // 1. Initialize Android channels and action types
    await notificationChannels.initialize();

    // 2. Register notification action listeners
    if (cleanupActions) {
      cleanupActions();
    }
    cleanupActions = notificationActions.initialize();

    // 3. Load user settings
    const settings = await this.getSettings(userId);
    currentSettings = settings;

    // 4. Reconcile schedules with local AlarmManager
    await notificationScheduler.reconcileAll(settings);

    // 5. Background sync with Supabase if online
    this.syncWithRemote(userId).catch((e) => console.warn("[NotificationService] Remote sync deferred:", e));
  },

  /**
   * Retrieve notification settings for user (Offline-first)
   */
  async getSettings(userId: string): Promise<PatientNotificationSettings> {
    if (!userId) return getDefaultNotificationSettings("anonymous");

    const storageKey = `${SETTINGS_STORAGE_KEY_PREFIX}${userId}`;

    // 1. Try local storage first
    try {
      const localJson = localStorage.getItem(storageKey);
      if (localJson) {
        const parsed = JSON.parse(localJson);
        return {
          ...getDefaultNotificationSettings(userId),
          ...parsed,
          userId,
        };
      }
    } catch (e) {
      console.warn("[NotificationService] Error reading local settings:", e);
    }

    // Fallback to default
    const defaults = getDefaultNotificationSettings(userId);
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    } catch {}

    return defaults;
  },

  /**
   * Save and apply notification settings changes
   */
  async updateSettings(
    userId: string,
    updates: Partial<PatientNotificationSettings>
  ): Promise<PatientNotificationSettings> {
    if (!userId) throw new Error("Missing user identification");

    const current = await this.getSettings(userId);
    const updated: PatientNotificationSettings = {
      ...current,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Persist to local storage immediately
    const storageKey = `${SETTINGS_STORAGE_KEY_PREFIX}${userId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn("[NotificationService] Error writing to local storage:", e);
    }

    currentSettings = updated;

    // 2. Reconcile native schedules
    await notificationScheduler.reconcileAll(updated);

    // 3. Sync to Supabase in background
    this.syncToRemote(userId, updated).catch((err) => {
      console.warn("[NotificationService] Background remote save failed:", err);
    });

    return updated;
  },

  /**
   * Send an instant test notification to physically verify heads-up banner & actions
   */
  async sendTestNotification(category: NotificationCategory = "glucose"): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      alert("Test Notification: GlucoLab health reminder simulation (Web mode).");
      return;
    }

    try {
      // Ensure permission is granted
      const hasPerm = await notificationHealth.requestPermissions();
      if (!hasPerm) {
        alert("Cannot send test notification: Notification permission was denied.");
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 999999,
            title: "GlucoLab Test Reminder",
            body: "Heads-up notification and sound check are working perfectly!",
            channelId: NOTIFICATION_CHANNELS.TEST.id,
            actionTypeId: ACTION_TYPES.GLUCOSE_ACTION,
            schedule: {
              at: new Date(Date.now() + 1000), // Fire in 1 second
              allowWhileIdle: true,
            },
            foreground: true,
            extra: {
              category,
              isTest: true,
              userId: currentUserId,
            },
          },
        ],
      });
      console.log("[NotificationService] Test notification scheduled.");
    } catch (err) {
      console.error("[NotificationService] Failed to send test notification:", err);
      throw err;
    }
  },

  /**
   * Safe logout handling: Clears all local schedules to prevent data exposure
   */
  async handleSignOut(): Promise<void> {
    currentUserId = null;
    currentSettings = null;
    if (cleanupActions) {
      cleanupActions();
      cleanupActions = null;
    }
    await notificationScheduler.cancelAll();
  },

  /**
   * Background sync from Supabase
   */
  async syncWithRemote(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("patient_notification_settings" as any)
        .select("settings, updated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data && (data as any).settings) {
        const remoteSettings = (data as any).settings as PatientNotificationSettings;
        const local = await this.getSettings(userId);

        // If remote has newer update, adopt remote
        if (!local.updatedAt || new Date((data as any).updated_at) > new Date(local.updatedAt)) {
          const merged: PatientNotificationSettings = {
            ...getDefaultNotificationSettings(userId),
            ...remoteSettings,
            userId,
          };
          localStorage.setItem(`${SETTINGS_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(merged));
          await notificationScheduler.reconcileAll(merged);
        }
      }
    } catch (e) {
      // Table may not yet be migrated or user is offline
      console.log("[NotificationService] Supabase sync deferred (offline or table pending):", e);
    }
  },

  /**
   * Background sync to Supabase
   */
  async syncToRemote(userId: string, settings: PatientNotificationSettings): Promise<void> {
    try {
      await supabase.from("patient_notification_settings" as any).upsert({
        user_id: userId,
        settings,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[NotificationService] Error syncing settings to Supabase:", e);
    }
  },
};
