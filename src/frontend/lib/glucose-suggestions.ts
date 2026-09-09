import type { ReadingType } from "./types";

/**
 * Convenience time-window mapping for smart glucose reading type suggestion based on local time.
 * Note: These are application convenience suggestions only, not medical rules or advice.
 *
 * Windows:
 * - 05:00 AM – 07:59 AM -> Before Breakfast (BB)
 * - 08:00 AM – 10:59 AM -> After Breakfast (AB)
 * - 11:00 AM – 01:29 PM -> Before Lunch (BL)
 * - 01:30 PM – 04:29 PM -> After Lunch (AL)
 * - 04:30 PM – 07:29 PM -> Before Dinner (BD)
 * - 07:30 PM – 09:59 PM -> After Dinner (AD)
 * - 10:00 PM – 04:59 AM -> Bedtime (BT)
 */
export function getSuggestedReadingType(date: Date = new Date()): ReadingType {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 05:00 AM (300 min) – 07:59 AM (479 min) -> Before Breakfast (BB)
  if (totalMinutes >= 300 && totalMinutes < 480) {
    return "BB";
  }

  // 08:00 AM (480 min) – 10:59 AM (659 min) -> After Breakfast (AB)
  if (totalMinutes >= 480 && totalMinutes < 660) {
    return "AB";
  }

  // 11:00 AM (660 min) – 01:29 PM (809 min) -> Before Lunch (BL)
  if (totalMinutes >= 660 && totalMinutes < 810) {
    return "BL";
  }

  // 01:30 PM (810 min) – 04:29 PM (989 min) -> After Lunch (AL)
  if (totalMinutes >= 810 && totalMinutes < 990) {
    return "AL";
  }

  // 04:30 PM (990 min) – 07:29 PM (1169 min) -> Before Dinner (BD)
  if (totalMinutes >= 990 && totalMinutes < 1170) {
    return "BD";
  }

  // 07:30 PM (1170 min) – 09:59 PM (1319 min) -> After Dinner (AD)
  if (totalMinutes >= 1170 && totalMinutes < 1320) {
    return "AD";
  }

  // 10:00 PM (1320 min) – 04:59 AM (299 min) -> Bedtime (BT)
  return "BT";
}
