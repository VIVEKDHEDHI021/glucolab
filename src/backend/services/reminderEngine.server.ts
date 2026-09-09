import { supabaseAdmin } from "../../db/client.server";
import { fcmServiceServer } from "./fcmService.server";

export interface PatientReminderSettings {
  id: string;
  user_id: string;
  insulin_reminder_enabled: boolean;
  insulin_reminder_time: string; // e.g. "20:00"
  glucose_reminder_enabled: boolean;
  glucose_reminder_days: number; // e.g. 2
  last_insulin_reminder_at: string | null;
  last_glucose_reminder_at: string | null;
  user_timezone: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderCheckResult {
  userId: string;
  insulinReminderSent: boolean;
  glucoseReminderSent: boolean;
  reasonInsulin?: string;
  reasonGlucose?: string;
}

/**
 * Get current date (YYYY-MM-DD) and time (HH:mm) formatted in a given timezone
 */
export function getZonedDateAndTime(date: Date, timezone: string = "UTC"): {
  dateStr: string;
  timeStr: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = getPart("hour");
    const minute = getPart("minute");

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hour}:${minute}`,
    };
  } catch {
    // Fallback to UTC if timezone string is invalid
    const iso = date.toISOString();
    return {
      dateStr: iso.substring(0, 10),
      timeStr: iso.substring(11, 16),
    };
  }
}

/**
 * Pure Decision Function: Check whether an Insulin Reminder should be dispatched
 */
export function shouldSendInsulinReminder(
  settings: PatientReminderSettings,
  todayInsulinExists: boolean,
  now: Date = new Date(),
  timezoneOverride?: string,
): { shouldSend: boolean; reason: string } {
  if (!settings.insulin_reminder_enabled) {
    return { shouldSend: false, reason: "Insulin reminder is disabled in settings." };
  }

  const tz = timezoneOverride || settings.user_timezone || "UTC";
  const { dateStr: todayDateStr, timeStr: currentTimeStr } = getZonedDateAndTime(now, tz);

  // 1. Check if current time has reached the configured reminder time
  const targetTime = settings.insulin_reminder_time || "20:00";
  if (currentTimeStr < targetTime) {
    return {
      shouldSend: false,
      reason: `Current time (${currentTimeStr}) is before reminder time (${targetTime}).`,
    };
  }

  // 2. Check if an insulin entry already exists for today
  if (todayInsulinExists) {
    return {
      shouldSend: false,
      reason: `Insulin dose has already been recorded for today (${todayDateStr}).`,
    };
  }

  // 3. Anti-Spam: Check if an insulin reminder was already sent today
  if (settings.last_insulin_reminder_at) {
    const { dateStr: lastSentDateStr } = getZonedDateAndTime(
      new Date(settings.last_insulin_reminder_at),
      tz,
    );
    if (lastSentDateStr === todayDateStr) {
      return {
        shouldSend: false,
        reason: `Insulin reminder was already sent today (${todayDateStr}). Anti-spam active.`,
      };
    }
  }

  return {
    shouldSend: true,
    reason: `Insulin dose missing for today (${todayDateStr}) at ${currentTimeStr}. Triggering reminder.`,
  };
}

/**
 * Pure Decision Function: Check whether a Glucose Check Reminder should be dispatched
 */
export function shouldSendGlucoseReminder(
  settings: PatientReminderSettings,
  latestGlucoseDate: Date | string | null,
  now: Date = new Date(),
  timezoneOverride?: string,
): { shouldSend: boolean; reason: string } {
  if (!settings.glucose_reminder_enabled) {
    return { shouldSend: false, reason: "Glucose check reminder is disabled in settings." };
  }

  const thresholdDays = Math.max(1, Number(settings.glucose_reminder_days) || 2);
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  // If no reading was ever logged
  if (!latestGlucoseDate) {
    if (settings.last_glucose_reminder_at) {
      return {
        shouldSend: false,
        reason: "No glucose readings logged; initial reminder already sent. Anti-spam active.",
      };
    }
    return {
      shouldSend: true,
      reason: "No glucose readings recorded. Initial check reminder triggered.",
    };
  }

  const latestDateObj = typeof latestGlucoseDate === "string" ? new Date(latestGlucoseDate) : latestGlucoseDate;
  const latestMs = latestDateObj.getTime();
  const elapsedMs = nowMs - latestMs;

  // 1. Check if elapsed time meets or exceeds the inactivity threshold
  if (elapsedMs < thresholdMs) {
    const elapsedDays = (elapsedMs / (24 * 60 * 60 * 1000)).toFixed(1);
    return {
      shouldSend: false,
      reason: `Recent glucose reading exists (${elapsedDays} days ago < ${thresholdDays} days threshold).`,
    };
  }

  // 2. Anti-Spam: Check if a reminder was already sent since the latest reading
  if (settings.last_glucose_reminder_at) {
    const lastSentMs = new Date(settings.last_glucose_reminder_at).getTime();
    if (lastSentMs > latestMs) {
      return {
        shouldSend: false,
        reason: "Glucose reminder was already sent for this inactivity period. Anti-spam active until a new reading is logged.",
      };
    }
  }

  return {
    shouldSend: true,
    reason: `Inactivity threshold reached (>= ${thresholdDays} days since last reading). Triggering reminder.`,
  };
}

export const reminderEngine = {
  /**
   * Evaluate reminders for a single patient and dispatch FCM pushes if required
   */
  async evaluateUser(userId: string, client?: any): Promise<ReminderCheckResult> {
    const db = client || supabaseAdmin;

    // 1. Fetch user reminder settings
    const { data: settings, error: settingsError } = await db
      .from("patient_reminder_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (settingsError || !settings) {
      return {
        userId,
        insulinReminderSent: false,
        glucoseReminderSent: false,
        reasonInsulin: "No reminder settings found for user.",
        reasonGlucose: "No reminder settings found for user.",
      };
    }

    const now = new Date();
    const tz = settings.user_timezone || "UTC";
    const { dateStr: todayDateStr } = getZonedDateAndTime(now, tz);

    let insulinReminderSent = false;
    let glucoseReminderSent = false;
    let reasonInsulin = "";
    let reasonGlucose = "";

    // ==========================================
    // 2. INSULIN REMINDER EVALUATION
    // ==========================================
    if (settings.insulin_reminder_enabled) {
      // Check database for today's insulin record
      const { data: todayInsulin } = await db
        .from("insulin_entries")
        .select("id")
        .eq("user_id", userId)
        .eq("entry_date", todayDateStr)
        .maybeSingle();

      const insulinDecision = shouldSendInsulinReminder(
        settings,
        Boolean(todayInsulin),
        now,
        tz,
      );
      reasonInsulin = insulinDecision.reason;

      if (insulinDecision.shouldSend) {
        console.log(`[Reminder Engine] Dispatching Insulin Reminder to user ${userId}...`);

        const pushRes = await fcmServiceServer.sendToUser(
          userId,
          {
            title: "GlucoLab",
            body: "Don't forget to record today's insulin dose.",
            data: {
              type: "insulin_reminder",
              action: "open_insulin",
            },
          },
          db,
        );

        if (pushRes.success) {
          insulinReminderSent = true;
          // Update last_insulin_reminder_at timestamp
          await db
            .from("patient_reminder_settings")
            .update({
              last_insulin_reminder_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);
        }
      }
    } else {
      reasonInsulin = "Insulin reminder is disabled.";
    }

    // ==========================================
    // 3. GLUCOSE CHECK REMINDER EVALUATION
    // ==========================================
    if (settings.glucose_reminder_enabled) {
      // Find latest glucose entry
      const { data: latestGlucose } = await db
        .from("glucose_entries")
        .select("date_time")
        .eq("user_id", userId)
        .order("date_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      const latestGlucoseDate = latestGlucose?.date_time ? new Date(latestGlucose.date_time) : null;
      const glucoseDecision = shouldSendGlucoseReminder(
        settings,
        latestGlucoseDate,
        now,
        tz,
      );
      reasonGlucose = glucoseDecision.reason;

      if (glucoseDecision.shouldSend) {
        console.log(`[Reminder Engine] Dispatching Glucose Check Reminder to user ${userId}...`);

        const pushRes = await fcmServiceServer.sendToUser(
          userId,
          {
            title: "GlucoLab",
            body: "You haven't recorded a glucose reading recently. Remember to check and record it if appropriate.",
            data: {
              type: "glucose_reminder",
              action: "open_glucose",
            },
          },
          db,
        );

        if (pushRes.success) {
          glucoseReminderSent = true;
          // Update last_glucose_reminder_at timestamp
          await db
            .from("patient_reminder_settings")
            .update({
              last_glucose_reminder_at: now.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq("user_id", userId);
        }
      }
    } else {
      reasonGlucose = "Glucose check reminder is disabled.";
    }

    return {
      userId,
      insulinReminderSent,
      glucoseReminderSent,
      reasonInsulin,
      reasonGlucose,
    };
  },

  /**
   * Evaluate reminders for all patients who have either insulin or glucose reminders enabled
   */
  async evaluateAllUsers(client?: any): Promise<ReminderCheckResult[]> {
    const db = client || supabaseAdmin;

    const { data: activeSettings, error } = await db
      .from("patient_reminder_settings")
      .select("user_id")
      .or("insulin_reminder_enabled.eq.true,glucose_reminder_enabled.eq.true");

    if (error || !activeSettings || activeSettings.length === 0) {
      console.log("[Reminder Engine] No active patient reminder configurations found.");
      return [];
    }

    console.log(
      `[Reminder Engine] Evaluating reminders for ${activeSettings.length} active patient(s)...`,
    );

    const results: ReminderCheckResult[] = [];
    for (const item of activeSettings) {
      try {
        const res = await this.evaluateUser(item.user_id, db);
        results.push(res);
      } catch (userErr) {
        console.error(`[Reminder Engine] Error processing user ${item.user_id}:`, userErr);
      }
    }

    return results;
  },
};
