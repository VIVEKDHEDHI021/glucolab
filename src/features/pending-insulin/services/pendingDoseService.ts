import { supabase } from "@/db/client";
import { getLocalDbService } from "@/db/client";
import { insulinValidationService } from "./insulinValidationService";
import { insulinScheduleService } from "./insulinScheduleService";
import type { PendingDoseSlot, ScheduledSlotSummary } from "../types";
import {
  getLocalTimezone,
  getLocalDateKey,
  subDaysLocal,
  formatLocalDate,
} from "@/frontend/lib/date-utils";

/**
 * Format "HH:mm" (24h) to "h:mm A" (12h) e.g. "19:00" -> "7:00 PM"
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  let hours = parseInt(hStr, 10);
  const minutes = mStr || "00";
  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' becomes '12'
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Get date parts in a specific timezone, defaulting to local timezone
 */
export function getZonedDateParts(
  date: Date,
  timezone: string = getLocalTimezone(),
): { dateStr: string; timeStr: string; year: number; month: number; day: number } {
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

    const year = parseInt(getPart("year"), 10);
    const month = parseInt(getPart("month"), 10);
    const day = parseInt(getPart("day"), 10);
    const hour = getPart("hour");
    const minute = getPart("minute");

    return {
      dateStr: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
      timeStr: `${hour}:${minute}`,
      year,
      month,
      day,
    };
  } catch {
    const dateStr = getLocalDateKey(date);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return {
      dateStr,
      timeStr: `${hours}:${minutes}`,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

/**
 * Construct a Date object from a date string (YYYY-MM-DD) and time string (HH:mm) in timezone
 */
export function createDateInTimezone(dateStr: string, timeStr: string, timezone: string = getLocalTimezone()): Date {
  try {
    const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10));
    const [hours, minutes] = timeStr.split(":").map((v) => parseInt(v, 10));

    const utcBase = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

    const parts = formatter.formatToParts(utcBase);
    const getVal = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

    const tzHour = getVal("hour") % 24;
    const tzMinute = getVal("minute");
    const tzDay = getVal("day");

    let diffMinutes = (hours - tzHour) * 60 + (minutes - tzMinute);
    if (tzDay > day) diffMinutes -= 24 * 60;
    if (tzDay < day) diffMinutes += 24 * 60;

    return new Date(utcBase.getTime() + diffMinutes * 60 * 1000);
  } catch {
    return new Date(`${dateStr}T${timeStr}:00`);
  }
}

/**
 * Format relative date display: "Today", "Yesterday", or "MMM d"
 */
export function formatDisplayDate(dateStr: string, todayStr?: string, yesterdayStr?: string): string {
  const currentToday = todayStr || getLocalDateKey();
  const currentYesterday = yesterdayStr || subDaysLocal(currentToday, 1);

  if (dateStr === currentToday) return "Today";
  if (dateStr === currentYesterday) return "Yesterday";
  try {
    const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10));
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export const DEFAULT_LOOKBACK_DAYS = 7;

// In-flight save prevention map
const inFlightSaves = new Set<string>();

// In-flight window query deduplication cache
let inFlightWindowQuery: { key: string; promise: Promise<Map<string, any>> } | null = null;
const cachedWindowEntries = new Map<string, { timestamp: number; data: Map<string, any> }>();

/**
 * Generate date strings (YYYY-MM-DD) for the lookback window in the given timezone, oldest first.
 */
export function getLookbackDateStrings(
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  now: Date = new Date(),
  timezone: string = getLocalTimezone(),
): string[] {
  const dates: string[] = [];
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const { dateStr } = getZonedDateParts(d, timezone);
    if (!dates.includes(dateStr)) {
      dates.push(dateStr);
    }
  }
  return dates;
}

