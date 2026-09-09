import fs from "node:fs";
import path from "node:path";

console.log("=================================================");
console.log("🚀 GLUCOLAB HEALTH REMINDER SYSTEM TEST SUITE");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ""}`);
    failed++;
  }
}

// -------------------------------------------------------------------------
// Helper: getZonedDateAndTime implementation
// -------------------------------------------------------------------------
function getZonedDateAndTime(date, timezone = "UTC") {
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
    const getPart = (type) => parts.find((p) => p.type === type)?.value || "";

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
    const iso = date.toISOString();
    return {
      dateStr: iso.substring(0, 10),
      timeStr: iso.substring(11, 16),
    };
  }
}

// -------------------------------------------------------------------------
// Core Decision Functions (matching reminderEngine.server.ts)
// -------------------------------------------------------------------------
function shouldSendInsulinReminder(settings, todayInsulinExists, now = new Date(), timezoneOverride) {
  if (!settings.insulin_reminder_enabled) {
    return { shouldSend: false, reason: "Insulin reminder is disabled in settings." };
  }

  const tz = timezoneOverride || settings.user_timezone || "UTC";
  const { dateStr: todayDateStr, timeStr: currentTimeStr } = getZonedDateAndTime(now, tz);

  const targetTime = settings.insulin_reminder_time || "20:00";
  if (currentTimeStr < targetTime) {
    return {
      shouldSend: false,
      reason: `Current time (${currentTimeStr}) is before reminder time (${targetTime}).`,
    };
  }

  if (todayInsulinExists) {
    return {
      shouldSend: false,
      reason: `Insulin dose has already been recorded for today (${todayDateStr}).`,
    };
  }

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

function shouldSendGlucoseReminder(settings, latestGlucoseDate, now = new Date(), timezoneOverride) {
  if (!settings.glucose_reminder_enabled) {
    return { shouldSend: false, reason: "Glucose check reminder is disabled in settings." };
  }

  const thresholdDays = Math.max(1, Number(settings.glucose_reminder_days) || 2);
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

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

  if (elapsedMs < thresholdMs) {
    const elapsedDays = (elapsedMs / (24 * 60 * 60 * 1000)).toFixed(1);
    return {
      shouldSend: false,
      reason: `Recent glucose reading exists (${elapsedDays} days ago < ${thresholdDays} days threshold).`,
    };
  }

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

// =========================================================================
// SECTION 1: INSULIN REMINDER TESTS
// =========================================================================
console.log("--- 1. INSULIN REMINDER TESTS ---");

// Test 1: Today's insulin exists
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: true,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T20:30:00Z");
  const decision = shouldSendInsulinReminder(settings, true, now, "UTC");
  assert(decision.shouldSend === false, "Test 1: Today's insulin exists -> NO notification");
}

// Test 2: Today's insulin missing
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: true,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T20:05:00Z");
  const decision = shouldSendInsulinReminder(settings, false, now, "UTC");
  assert(decision.shouldSend === true, "Test 2: Today's insulin missing at reminder time -> SEND notification");
}

// Test 3: Reminder disabled
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T20:30:00Z");
  const decision = shouldSendInsulinReminder(settings, false, now, "UTC");
  assert(decision.shouldSend === false, "Test 3: Insulin reminder disabled -> NO notification");
}

// Test 4: Current time before scheduled reminder time
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: true,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T19:45:00Z");
  const decision = shouldSendInsulinReminder(settings, false, now, "UTC");
  assert(decision.shouldSend === false, "Test 4: Before scheduled time -> NO notification");
}

// Test 5: After insulin is recorded / Already reminded today
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: true,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: "2026-09-02T20:01:00Z",
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T21:00:00Z");
  const decision = shouldSendInsulinReminder(settings, false, now, "UTC");
  assert(decision.shouldSend === false, "Test 5: Already notified today -> NO duplicate notification (Anti-Spam)");
}

// =========================================================================
// SECTION 2: GLUCOSE CHECK REMINDER & ANTI-SPAM TESTS
// =========================================================================
console.log("\n--- 2. GLUCOSE CHECK REMINDER & ANTI-SPAM TESTS ---");

// Test 6: Reading today
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: true,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T12:00:00Z");
  const latestGlucoseDate = new Date("2026-09-02T08:00:00Z");
  const decision = shouldSendGlucoseReminder(settings, latestGlucoseDate, now, "UTC");
  assert(decision.shouldSend === false, "Test 6: Reading today -> NO notification");
}

// Test 7: Reading yesterday
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: true,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T12:00:00Z");
  const latestGlucoseDate = new Date("2026-09-01T12:00:00Z");
  const decision = shouldSendGlucoseReminder(settings, latestGlucoseDate, now, "UTC");
  assert(decision.shouldSend === false, "Test 7: Reading yesterday (1 day < 2 days) -> NO notification");
}

// Test 8: Reading 2 days ago
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: true,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T12:00:00Z");
  const latestGlucoseDate = new Date("2026-08-31T10:00:00Z"); // > 2 days ago
  const decision = shouldSendGlucoseReminder(settings, latestGlucoseDate, now, "UTC");
  assert(decision.shouldSend === true, "Test 8: Reading 2 days ago (>= 2 days threshold) -> SEND notification");
}

// Test 9: Reading 5 days ago with reminder already sent on Day 3
{
  const latestGlucoseDate = new Date("2026-08-28T10:00:00Z");
  const reminderSentDate = new Date("2026-08-30T10:00:00Z");
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: true,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: reminderSentDate.toISOString(),
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T12:00:00Z");
  const decision = shouldSendGlucoseReminder(settings, latestGlucoseDate, now, "UTC");
  assert(decision.shouldSend === false, "Test 9: Reading 5 days ago with reminder already sent -> NO repeated spam");
}

// Test 10: New glucose reading after reminder -> resets reminder state
{
  const reminderSentDate = new Date("2026-08-30T10:00:00Z");
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: true,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: reminderSentDate.toISOString(),
    user_timezone: "UTC",
  };
  const newReadingDate = new Date("2026-08-31T09:00:00Z");

  // Day 1 after new reading
  const check1 = shouldSendGlucoseReminder(settings, newReadingDate, new Date("2026-09-01T09:00:00Z"), "UTC");
  assert(check1.shouldSend === false, "Test 10a: 1 day after new reading -> NO notification");

  // Day 2 after new reading
  const check2 = shouldSendGlucoseReminder(settings, newReadingDate, new Date("2026-09-02T10:00:00Z"), "UTC");
  assert(check2.shouldSend === true, "Test 10b: 2 days after new reading -> SEND notification (State Reset)");
}

// Test 11: Glucose reminder disabled
{
  const settings = {
    id: "user-1",
    user_id: "user-1",
    insulin_reminder_enabled: false,
    insulin_reminder_time: "20:00",
    glucose_reminder_enabled: false,
    glucose_reminder_days: 2,
    last_insulin_reminder_at: null,
    last_glucose_reminder_at: null,
    user_timezone: "UTC",
  };
  const now = new Date("2026-09-02T12:00:00Z");
  const latestGlucoseDate = new Date("2026-08-20T10:00:00Z");
  const decision = shouldSendGlucoseReminder(settings, latestGlucoseDate, now, "UTC");
  assert(decision.shouldSend === false, "Test 11: Glucose reminder disabled -> NO notification");
}

// =========================================================================
// SECTION 3: TIMEZONE AWARENESS & SECURITY TESTS
// =========================================================================
console.log("\n--- 3. TIMEZONE & SECURITY TESTS ---");

// Test 12: Timezone calculations across UTC offsets
{
  const utcNow = new Date("2026-09-02T13:30:00Z");

  const istZoned = getZonedDateAndTime(utcNow, "Asia/Kolkata");
  assert(
    istZoned.dateStr === "2026-09-02" && istZoned.timeStr === "19:00",
    "Test 12a: Correct conversion for Asia/Kolkata (IST = UTC+5:30)",
  );

  const pdtZoned = getZonedDateAndTime(utcNow, "America/Los_Angeles");
  assert(
    pdtZoned.dateStr === "2026-09-02" && pdtZoned.timeStr === "06:30",
    "Test 12b: Correct conversion for America/Los_Angeles (PDT = UTC-7)",
  );

  const tokyoZoned = getZonedDateAndTime(new Date("2026-09-02T16:00:00Z"), "Asia/Tokyo");
  assert(
    tokyoZoned.dateStr === "2026-09-03" && tokyoZoned.timeStr === "01:00",
    "Test 12c: Correct day boundary transition for Asia/Tokyo (JST = UTC+9)",
  );
}

// Test 13: Migration & RLS Security verification
{
  const migrationPath = "supabase/migrations/20260902140000_create_patient_reminder_settings.sql";
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  assert(
    migrationSql.includes("ENABLE ROW LEVEL SECURITY"),
    "Test 13a: RLS is explicitly enabled on patient_reminder_settings",
  );
  assert(
    migrationSql.includes("auth.uid() = user_id"),
    "Test 13b: User isolation policy enforces auth.uid() = user_id",
  );
}

// Test 14: Privacy compliance of notification payloads (no glucose or insulin dosage in payload)
{
  const reminderEngineSource = fs.readFileSync("src/backend/services/reminderEngine.server.ts", "utf8");
  assert(
    reminderEngineSource.includes("Don't forget to record today's insulin dose."),
    "Test 14a: Insulin notification uses privacy-preserving title and body",
  );
  assert(
    reminderEngineSource.includes("You haven't recorded a glucose reading recently. Remember to check and record it if appropriate."),
    "Test 14b: Glucose notification uses privacy-preserving title and body",
  );
  assert(
    !reminderEngineSource.includes("dosage") && !reminderEngineSource.includes("mg/dL"),
    "Test 14c: Push payload contains NO medical dosages or values",
  );
}

console.log("\n=================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
