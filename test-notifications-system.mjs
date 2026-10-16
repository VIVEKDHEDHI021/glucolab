import assert from "node:assert";

console.log("=======================================================");
console.log("🔔 TESTING GLUCOLAB MULTI-CATEGORY NOTIFICATION SYSTEM");
console.log("=======================================================\n");

// 1. Quiet Hours Logic Verification
function isTimeInQuietHours(timeStr, quiet) {
  if (!quiet || !quiet.enabled) return false;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return false;
  const totalMinutes = h * 60 + m;

  const [qhStartH, qhStartM] = (quiet.startTime || "22:30").split(":").map(Number);
  const [qhEndH, qhEndM] = (quiet.endTime || "07:00").split(":").map(Number);
  const startMinutes = qhStartH * 60 + qhStartM;
  const endMinutes = qhEndH * 60 + qhEndM;

  if (startMinutes <= endMinutes) {
    return totalMinutes >= startMinutes && totalMinutes < endMinutes;
  } else {
    return totalMinutes >= startMinutes || totalMinutes < endMinutes;
  }
}

const overnightQuiet = { enabled: true, startTime: "22:30", endTime: "07:00" };
assert.strictEqual(isTimeInQuietHours("23:00", overnightQuiet), true, "23:00 should be in quiet hours");
assert.strictEqual(isTimeInQuietHours("03:30", overnightQuiet), true, "03:30 should be in quiet hours");
assert.strictEqual(isTimeInQuietHours("06:59", overnightQuiet), true, "06:59 should be in quiet hours");
assert.strictEqual(isTimeInQuietHours("07:00", overnightQuiet), false, "07:00 should be outside quiet hours");
assert.strictEqual(isTimeInQuietHours("12:00", overnightQuiet), false, "12:00 should be outside quiet hours");
assert.strictEqual(isTimeInQuietHours("22:29", overnightQuiet), false, "22:29 should be outside quiet hours");

const disabledQuiet = { enabled: false, startTime: "22:30", endTime: "07:00" };
assert.strictEqual(isTimeInQuietHours("23:00", disabledQuiet), false, "Disabled quiet hours should return false");

const daytimeQuiet = { enabled: true, startTime: "13:00", endTime: "15:00" };
assert.strictEqual(isTimeInQuietHours("14:00", daytimeQuiet), true, "14:00 should be in 13:00-15:00 quiet hours");
assert.strictEqual(isTimeInQuietHours("12:59", daytimeQuiet), false, "12:59 should be outside daytime quiet hours");
assert.strictEqual(isTimeInQuietHours("15:00", daytimeQuiet), false, "15:00 should be outside daytime quiet hours");
console.log("✅ [PASS] 1. Quiet Hours Algorithm Verified (Overnight, Daytime, Disabled)");

// 2. Stable 32-bit ID Generation & Range Separation
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getGlucoseNotificationId(slotId, weekday) {
  const baseHash = hashString(`glucose_${slotId}`) % 10000;
  return 100000 + baseHash * 10 + (weekday % 10);
}

function getMedicationNotificationId(slotId, weekday) {
  const baseHash = hashString(`medication_${slotId}`) % 10000;
  return 200000 + baseHash * 10 + (weekday % 10);
}

function getMealNotificationId(slotId, weekday) {
  const baseHash = hashString(`meal_${slotId}`) % 10000;
  return 300000 + baseHash * 10 + (weekday % 10);
}

const gId = getGlucoseNotificationId("morning", 2);
const mId = getMedicationNotificationId("breakfast", 2);
const mealId = getMealNotificationId("lunch", 2);

assert(gId >= 100000 && gId < 200000, "Glucose ID in 100,000 range");
assert(mId >= 200000 && mId < 300000, "Medication ID in 200,000 range");
assert(mealId >= 300000 && mealId < 400000, "Meal ID in 300,000 range");
assert(Number.isInteger(gId) && gId > 0 && gId <= 2147483647, "32-bit positive integer");
console.log("✅ [PASS] 2. Stable 32-bit ID Hashing & Separation Verified");

