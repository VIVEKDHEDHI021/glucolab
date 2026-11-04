import assert from "node:assert/strict";
import {
  getLocalTimezone,
  parseLocalDate,
  getLocalToday,
  getLocalDateKey,
  formatLocalDate,
  getStartOfLocalDay,
  getEndOfLocalDay,
  addDaysLocal,
  subDaysLocal,
  isSameLocalDay,
  getLocalLookbackDateKeys,
} from "./src/frontend/lib/date-utils.js";

console.log("=== RUNNING DATE SYNCHRONIZATION TESTS ===");

// 1. Timezone detection defaults to Asia/Kolkata or system
const tz = getLocalTimezone();
assert.ok(tz && typeof tz === "string", "Timezone should be a non-empty string");
console.log(`[PASS] Detected timezone: ${tz}`);

// 2. Critical Test: Midnight / Early Morning UTC vs IST scenario
// When UTC is 2026-11-01T20:00:00Z (8 PM UTC on Nov 1), in IST (UTC+5:30) it is 2026-11-02T01:30:00 (1:30 AM Nov 2).
const lateUtcInstant = new Date("2026-11-01T20:00:00.000Z");
const dateInUtc = getLocalDateKey(lateUtcInstant, "UTC");
const dateInIst = getLocalDateKey(lateUtcInstant, "Asia/Kolkata");

assert.equal(dateInUtc, "2026-11-01", "In UTC, it should be 2026-11-01");
assert.equal(dateInIst, "2026-11-02", "In Asia/Kolkata, it MUST be 2026-11-02 (Not 1 Nov!)");
console.log(`[PASS] UTC date (${dateInUtc}) vs IST date (${dateInIst}) correctly distinguished.`);

// 3. parseLocalDate produces a safe local midnight
const parsed = parseLocalDate("2026-11-02");
assert.equal(parsed.getFullYear(), 2026);
assert.equal(parsed.getMonth(), 10); // 0-indexed: 10 = Nov
assert.equal(parsed.getDate(), 2);
console.log("[PASS] parseLocalDate correctly preserves calendar date");

// 4. Date arithmetic without UTC shift
const prevDay = subDaysLocal("2026-11-02", 1);
assert.equal(prevDay, "2026-11-01", "subDaysLocal(2026-11-02, 1) should be 2026-11-01");

const nextDay = addDaysLocal("2026-11-02", 1);
assert.equal(nextDay, "2026-11-03", "addDaysLocal(2026-11-02, 1) should be 2026-11-03");

const prevMonth = subDaysLocal("2026-11-01", 1);
assert.equal(prevMonth, "2026-10-31", "subDaysLocal across month boundary should be 2026-10-31");
console.log("[PASS] Local date arithmetic handles month boundaries safely");

// 5. Start and End of local day in UTC instants for Supabase queries
const startIst = getStartOfLocalDay("2026-11-02", "Asia/Kolkata");
const endIst = getEndOfLocalDay("2026-11-02", "Asia/Kolkata");

// Asia/Kolkata is UTC+5:30. Midnight 2026-11-02 IST is 2026-11-01T18:30:00.000Z
assert.equal(startIst.toISOString(), "2026-11-01T18:30:00.000Z", "Start of 2 Nov IST in UTC");
// 23:59:59.999 IST is 2026-11-02T18:29:59.999Z
assert.equal(endIst.toISOString(), "2026-11-02T18:29:59.999Z", "End of 2 Nov IST in UTC");
console.log(`[PASS] Day boundary conversion: ${startIst.toISOString()} to ${endIst.toISOString()}`);

// 6. Lookback window keys
const lookback = getLocalLookbackDateKeys(3, new Date("2026-11-02T10:00:00Z"), "Asia/Kolkata");
assert.deepEqual(lookback, ["2026-11-02", "2026-11-01", "2026-10-31"]);
console.log("[PASS] Lookback keys are accurate and chronological:", lookback);

// 7. formatLocalDate
const formatted = formatLocalDate("2026-11-02", "MMM d, yyyy");
assert.equal(formatted, "Nov 2, 2026");
console.log(`[PASS] Formatted local date: ${formatted}`);

console.log("\nALL DATE SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! (7/7)");

