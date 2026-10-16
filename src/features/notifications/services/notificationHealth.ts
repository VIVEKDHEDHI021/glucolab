import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { NotificationHealthStatus, PatientNotificationSettings } from "../types";
import { NOTIFICATION_CHANNELS } from "../constants";

export const notificationHealth = {
  /**
   * Run comprehensive diagnostics on notification permissions, channels, and pending alarms
   */
  async checkHealth(settings?: PatientNotificationSettings): Promise<NotificationHealthStatus> {
    const errors: string[] = [];

    if (!Capacitor.isNativePlatform()) {
      return {
        permissionGranted: true,
        exactAlarmGranted: true,
        channelsConfigured: true,
        pendingNotificationsCount: 0,
        batteryOptimizationIgnored: true,
        activeCategoriesCount: settings ? countActiveCategories(settings) : 0,
        nextScheduled: null,
        errors: ["Running in web browser mode. Native Android notifications require physical device or emulator."],
      };
    }

    let permissionGranted = false;
    let exactAlarmGranted = false;
    let channelsConfigured = false;
    let pendingCount = 0;

    // 1. Check POST_NOTIFICATIONS runtime permission
    try {
      const perm = await LocalNotifications.checkPermissions();
      permissionGranted = perm.display === "granted";
      if (!permissionGranted) {
        errors.push("Notification permission is not granted. Scheduled health reminders will not appear.");
      }
    } catch (err: any) {
      errors.push(`Error checking notification permission: ${err?.message || err}`);
    }

    // 2. Check Android Exact Alarm setting
    try {
      const exactStatus = await LocalNotifications.checkExactNotificationSetting();
      exactAlarmGranted = exactStatus.exact_alarm === "granted";
      if (!exactAlarmGranted) {
        errors.push("Exact alarm permission is disabled. Alarms may be delayed by Android battery saver.");
      }
    } catch {
      // On Android < 12, exact alarms do not require separate permission
      exactAlarmGranted = true;
    }

    // 3. Check Android Channels
    try {
      const channelResult = await LocalNotifications.listChannels();
      const existingChannelIds = new Set(channelResult.channels.map((c) => c.id));
      const requiredChannelIds = Object.values(NOTIFICATION_CHANNELS).map((c) => c.id);
      const missing = requiredChannelIds.filter((id) => !existingChannelIds.has(id));

      if (missing.length === 0) {
        channelsConfigured = true;
      } else {
        errors.push(`Missing Android notification channels: ${missing.join(", ")}`);
      }
    } catch (err: any) {
      errors.push(`Error inspecting notification channels: ${err?.message || err}`);
    }

    // 4. Check Pending Notifications Count
    try {
      const pending = await LocalNotifications.getPending();
      pendingCount = pending.notifications.length;
    } catch (err: any) {
      errors.push(`Error querying scheduled alarms: ${err?.message || err}`);
    }

    const activeCategoriesCount = settings ? countActiveCategories(settings) : 0;

    return {
      permissionGranted,
      exactAlarmGranted,
      channelsConfigured,
      pendingNotificationsCount: pendingCount,
      activeCategoriesCount,
      errors,
    };
  },

  /**
   * Request notification permission with contextual rationale
   */
  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === "granted";
    } catch (e) {
      console.error("[NotificationHealth] Error requesting permissions:", e);
      return false;
    }
  },

  /**
   * Open system exact alarm settings on Android 12+
   */
  async openExactAlarmSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.changeExactNotificationSetting();
    } catch (err) {
      console.warn("[NotificationHealth] Failed to open exact alarm settings:", err);
    }
  },
};

function countActiveCategories(settings: PatientNotificationSettings): number {
  let count = 0;
  if (settings.glucose.enabled) count++;
  if (settings.medication.enabled) count++;
  if (settings.meals.enabled) count++;
  if (settings.hydration.enabled) count++;
  if (settings.summaries.dailyEnabled || settings.summaries.weeklyEnabled) count++;
  return count;
}
