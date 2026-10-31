import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import type {
  PatientNotificationSettings,
  QuietHoursConfig,
  NotificationCategory,
  ReadingSlotType,
} from "../types";
import { NOTIFICATION_CHANNELS, ACTION_TYPES } from "../constants";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Checks whether an "HH:mm" time falls inside user-configured quiet hours
 */
export function isTimeInQuietHours(timeStr: string, quiet: QuietHoursConfig): boolean {
  if (!quiet || !quiet.enabled) return false;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return false;
  const totalMinutes = h * 60 + m;

  const [qhStartH, qhStartM] = (quiet.startTime || "22:30").split(":").map(Number);
  const [qhEndH, qhEndM] = (quiet.endTime || "07:00").split(":").map(Number);
  const startMinutes = qhStartH * 60 + qhStartM;
  const endMinutes = qhEndH * 60 + qhEndM;

  if (startMinutes <= endMinutes) {
    // Same-day quiet hours (e.g. 13:00 to 15:00)
    return totalMinutes >= startMinutes && totalMinutes < endMinutes;
  } else {
    // Overnight quiet hours (e.g. 22:30 to 07:00)
    return totalMinutes >= startMinutes || totalMinutes < endMinutes;
  }
}

export const notificationScheduler = {
  /**
   * Reconcile and schedule all notifications based on patient preferences
   */
  async reconcileAll(settings: PatientNotificationSettings): Promise<{ scheduledCount: number; errors: string[] }> {
    const errors: string[] = [];
    if (!Capacitor.isNativePlatform()) {
      return { scheduledCount: 0, errors: [] };
    }

    try {
      // 1. Cancel all current pending notifications to prevent stale or duplicate schedules
      await LocalNotifications.cancelAll();

      const notificationsToSchedule: LocalNotificationSchema[] = [];

      // 2. Schedule Blood Glucose Reminders
      if (settings.glucose.enabled) {
        for (const slot of settings.glucose.slots) {
          if (!slot.enabled || !slot.time) continue;
          if (isTimeInQuietHours(slot.time, settings.quietHours)) {
            // Respect quiet hours for non-critical measurement times
            continue;
          }

          const [hour, minute] = slot.time.split(":").map(Number);
          const baseHash = hashString(`glucose_${slot.id}`) % 10000;

          const weekdays = slot.weekdays && slot.weekdays.length > 0 ? slot.weekdays : [1, 2, 3, 4, 5, 6, 7];
          for (const weekday of weekdays) {
            const notifId = 100000 + baseHash * 10 + (weekday % 10);
            notificationsToSchedule.push({
              id: notifId,
              title: "Blood Glucose Reminder",
              body: `Time to check and log your ${slot.label.toLowerCase()} reading.`,
              channelId: NOTIFICATION_CHANNELS.GLUCOSE.id,
              actionTypeId: ACTION_TYPES.GLUCOSE_ACTION,
              schedule: {
                on: {
                  weekday: weekday as any,
                  hour,
                  minute,
                },
                allowWhileIdle: true,
              },
              foreground: true,
              extra: {
                category: "glucose" as NotificationCategory,
                slotId: slot.id,
                readingType: slot.readingType,
                scheduledTime: slot.time,
                userId: settings.userId,
              },
            });
          }
        }
      }

      // 3. Schedule Medication & Insulin Reminders
      if (settings.medication.enabled) {
        for (const slot of settings.medication.slots) {
          if (!slot.enabled || !slot.time) continue;
          if (isTimeInQuietHours(slot.time, settings.quietHours)) {
            continue;
          }

          const [hour, minute] = slot.time.split(":").map(Number);
          const baseHash = hashString(`medication_${slot.id}`) % 10000;

          const weekdays = slot.weekdays && slot.weekdays.length > 0 ? slot.weekdays : [1, 2, 3, 4, 5, 6, 7];
          for (const weekday of weekdays) {
            const notifId = 200000 + baseHash * 10 + (weekday % 10);
            notificationsToSchedule.push({
              id: notifId,
              title: "Medication Reminder",
              body: `Time for your scheduled ${slot.label.toLowerCase()} dose. Tap Taken once completed.`,
              channelId: NOTIFICATION_CHANNELS.MEDICATION.id,
              actionTypeId: ACTION_TYPES.MEDICATION_ACTION,
              schedule: {
                on: {
                  weekday: weekday as any,
                  hour,
                  minute,
                },
                allowWhileIdle: true,
              },
              foreground: true,
              extra: {
                category: "medication" as NotificationCategory,
                slotId: slot.id,
                scheduledTime: slot.time,
                userId: settings.userId,
              },
            });
          }
        }
      }

      // 4. Schedule Meal Reminders
      if (settings.meals.enabled) {
        for (const slot of settings.meals.slots) {
          if (!slot.enabled || !slot.time) continue;
          if (isTimeInQuietHours(slot.time, settings.quietHours)) {
            continue;
          }

          const [hour, minute] = slot.time.split(":").map(Number);
          const baseHash = hashString(`meal_${slot.id}`) % 10000;

          const weekdays = slot.weekdays && slot.weekdays.length > 0 ? slot.weekdays : [1, 2, 3, 4, 5, 6, 7];
          for (const weekday of weekdays) {
            const notifId = 300000 + baseHash * 10 + (weekday % 10);
            notificationsToSchedule.push({
              id: notifId,
              title: "Mealtime Reminder",
              body: `Time for ${slot.label.toLowerCase()}. Remember to log your meal or pre-meal glucose reading!`,
              channelId: NOTIFICATION_CHANNELS.MEALS.id,
              actionTypeId: ACTION_TYPES.MEAL_ACTION,
              schedule: {
                on: {
                  weekday: weekday as any,
                  hour,
                  minute,
                },
                allowWhileIdle: true,
              },
              foreground: true,
              extra: {
                category: "meals" as NotificationCategory,
                slotId: slot.id,
                scheduledTime: slot.time,
                userId: settings.userId,
              },
            });
          }
        }
      }

      // 5. Schedule Hydration Reminders
      if (settings.hydration.enabled) {
        const [startH, startM] = (settings.hydration.startTime || "08:00").split(":").map(Number);
        const [endH, endM] = (settings.hydration.endTime || "20:00").split(":").map(Number);
        const startTotalMin = startH * 60 + startM;
        const endTotalMin = endH * 60 + endM;
        const interval = Math.max(30, settings.hydration.intervalMinutes || 120);

        let count = 0;
        const maxLimit = settings.hydration.dailyLimit || 6;
        const weekdays = settings.hydration.weekdays?.length ? settings.hydration.weekdays : [1, 2, 3, 4, 5, 6, 7];

        for (let m = startTotalMin + interval; m <= endTotalMin && count < maxLimit; m += interval) {
          const slotH = Math.floor(m / 60);
          const slotM = m % 60;
          const timeStr = `${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`;

          if (isTimeInQuietHours(timeStr, settings.quietHours)) {
            continue;
          }

          count++;
          for (const weekday of weekdays) {
            const notifId = 400000 + count * 100 + (weekday % 10);
            notificationsToSchedule.push({
              id: notifId,
              title: "Hydration Reminder",
              body: "Time for a glass of water to keep your hydration on track.",
              channelId: NOTIFICATION_CHANNELS.HYDRATION.id,
              actionTypeId: ACTION_TYPES.HYDRATION_ACTION,
              schedule: {
                on: {
                  weekday: weekday as any,
                  hour: slotH,
                  minute: slotM,
                },
                allowWhileIdle: true,
              },
              foreground: false,
              extra: {
                category: "hydration" as NotificationCategory,
                scheduledTime: timeStr,
                userId: settings.userId,
              },
            });
          }
        }
      }

      // 6. Schedule Daily Summary
      if (settings.summaries.dailyEnabled && settings.summaries.dailyTime) {
        if (!isTimeInQuietHours(settings.summaries.dailyTime, settings.quietHours)) {
          const [hour, minute] = settings.summaries.dailyTime.split(":").map(Number);
          notificationsToSchedule.push({
            id: 500001,
            title: "GlucoLab Daily Summary",
            body: "Your daily glucose and insulin tracking summary is ready for review.",
            channelId: NOTIFICATION_CHANNELS.SUMMARIES.id,
            actionTypeId: ACTION_TYPES.SUMMARY_ACTION,
            schedule: {
              on: {
                hour,
                minute,
              },
              allowWhileIdle: true,
            },
            foreground: true,
            extra: {
              category: "summary_daily" as NotificationCategory,
              userId: settings.userId,
            },
          });
        }
      }

      // 7. Schedule Weekly Summary
      if (settings.summaries.weeklyEnabled && settings.summaries.weeklyTime) {
        if (!isTimeInQuietHours(settings.summaries.weeklyTime, settings.quietHours)) {
          const [hour, minute] = settings.summaries.weeklyTime.split(":").map(Number);
          const weekday = settings.summaries.weeklyDay || 1; // 1 = Sunday
          notificationsToSchedule.push({
            id: 500002,
            title: "GlucoLab Weekly Review",
            body: "Your weekly diabetes management trends and report insights are ready.",
            channelId: NOTIFICATION_CHANNELS.SUMMARIES.id,
            actionTypeId: ACTION_TYPES.SUMMARY_ACTION,
            schedule: {
              on: {
                weekday: weekday as any,
                hour,
                minute,
              },
              allowWhileIdle: true,
            },
            foreground: true,
            extra: {
              category: "summary_weekly" as NotificationCategory,
              userId: settings.userId,
            },
          });
        }
      }

      // Batch schedule all created notifications
      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule,
        });
      }

      console.log(`[NotificationScheduler] Scheduled ${notificationsToSchedule.length} local notifications successfully.`);
      return { scheduledCount: notificationsToSchedule.length, errors };
    } catch (err: any) {
      console.error("[NotificationScheduler] Error scheduling notifications:", err);
      errors.push(err?.message || "Failed to schedule notifications.");
      return { scheduledCount: 0, errors };
    }
  },

  /**
   * Schedule a temporary snooze notification (e.g. +15 mins)
   */
  async snoozeNotification(
    originalNotificationId: number,
    title: string,
    body: string,
    channelId: string,
    actionTypeId: string,
    category: NotificationCategory,
    extra: Record<string, any>,
    durationMinutes: number = 15
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const snoozeAt = new Date(Date.now() + durationMinutes * 60 * 1000);
      const snoozeId = 800000 + (Math.abs(originalNotificationId) % 90000) + Math.floor(Math.random() * 1000);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: snoozeId,
            title: `Snoozed: ${title}`,
            body,
            channelId,
            actionTypeId,
            schedule: {
              at: snoozeAt,
              allowWhileIdle: true,
            },
            foreground: true,
            extra: {
              ...extra,
              category,
              isSnooze: true,
              originalNotificationId,
            },
          },
        ],
      });
      console.log(`[NotificationScheduler] Snoozed notification scheduled for ${snoozeAt.toLocaleTimeString()}`);
    } catch (err) {
      console.warn("[NotificationScheduler] Failed to snooze notification:", err);
    }
  },

  /**
   * Cancel all notifications for a user (called upon logout)
   */
  async cancelAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Promise.race([
        LocalNotifications.cancelAll(),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      console.log("[NotificationScheduler] All pending notifications cancelled successfully.");
    } catch (err) {
      console.warn("[NotificationScheduler] Error cancelling notifications:", err);
    }
  },
};