export const pendingDoseService = {
  /**
   * Internal deduplicated & cached fetch for lookback window entries
   */
  async fetchEntriesForWindow(userId: string, evaluationDates: string[]): Promise<Map<string, any>> {
    const sortedDates = [...evaluationDates].sort();
    const key = `${userId}_${sortedDates.join(",")}`;
    const nowMs = Date.now();

    const cached = cachedWindowEntries.get(key);
    if (cached && nowMs - cached.timestamp < 10000) {
      return cached.data;
    }

    if (inFlightWindowQuery && inFlightWindowQuery.key === key) {
      return inFlightWindowQuery.promise;
    }

    const queryPromise = (async () => {
      try {
        const { data: entries, error } = await supabase
          .from("insulin_entries")
          .select("*")
          .eq("user_id", userId)
          .in("entry_date", sortedDates);

        if (error) {
          console.warn("[PendingDoseService] Error fetching insulin entries:", error);
        }

        const entriesByDate = new Map<string, any>();
        if (entries) {
          for (const entry of entries) {
            entriesByDate.set(entry.entry_date, entry);
          }
        }

        cachedWindowEntries.set(key, { timestamp: Date.now(), data: entriesByDate });
        return entriesByDate;
      } finally {
        if (inFlightWindowQuery && inFlightWindowQuery.key === key) {
          inFlightWindowQuery = null;
        }
      }
    })();

    inFlightWindowQuery = { key, promise: queryPromise };
    return queryPromise;
  },

  /**
   * Evaluate and return all pending insulin doses for user across the lookback period, sorted oldest first
   */
  async getPendingDoses(
    userId: string,
    now: Date = new Date(),
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  ): Promise<PendingDoseSlot[]> {
    if (!userId) return [];

    try {
      // 1. Fetch configured clinical schedules
      const userSchedules = insulinScheduleService.getSchedules(userId);
      const activeSchedules = userSchedules.filter((s) => s.enabled);
      if (activeSchedules.length === 0) return [];

      const tz = getLocalTimezone();
      const todayStr = getLocalDateKey(now);
      const { timeStr: currentTimeStr } = getZonedDateParts(now, tz);
      const yesterdayStr = subDaysLocal(todayStr, 1);

      // Generate evaluation dates (oldest first, e.g. 7 days ago to today)
      const evaluationDates = getLookbackDateStrings(lookbackDays, now, tz);

      // 2. Fetch existing insulin entries for these dates using shared deduplicated cache
      const entriesByDate = await this.fetchEntriesForWindow(userId, evaluationDates);

      const pendingDoses: PendingDoseSlot[] = [];

      for (const evalDate of evaluationDates) {
        const entry = entriesByDate.get(evalDate);
        const isToday = evalDate === todayStr;

        for (const sched of activeSchedules) {
          // Future check: if evaluation date is today and scheduled time has not arrived yet, skip!
          if (isToday && sched.time > currentTimeStr) {
            continue;
          }

          // Check if slot has already been recorded in insulin_entries
          const dbColumn = insulinScheduleService.mapSlotToDbColumn(sched.id);
          const recordedVal = entry ? Number(entry[dbColumn]) : 0;

          if (!recordedVal || recordedVal <= 0) {
            const scheduledDateTime = createDateInTimezone(evalDate, sched.time, tz);
            pendingDoses.push({
              id: `${evalDate}_${sched.id}`,
              date: evalDate,
              displayDate: formatDisplayDate(evalDate, todayStr, yesterdayStr),
              slotId: sched.id,
              dbColumn,
              slotName: sched.label,
              time: sched.time,
              displayTime: formatTime12h(sched.time),
              scheduledDateTime,
              status: "pending",
              recordedUnits: null,
            });
          }
        }
      }

      // Sort chronologically: OLDEST pending dose first
      pendingDoses.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());

      return pendingDoses;
    } catch (err) {
      console.error("[PendingDoseService] Unexpected error evaluating pending doses:", err);
      return [];
    }
  },

  /**
   * Get all scheduled slots for the lookback window with their current status (pending, upcoming, completed)
   * Used by the "Change Slot" selector interface.
   */
  async getAllScheduledSlotsForWindow(
    userId: string,
    now: Date = new Date(),
    lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  ): Promise<ScheduledSlotSummary[]> {
    if (!userId) return [];

    try {
      const userSchedules = insulinScheduleService.getSchedules(userId);
      const activeSchedules = userSchedules.filter((s) => s.enabled);
      if (activeSchedules.length === 0) return [];

      const tz = getLocalTimezone();
      const todayStr = getLocalDateKey(now);
      const { timeStr: currentTimeStr } = getZonedDateParts(now, tz);
      const yesterdayStr = subDaysLocal(todayStr, 1);

      const evaluationDates = getLookbackDateStrings(lookbackDays, now, tz);

      // Re-use deduplicated cache
      const entriesByDate = await this.fetchEntriesForWindow(userId, evaluationDates);

      const results: ScheduledSlotSummary[] = [];

      for (const evalDate of evaluationDates) {
        const entry = entriesByDate.get(evalDate);
        const isToday = evalDate === todayStr;

        for (const sched of activeSchedules) {
          const dbColumn = insulinScheduleService.mapSlotToDbColumn(sched.id);
          const recordedVal = entry ? Number(entry[dbColumn]) : 0;
          const isCompleted = Boolean(recordedVal && recordedVal > 0);
          const isUpcoming = isToday && sched.time > currentTimeStr;

          const scheduledDateTime = createDateInTimezone(evalDate, sched.time, tz);

          let status: "pending" | "upcoming" | "completed" = "pending";
          if (isCompleted) {
            status = "completed";
          } else if (isUpcoming) {
            status = "upcoming";
          } else {
            status = "pending";
          }

          results.push({
            id: `${evalDate}_${sched.id}`,
            date: evalDate,
            displayDate: formatDisplayDate(evalDate, todayStr, yesterdayStr),
            slotId: sched.id,
            dbColumn,
            slotName: sched.label,
            time: sched.time,
            displayTime: formatTime12h(sched.time),
            scheduledDateTime,
            status,
            recordedUnits: isCompleted ? recordedVal : null,
          });
        }
      }

      // Sort chronological: oldest first
      results.sort((a, b) => a.scheduledDateTime.getTime() - b.scheduledDateTime.getTime());
      return results;
    } catch (e) {
      console.error("[PendingDoseService] Error getting all scheduled slots:", e);
      return [];
    }
  },

  /**
   * Save a dose for a specific pending slot with duplicate and validation safety
   */
  async saveDose(
    userId: string,
    slot: PendingDoseSlot,
    units: number,
    notes?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!userId) return { success: false, error: "Missing user identification." };

    // 1. In-flight simultaneous save lock
    const saveKey = `${userId}_${slot.date}_${slot.slotId}`;
    if (inFlightSaves.has(saveKey)) {
      return { success: false, error: "A save is already in progress for this dose." };
    }
    inFlightSaves.add(saveKey);

    try {
      // 2. Validate inputs
      const validation = insulinValidationService.validateSavePayload(units, slot, notes);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const dbCol = slot.dbColumn || insulinScheduleService.mapSlotToDbColumn(slot.slotId);

      // 3. Race condition & duplicate protection: Re-check latest database state
      const { data: latestRow, error: checkError } = await supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("entry_date", slot.date)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        console.warn("[PendingDoseService] Warning checking existing insulin record:", checkError);
      }

      if (latestRow && Number(latestRow[dbCol]) > 0) {
        return {
          success: false,
          error: "This dose has already been recorded.",
        };
      }

      // 4. Prepare payload for upsert (preserves other slots for the same date)
      const existingNotes = (latestRow as any)?.notes || null;
      const updatedNotes = notes?.trim()
        ? existingNotes
          ? `${existingNotes}\n${notes.trim()}`
          : notes.trim()
        : existingNotes;

      const payload: any = {
        user_id: userId,
        entry_date: slot.date,
        morning: latestRow?.morning ?? 0,
        afternoon: (latestRow as any)?.afternoon ?? 0,
        lunch: latestRow?.lunch ?? 0,
        evening: latestRow?.evening ?? 0,
        night: latestRow?.night ?? 0,
        [dbCol]: units,
        notes: updatedNotes,
      };

      if (latestRow?.id) {
        payload.id = latestRow.id;
      }

      // 5. Upsert into Supabase with database-level uniqueness on (user_id, entry_date)
      const { data: upsertData, error: upsertError } = await supabase
        .from("insulin_entries")
        .upsert(payload, { onConflict: "user_id,entry_date" })
        .select()
        .maybeSingle();

      if (upsertError) {
        console.error("[PendingDoseService] Upsert error:", upsertError);
        return { success: false, error: upsertError.message || "Failed to save insulin entry." };
      }

      const savedRow = upsertData || payload;

      // 6. Update local offline SQLite cache
      try {
        const localDb = await getLocalDbService();
        await localDb.cacheInsulin([
          {
            ...savedRow,
            id: savedRow.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${userId}_${slot.date}`),
          },
        ]);
      } catch (cacheErr) {
        console.warn("[PendingDoseService] Local cache update warning:", cacheErr);
      }

      // 7. Dispatch global event to immediately update charts, widgets, and data-context
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("health-data-updated"));
      }

      return { success: true };
    } catch (err: any) {
      console.error("[PendingDoseService] Unexpected error saving dose:", err);
      return { success: false, error: err?.message || "An unexpected error occurred while saving." };
    } finally {
      inFlightSaves.delete(saveKey);
    }
  },
};