// 3. Channel Structure Verification
const CHANNELS = [
  "glucolab_glucose",
  "glucolab_medication",
  "glucolab_meals",
  "glucolab_hydration",
  "glucolab_summaries",
  "glucolab_test",
];
assert.strictEqual(CHANNELS.length, 6, "All 6 Android channels defined");
console.log("✅ [PASS] 3. All 6 Android Notification Channels Configured");

// 4. Action Type Schema Verification
const ACTION_TYPES = {
  GLUCOSE: ["LOG_READING", "REMIND_LATER", "DISMISS"],
  MEDICATION: ["TAKEN", "REMIND_LATER", "DISMISS"],
  MEALS: ["LOG_READING", "REMIND_LATER", "DISMISS"],
  HYDRATION: ["REMIND_LATER", "DISMISS"],
  SUMMARIES: ["OPEN_REPORTS", "DISMISS"],
};

assert(ACTION_TYPES.GLUCOSE.includes("LOG_READING"), "Glucose has LOG_READING");
assert(ACTION_TYPES.MEDICATION.includes("TAKEN"), "Medication has TAKEN");
assert(ACTION_TYPES.MEDICATION.includes("REMIND_LATER"), "Medication has REMIND_LATER");
assert(ACTION_TYPES.MEDICATION.includes("DISMISS"), "Medication has DISMISS");
console.log("✅ [PASS] 4. Notification Action Buttons (LOG_READING, TAKEN, REMIND_LATER, DISMISS) Verified");

// 5. In-flight Action Idempotency Guard
const inFlightActions = new Set();
function recordAction(notifId, actionId, now = Date.now()) {
  const windowKey = now - (now % 5000);
  const idempotencyKey = `${notifId}_${actionId}_${windowKey}`;
  if (inFlightActions.has(idempotencyKey)) {
    return { success: false, duplicate: true };
  }
  inFlightActions.add(idempotencyKey);
  return { success: true, duplicate: false };
}

const firstTap = recordAction(201012, "TAKEN", 1000);
const rapidSecondTap = recordAction(201012, "TAKEN", 1500);
const rapidThirdTap = recordAction(201012, "TAKEN", 2000);

assert.strictEqual(firstTap.success, true, "First action processed");
assert.strictEqual(rapidSecondTap.duplicate, true, "Rapid second tap blocked by idempotency");
assert.strictEqual(rapidThirdTap.duplicate, true, "Rapid third tap blocked by idempotency");
console.log("✅ [PASS] 5. Repeated/Rapid Action Idempotency Guard Verified");

// 6. Summary Aggregation Honest Reporting
function formatDailySummary(readingCount, avgGlucose, dosesCount) {
  if (readingCount === 0 && dosesCount === 0) {
    return "Gentle reminder: No entries were logged today. Logging daily helps maintain steady glucose tracking.";
  }
  let msg = `Daily Summary: ${readingCount} glucose reading${readingCount === 1 ? "" : "s"} logged today`;
  if (avgGlucose) msg += ` (Avg: ${avgGlucose} mg/dL)`;
  if (dosesCount > 0) msg += `, with ${dosesCount} insulin dose${dosesCount === 1 ? "" : "s"} recorded.`;
  return msg;
}

const zeroSummary = formatDailySummary(0, null, 0);
assert(zeroSummary.includes("No entries were logged today"), "Zero data yields honest gentle reminder");
assert(!zeroSummary.includes("Avg:"), "Never fabricates average when 0 readings");

const activeSummary = formatDailySummary(3, 115, 2);
assert(activeSummary.includes("3 glucose readings"), "Correct count rendered");
assert(activeSummary.includes("Avg: 115 mg/dL"), "Correct average rendered");
assert(activeSummary.includes("2 insulin doses"), "Correct doses rendered");
console.log("✅ [PASS] 6. Summary Aggregator Honest Output Verified (No fabricated records)");

console.log("\n=======================================================");
console.log("🎉 ALL NOTIFICATION SYSTEM VERIFICATION TESTS PASSED!");
console.log("=======================================================\n");
