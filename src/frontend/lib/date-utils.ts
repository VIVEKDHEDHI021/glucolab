/**
 * GlucoLab Centralized Date & Time Utility
 *
 * Ensures consistent date handling across GlucoLab, strictly respecting
 * the user's local timezone (defaulting to Asia/Kolkata where appropriate),
 * preventing accidental UTC calendar day shifts, and providing standard
 * utilities for date arithmetic, day boundary calculations, and formatting.
 */

import { format, parseISO, startOfDay, endOfDay, subDays, addDays } from "date-fns";

export const DEFAULT_DEPLOYMENT_TIMEZONE = "Asia/Kolkata";

/**
 * Returns the effective user/device timezone, falling back to Asia/Kolkata
 */
export function getLocalTimezone(): string {
  try {
    const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (systemTz && systemTz.length > 0) {
      return systemTz;
    }
  } catch {
    // fallback
  }
  return DEFAULT_DEPLOYMENT_TIMEZONE;
}

/**
 * Parses a date or date-string into a local Date instance without UTC conversion errors.
 * If given a "YYYY-MM-DD" calendar date string, it interprets it as noon on that local calendar day.
 */
export function parseLocalDate(input?: Date | string | null): Date {
  if (!input) return new Date();

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    // If it's a date-only string like "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0); // midday avoids DST or boundary shifts
    }
    // If it has ISO time or other format
    try {
      return parseISO(trimmed);
    } catch {
      return new Date(trimmed);
    }
  }

  return new Date();
}

/**
 * Return a Date object representing the current moment in the user's environment
 */
export function getLocalToday(): Date {
  return new Date();
}

/**
 * Format a Date or date string to strict "YYYY-MM-DD" local calendar date key.
 * Respects provided timezone or getLocalTimezone(), never shifting day boundaries.
 */
export function getLocalDateKey(input?: Date | string | null, timezone?: string): string {
  const tz = timezone || getLocalTimezone();

  if (!input) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return format(new Date(), "yyyy-MM-dd");
    }
  }

  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }

  const d = input instanceof Date ? input : parseLocalDate(input);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return format(d, "yyyy-MM-dd");
  }
}

/**
 * Formats a date for UI presentation (e.g. "MMM d, yyyy" or custom format)
 */
export function formatLocalDate(input: Date | string, formatPattern: string = "MMM d, yyyy"): string {
  const d = parseLocalDate(input);
  return format(d, formatPattern);
}

/**
 * Return start of local day (00:00:00.000) as a Date instance in UTC for Supabase range queries
 */
export function getStartOfLocalDay(input?: Date | string | null, timezone?: string): Date {
  const tz = timezone || getLocalTimezone();
  const dateKey = getLocalDateKey(input, tz);
  const parts = dateKey.split("-").map(Number);
  const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));

  try {
    const tzDateStr = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    }).format(utcDate);

    const match = tzDateStr.match(/(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+):(\d+)/);
    if (match) {
      const [, m, day, yr, hr, min, sec] = match.map(Number);
      const localAsUtc = Date.UTC(yr, m - 1, day, hr === 24 ? 0 : hr, min, sec, 0);
      const offsetMs = localAsUtc - utcDate.getTime();
      return new Date(utcDate.getTime() - offsetMs);
    }
  } catch (err) {
    console.warn("[date-utils] getStartOfLocalDay fallback to standard startOfDay:", err);
  }

  return startOfDay(parseLocalDate(dateKey));
}

/**
 * Return end of local day (23:59:59.999) as a Date instance in UTC for Supabase range queries
 */
export function getEndOfLocalDay(input?: Date | string | null, timezone?: string): Date {
  const start = getStartOfLocalDay(input, timezone);
  return new Date(start.getTime() + 86400000 - 1);
}

/**
 * Get date keys for a lookback window (e.g. past 7 days up to today), newest first or oldest first.
 * Returns array of "YYYY-MM-DD" date strings.
 */
export function getLocalLookbackDateKeys(
  days: number = 7,
  baseDate?: Date,
  timezone?: string,
): string[] {
  const tz = timezone || getLocalTimezone();
  const todayKey = getLocalDateKey(baseDate || new Date(), tz);
  const keys: string[] = [todayKey];

  let currentKey = todayKey;
  for (let i = 1; i < days; i++) {
    currentKey = subDaysLocal(currentKey, 1);
    keys.push(currentKey);
  }
  return keys;
}

/**
 * Safe local day increment: returns "YYYY-MM-DD"
 */
export function addDaysLocal(dateKey: string, days: number = 1): string {
  const d = parseLocalDate(dateKey);
  return format(addDays(d, days), "yyyy-MM-dd");
}

/**
 * Safe local day decrement: returns "YYYY-MM-DD"
 */
export function subDaysLocal(dateKey: string, days: number = 1): string {
  const d = parseLocalDate(dateKey);
  return format(subDays(d, days), "yyyy-MM-dd");
}

/**
 * Returns true if two date representations resolve to the exact same calendar day
 */
export function isSameLocalDay(dateA: Date | string, dateB: Date | string, timezone?: string): boolean {
  return getLocalDateKey(dateA, timezone) === getLocalDateKey(dateB, timezone);
}

/**
 * Returns "YYYY-MM-DD" for yesterday in the user's local timezone
 */
export function getYesterdayDateKey(timezone?: string): string {
  const todayKey = getLocalDateKey(undefined, timezone);
  return subDaysLocal(todayKey, 1);
}
