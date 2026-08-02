import { Capacitor } from "@capacitor/core";
import { format, addDays, parseISO, setHours, setMinutes, startOfDay, isAfter, isBefore } from "date-fns";
import type { Reminder, ReminderCategory } from "../types";
import { reminderService } from "../services/reminderService";

const isMobile = Capacitor.isNativePlatform();

// Helper to convert string UUID into 32-bit integer for Capacitor IDs
export function hashStringToId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Action Group mapping for Capacitor buttons
const ACTION_GROUPS = {
  insulin: "INSULIN_ACTIONS",
  medication: "MED_ACTIONS",
  glucose: "GLUCOSE_ACTIONS",
  water: "WATER_ACTIONS",
  default: "DEFAULT_ACTIONS",
};

export const reminderScheduler = {
  // Setup action groups for mobile local notifications
  async registerNotificationActions() {
    if (!isMobile) return;

    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: ACTION_GROUPS.insulin,
            actions: [
              { id: "taken", title: "Mark Taken", foreground: true },
              { id: "snooze", title: "Snooze 10m", foreground: false },
              { id: "skip", title: "Skip", foreground: false },
            ],
          },
          {
            id: ACTION_GROUPS.medication,
            actions: [
              { id: "taken", title: "Taken", foreground: true },
              { id: "snooze", title: "Snooze 10m", foreground: false },
              { id: "skip", title: "Skip", foreground: false },
            ],
          },
          {
            id: ACTION_GROUPS.glucose,
            actions: [
              { id: "scan", title: "Scan Meter", foreground: true },
              { id: "manual_entry", title: "Manual Log", foreground: true },
              { id: "snooze", title: "Snooze 10m", foreground: false },
            ],
          },
          {
            id: ACTION_GROUPS.water,
            actions: [
              { id: "taken", title: "Drank 250ml", foreground: true },
              { id: "snooze", title: "Later", foreground: false },
            ],
          },
          {
            id: ACTION_GROUPS.default,
            actions: [
              { id: "done", title: "Done", foreground: true },
              { id: "snooze", title: "Snooze", foreground: false },
            ],
          },
        ],
      });
      console.log("[SCHEDULER] Capacitor notification actions registered.");
    } catch (err) {
      console.error("[SCHEDULER] Failed to register notification actions:", err);
    }
  },

  // Calculate upcoming trigger dates for a reminder config over the next N days
  getUpcomingScheduledTimes(reminder: Reminder, maxDays = 7): Date[] {
    const times: Date[] = [];
    const now = new Date();
    const todayStart = startOfDay(now);

    const parseTimeStr = (timeStr: string, baseDate: Date): Date => {
      const [h, m] = timeStr.split(":").map(Number);
      let d = setHours(baseDate, h);
      d = setMinutes(d, m);
      // reset seconds/millis
      d.setSeconds(0);
      d.setMilliseconds(0);
      return d;
    };

    // Calculate dates to check
    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const checkDate = addDays(todayStart, dayOffset);
      const weekday = checkDate.getDay(); // 0 is Sunday, 1 is Monday

      // 1. Check schedule type rules
      let shouldSchedule = false;

      if (reminder.schedule_type === "daily") {
        shouldSchedule = true;
      } else if (reminder.schedule_type === "weekly") {
        // e.g. schedule_data.days contains weekday
        shouldSchedule = reminder.schedule_data.days?.includes(weekday) ?? false;
      } else if (reminder.schedule_type === "custom_days") {
        shouldSchedule = reminder.schedule_data.days?.includes(weekday) ?? false;
      } else if (reminder.schedule_type === "one_time") {
        if (reminder.schedule_data.date) {
          const reminderDate = startOfDay(parseISO(reminder.schedule_data.date));
          shouldSchedule = checkDate.getTime() === reminderDate.getTime();
        }
      } else if (reminder.schedule_type === "interval") {
        shouldSchedule = true;
      }

      if (!shouldSchedule) continue;

      // 2. Generate times for this checkDate
      if (reminder.schedule_type === "interval") {
        const interval = reminder.schedule_data.intervalMinutes || 60;
        const startStr = reminder.schedule_data.intervalStart || "08:00";
        const endStr = reminder.schedule_data.intervalEnd || "22:00";

        const startLimit = parseTimeStr(startStr, checkDate);
        const endLimit = parseTimeStr(endStr, checkDate);

        let runningTime = new Date(startLimit);
        while (isBefore(runningTime, endLimit) || runningTime.getTime() === endLimit.getTime()) {
          if (isAfter(runningTime, now)) {
            times.push(new Date(runningTime));
          }
          runningTime = new Date(runningTime.getTime() + interval * 60000);
        }
      } else {
        const scheduleTimes = reminder.schedule_data.times || [];
        for (const tStr of scheduleTimes) {
          const scheduledDate = parseTimeStr(tStr, checkDate);
          if (isAfter(scheduledDate, now)) {
            times.push(scheduledDate);
          }
        }
      }
    }

    return times;
  },

  // Schedules local alarms for all reminders
  async scheduleAllReminders(userId: string) {
    await this.registerNotificationActions();

    try {
      const reminders = await reminderService.getReminders(userId);
      const activeReminders = reminders.filter((r) => r.is_enabled);

      if (isMobile) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        
        // 1. Cancel previous notifications
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({
            notifications: pending.notifications.map((n) => ({ id: n.id })),
          });
        }

        // 2. Schedule next 7 days of instances
        const notificationsToSchedule: any[] = [];

        for (const r of activeReminders) {
          const triggerTimes = this.getUpcomingScheduledTimes(r, 7);
          const catActions = ACTION_GROUPS[r.category as keyof typeof ACTION_GROUPS] || ACTION_GROUPS.default;

          for (const time of triggerTimes) {
            const timeStr = time.toISOString();
            // Create a unique numeric ID based on reminder ID + ISO Time String
            const uniqueId = hashStringToId(`${r.id}_${timeStr}`);

            notificationsToSchedule.push({
              id: uniqueId,
              title: r.title,
              body: r.description || `Time for your ${r.category} reminder.`,
              schedule: { at: time },
              sound: r.sound === "default" ? undefined : `${r.sound}.wav`,
              actionTypeId: catActions,
              extra: {
                reminderId: r.id,
                category: r.category,
                scheduledTime: timeStr,
              },
            });
          }
        }

        if (notificationsToSchedule.length > 0) {
          // Capacitor supports scheduling up to 64 local notifications at once safely
          const batch = notificationsToSchedule.slice(0, 64);
          await LocalNotifications.schedule({ notifications: batch });
          console.log(`[SCHEDULER] Scheduled ${batch.length} native alarms.`);
        }
      } else {
        console.log(`[SCHEDULER] Web fallback: Calculated ${activeReminders.length} active configurations.`);
      }
    } catch (err) {
      console.error("[SCHEDULER] Error scheduling alarms:", err);
    }
  },

  // Schedules a snooze notification (triggers in 10 minutes)
  async scheduleSnooze(reminderId: string, category: string, title: string, body: string) {
    const triggerTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes later
    const timeStr = triggerTime.toISOString();
    const uniqueId = hashStringToId(`${reminderId}_snooze_${timeStr}`);

    if (isMobile) {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const catActions = ACTION_GROUPS[category as keyof typeof ACTION_GROUPS] || ACTION_GROUPS.default;

        await LocalNotifications.schedule({
          notifications: [
            {
              id: uniqueId,
              title: `[Snoozed] ${title}`,
              body,
              schedule: { at: triggerTime },
              actionTypeId: catActions,
              extra: {
                reminderId,
                category,
                scheduledTime: timeStr,
                isSnooze: true,
              },
            },
          ],
        });
        console.log("[SCHEDULER] Snoozed native alarm registered in 10 mins.");
      } catch (err) {
        console.error("[SCHEDULER] Failed to schedule native snooze:", err);
      }
    } else {
      console.log(`[SCHEDULER] Web fallback: Snoozed alarm scheduled at ${triggerTime.toLocaleTimeString()}`);
    }
  },
};
