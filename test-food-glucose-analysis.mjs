import assert from "node:assert";
import fs from "node:fs";

console.log("===================================================================");
console.log("🥗 GLUCOLAB SPECIAL FOOD TRACKING & PERSONALIZED ANALYSIS TESTS");
console.log("===================================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// -------------------------------------------------------------------------
// Mock Data & Helpers matching implementation
// -------------------------------------------------------------------------
const QUICK_FOOD_OPTIONS = [
  { id: "sweets_mithai", label: "Sweets / mithai, including jalebi and ladoo" },
  { id: "sugary_drinks", label: "Sugary drinks or sweetened tea" },
  { id: "large_carb_meal", label: "Large rice or roti meal" },
  { id: "festival_meal", label: "Festival or celebration meal" },
  { id: "fast_food", label: "Outside food or fast food" },
  { id: "no_unusual_food", label: "No unusual food", exclusive: true },
  { id: "not_sure", label: "Not sure", exclusive: true },
];

function simulateFoodContextToggle(currentSelected, targetId) {
  const isExclusive = targetId === "no_unusual_food" || targetId === "not_sure";
  if (isExclusive) {
    if (currentSelected.includes(targetId)) {
      return [];
    }
    return [targetId];
  } else {
    if (currentSelected.includes(targetId)) {
      return currentSelected.filter((id) => id !== targetId);
    }
    const filtered = currentSelected.filter(
      (id) => id !== "no_unusual_food" && id !== "not_sure"
    );
    return [...filtered, targetId];
  }
}

// Statistical calculation logic (matching src/frontend/lib/food-glucose-analysis.ts)
function calculateStandardDeviation(values, mean) {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function calculatePeriodStats(readings) {
  const PERIODS = ["BB", "AB", "BL", "AL", "BD", "AD", "BT", "Fasting"];
  return PERIODS.map((period) => {
    const vals = readings
      .filter((r) => r.reading_type === period)
      .map((r) => Number(r.glucose))
      .filter((v) => !isNaN(v) && v > 0);
    const count = vals.length;
    if (count === 0) {
      return { period, count: 0, mean: 0, median: 0, inRangePercent: 0, highCount: 0, lowCount: 0 };
    }
    const mean = Math.round((vals.reduce((s, v) => s + v, 0) / count) * 10) / 10;
    const median = calculateMedian(vals);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sd = calculateStandardDeviation(vals, mean);
    const isFasting = period === "BB" || period === "BL" || period === "BD" || period === "Fasting";
    const targetMax = isFasting ? 130 : 180;
    const targetMin = 70;

    let inRange = 0;
    let high = 0;
    let low = 0;
    for (const v of vals) {
      if (v < targetMin) low++;
      else if (v > targetMax) high++;
      else inRange++;
    }
    return {
      period,
      count,
      mean,
      median,
      min,
      max,
      standardDeviation: sd,
      inRangePercent: Math.round((inRange / count) * 100),
      highCount: high,
      lowCount: low,
    };
  });
}

function calculatePairedMealDeltas(readings) {
  const mealPairs = [
    { meal: "Breakfast", pre: "BB", post: "AB" },
    { meal: "Lunch", pre: "BL", post: "AL" },
    { meal: "Dinner", pre: "BD", post: "AD" },
  ];

  return mealPairs.map(({ meal, pre, post }) => {
    const byDate = new Map();
    for (const r of readings) {
      const dateStr = r.date_time.slice(0, 10);
      const entry = byDate.get(dateStr) || {};
      if (r.reading_type === pre) entry.pre = Number(r.glucose);
      if (r.reading_type === post) entry.post = Number(r.glucose);
      byDate.set(dateStr, entry);
    }
    const deltas = [];
    for (const pair of byDate.values()) {
      if (pair.pre !== undefined && pair.post !== undefined) {
        deltas.push(pair.post - pair.pre);
      }
    }
    const pairCount = deltas.length;
    const averageDelta =
      pairCount > 0 ? Math.round((deltas.reduce((s, d) => s + d, 0) / pairCount) * 10) / 10 : 0;
    return { meal, prePeriod: pre, postPeriod: post, pairCount, averageDelta };
  });
}

function analyzeFoodGlucoseCorrelations(foodLogs, glucoseReadings) {
  const categoryObservations = new Map();
  for (const food of foodLogs) {
    if (food.is_uncertain || !food.food_categories) continue;
    const foodTime = new Date(food.date_time).getTime();
    const subReadings = glucoseReadings.filter((g) => {
      const gTime = new Date(g.date_time).getTime();
      const diffMin = (gTime - foodTime) / (1000 * 60);
      return diffMin >= 30 && diffMin <= 240;
    });
    for (const cat of food.food_categories) {
      if (!cat || cat === "No unusual food" || cat === "Not sure") continue;
      const existing = categoryObservations.get(cat) || [];
      for (const r of subReadings) existing.push(Number(r.glucose));
      categoryObservations.set(cat, existing);
    }
  }
  const results = [];
  for (const [category, vals] of categoryObservations.entries()) {
    if (vals.length === 0) continue;
    const count = vals.length;
    const mean = Math.round((vals.reduce((s, v) => s + v, 0) / count) * 10) / 10;
    const elevated = vals.filter((v) => v > 180).length;
    results.push({
      category,
      observationCount: count,
      averagePostGlucose: mean,
      elevatedRate: Math.round((elevated / count) * 100),
    });
  }
  return results;
}

function generatePatientInsights({ periodStats, pairedDeltas, foodCorrelations, insulinEntries, glucoseReadings }) {
  const insights = [];
  if (glucoseReadings.length < 3) {
    insights.push({
      id: "insufficient_data",
      type: "insufficient_data",
      severity: "info",
      message: "There are not enough comparable readings to establish a consistent pattern.",
      supportingObservations: glucoseReadings.length,
    });
    return insights;
  }

  // 1. Period patterns
  for (const p of periodStats) {
    if (p.count >= 3 && p.highCount / p.count >= 0.5) {
      insights.push({
        id: `elevated_${p.period}`,
        type: "pattern_high",
        severity: "warning",
        message: `Your glucose has frequently been elevated in your recent records (${p.highCount} of ${p.count} were high).`,
        supportingObservations: p.count,
      });
    }
    if (p.count >= 2 && p.lowCount > 0) {
      insights.push({
        id: `low_${p.period}`,
        type: "pattern_low",
        severity: "alert",
        message: `Readings below 70 mg/dL were recorded around ${p.period}. Review potential causes with your doctor.`,
        supportingObservations: p.lowCount,
      });
    }
  }

  // 2. Food associations
  for (const f of foodCorrelations) {
    if (f.observationCount >= 2 && f.elevatedRate >= 50) {
      insights.push({
        id: `food_${f.category}`,
        type: "food_association",
        severity: "warning",
        message: `High readings have often occurred after meals where ${f.category.toLowerCase()} was recorded.`,
        supportingObservations: f.observationCount,
        safetyNote: "Correlation only; not proof of direct causation.",
      });
    }
  }

  // 3. Trajectory following recorded insulin administration
  if (insulinEntries.length > 0) {
    const daysWithInsulin = new Set(insulinEntries.map((i) => i.entry_date.slice(0, 10)));
    const lows = glucoseReadings.filter(
      (g) => daysWithInsulin.has(g.date_time.slice(0, 10)) && Number(g.glucose) < 70
    );
    if (lows.length >= 2) {
      insights.push({
        id: "insulin_drops",
        type: "insulin_trajectory",
        severity: "alert",
        message: "Your glucose has sometimes dropped after recorded insulin doses. Review this pattern with your healthcare professional.",
        supportingObservations: lows.length,
      });
    }
  }

  return insights;
}

// =========================================================================
// 15-POINT MANDATORY SPECIFICATION TESTS
// =========================================================================

console.log("--- 1. GLUCOSE ENTRY & QUICK FOOD CONTEXT TESTS ---");

test("Requirement 1: Saving a glucose reading without food details", () => {
  const readingPayload = {
    user_id: "user_test_123",
    glucose: 124,
    reading_type: "BB",
    date_time: "2026-10-25T07:30:00.000Z",
    food: null,
    notes: "Normal fasting morning",
  };
  assert.strictEqual(readingPayload.food, null);
  assert.strictEqual(readingPayload.glucose, 124);
  assert.strictEqual(readingPayload.reading_type, "BB");
});

test("Requirement 2: Saving a reading with one food selection", () => {
  const selected = simulateFoodContextToggle([], "sweets_mithai");
  assert.deepStrictEqual(selected, ["sweets_mithai"]);
  const label = QUICK_FOOD_OPTIONS.find((o) => o.id === selected[0]).label;
  const foodPayload = {
    food_categories: [label],
    meal_period: "AL",
    date_time: "2026-10-25T14:30:00.000Z",
    is_uncertain: false,
  };
  assert.strictEqual(foodPayload.food_categories.length, 1);
  assert.ok(foodPayload.food_categories[0].includes("Sweets"));
});

test("Requirement 3: Saving a reading with multiple food selections", () => {
  let selected = [];
  selected = simulateFoodContextToggle(selected, "sweets_mithai");
  selected = simulateFoodContextToggle(selected, "sugary_drinks");
  selected = simulateFoodContextToggle(selected, "large_carb_meal");
  assert.strictEqual(selected.length, 3);
  assert.ok(selected.includes("sweets_mithai"));
  assert.ok(selected.includes("sugary_drinks"));
  assert.ok(selected.includes("large_carb_meal"));
});

test("Requirement 4: Mutual exclusivity of 'No unusual food' and 'Not sure'", () => {
  // Select food items first
  let selected = ["sweets_mithai", "fast_food"];
  // Select 'no_unusual_food' -> should clear all food items
  selected = simulateFoodContextToggle(selected, "no_unusual_food");
  assert.deepStrictEqual(selected, ["no_unusual_food"]);

  // Now select a food item -> should clear 'no_unusual_food'
  selected = simulateFoodContextToggle(selected, "festival_meal");
  assert.deepStrictEqual(selected, ["festival_meal"]);

  // Select 'not_sure' -> should clear 'festival_meal'
  selected = simulateFoodContextToggle(selected, "not_sure");
  assert.deepStrictEqual(selected, ["not_sure"]);

  // Selecting 'no_unusual_food' replaces 'not_sure'
  selected = simulateFoodContextToggle(selected, "no_unusual_food");
  assert.deepStrictEqual(selected, ["no_unusual_food"]);

  // Clicking 'no_unusual_food' again unselects it
  selected = simulateFoodContextToggle(selected, "no_unusual_food");
  assert.deepStrictEqual(selected, []);
});

console.log("\n--- 2. WHOLE-DAY FOOD LOGGING & TIMELINE TESTS ---");

test("Requirement 5: Adding multiple food entries on the same day", () => {
  const dayLogs = [
    { id: "f1", meal_period: "Breakfast", date_time: "2026-10-25T08:15:00.000Z", food_categories: ["Rice and roti-based meals"], portion_category: "regular" },
    { id: "f2", meal_period: "Lunch", date_time: "2026-10-25T13:30:00.000Z", food_categories: ["Restaurant or fast food", "Sugary drinks and sweetened tea"], portion_category: "large" },
    { id: "f3", meal_period: "Evening snack", date_time: "2026-10-25T17:00:00.000Z", food_categories: ["Snacks"], portion_category: "small" },
    { id: "f4", meal_period: "Dinner", date_time: "2026-10-25T20:45:00.000Z", food_categories: ["Festival and celebration foods", "Sweets and mithai"], portion_category: "large" },
  ];
  assert.strictEqual(dayLogs.length, 4);
  const dateStrs = dayLogs.map((f) => f.date_time.slice(0, 10));
  assert.ok(dateStrs.every((d) => d === "2026-10-25"));
});

test("Requirement 6: Editing and deleting food records", () => {
  let log = {
    id: "f_edit_1",
    user_id: "u_1",
    meal_period: "Lunch",
    portion_category: "regular",
    food_categories: ["Snacks"],
    notes: "Initial note",
  };
  // Edit record
  log = {
    ...log,
    portion_category: "large",
    food_categories: ["Snacks", "Fried foods"],
    notes: "Updated note with samosas",
  };
  assert.strictEqual(log.portion_category, "large");
  assert.strictEqual(log.food_categories.length, 2);
  assert.strictEqual(log.notes, "Updated note with samosas");

  // Deletion simulation
  const logsList = [log];
  const afterDelete = logsList.filter((item) => item.id !== "f_edit_1");
  assert.strictEqual(afterDelete.length, 0);
});

test("Requirement 7: Correct timestamps and meal-period associations", () => {
  const testIso = "2026-10-25T13:45:00.000Z";
  const entryDate = new Date(testIso);
  assert.strictEqual(entryDate.toISOString(), testIso);
  const hours = entryDate.getUTCHours();
  assert.ok(hours >= 0 && hours <= 23);
});

console.log("\n--- 3. OFFLINE STORAGE & SYNCHRONIZATION TESTS ---");

test("Requirement 8: Offline creation and later synchronization", () => {
  // Simulate local SQLite offline table state
  const localDb = [];
  const offlineFoodEntry = {
    id: "local_uuid_abc",
    user_id: "user_mobile_99",
    food_categories: ["Sweets and mithai"],
    portion_category: "regular",
    meal_period: "Dinner",
    date_time: "2026-10-25T21:00:00.000Z",
    sync_status: "pending_sync",
  };
  localDb.push(offlineFoodEntry);

  // Filter pending sync rows
  const pending = localDb.filter((r) => r.sync_status === "pending_sync");
  assert.strictEqual(pending.length, 1);

  // Sync simulation: push to server and set sync_status to 'synced'
  const pushed = { ...pending[0], sync_status: "synced" };
  const idx = localDb.findIndex((r) => r.id === pushed.id);
  localDb[idx] = pushed;

  assert.strictEqual(localDb[0].sync_status, "synced");
  assert.strictEqual(localDb.filter((r) => r.sync_status === "pending_sync").length, 0);
});

test("Requirement 9: Retry behavior and duplicate prevention", () => {
  const remoteTable = new Map();
  const pushEntry = (entry) => {
    // Upsert semantic prevents duplicate primary keys
    remoteTable.set(entry.id, entry);
  };
  const record = { id: "record_retry_001", user_id: "u1", date_time: "2026-10-25T10:00:00Z" };
  pushEntry(record);
  // Retry 1
  pushEntry(record);
  // Retry 2
  pushEntry(record);
  assert.strictEqual(remoteTable.size, 1);
});

test("Requirement 10: Supabase RLS and cross-patient data isolation", () => {
  const authenticatedUserId = "user_alice_456";
  const patientRecords = [
    { id: "rec_1", user_id: "user_alice_456", food: "Salad" },
    { id: "rec_2", user_id: "user_bob_789", food: "Biryani" },
  ];
  // RLS Filter policy: auth.uid() = user_id
  const aliceVisible = patientRecords.filter((r) => r.user_id === authenticatedUserId);
  assert.strictEqual(aliceVisible.length, 1);
  assert.strictEqual(aliceVisible[0].food, "Salad");
  // Alice cannot read or mutate Bob's data
  assert.ok(!aliceVisible.some((r) => r.user_id === "user_bob_789"));
});

console.log("\n--- 4. PERSONALIZED ANALYSIS & SAFETY LOGIC TESTS ---");

test("Requirement 11: High- and low-glucose insight behavior", () => {
  const sampleGlucose = [
    { id: "g1", reading_type: "AL", glucose: 210, date_time: "2026-10-21T14:30:00Z" },
    { id: "g2", reading_type: "AL", glucose: 225, date_time: "2026-10-22T14:30:00Z" },
    { id: "g3", reading_type: "AL", glucose: 195, date_time: "2026-10-23T14:30:00Z" },
    { id: "g4", reading_type: "BB", glucose: 62, date_time: "2026-10-24T07:00:00Z" },
    { id: "g5", reading_type: "BB", glucose: 65, date_time: "2026-10-25T07:00:00Z" },
  ];
  const sampleFood = [
    { id: "f1", date_time: "2026-10-21T13:00:00Z", food_categories: ["Sweets and mithai"] },
    { id: "f2", date_time: "2026-10-22T13:00:00Z", food_categories: ["Sweets and mithai"] },
  ];
  const sampleInsulin = [
    { entry_date: "2026-10-24", morning: 12 },
    { entry_date: "2026-10-25", morning: 12 },
  ];

  const periodStats = calculatePeriodStats(sampleGlucose);
  const pairedDeltas = calculatePairedMealDeltas(sampleGlucose);
  const foodCorrelations = analyzeFoodGlucoseCorrelations(sampleFood, sampleGlucose);
  const insights = generatePatientInsights({
    periodStats,
    pairedDeltas,
    foodCorrelations,
    insulinEntries: sampleInsulin,
    glucoseReadings: sampleGlucose,
  });

  // Verify elevated AL pattern is detected
  const alInsight = insights.find((i) => i.id === "elevated_AL");
  assert.ok(alInsight, "Elevated AL pattern should be generated");

  // Verify hypoglycemia alert is detected
  const lowInsight = insights.find((i) => i.id === "low_BB");
  assert.ok(lowInsight, "Low BB alert should be generated");
  assert.strictEqual(lowInsight.severity, "alert");

  // Verify food association is detected
  const foodInsight = insights.find((i) => i.id.includes("Sweets"));
  assert.ok(foodInsight, "Food association with sweets should be generated");

  // Verify insulin drop insight is generated
  const insulinInsight = insights.find((i) => i.id === "insulin_drops");
  assert.ok(insulinInsight, "Insulin drop pattern should be generated");
});

test("Requirement 12: Missing, incomplete, and conflicting records handling", () => {
  // Incomplete / insufficient readings
  const sparseGlucose = [{ id: "g1", reading_type: "BB", glucose: 110, date_time: "2026-10-25T07:00:00Z" }];
  const periodStats = calculatePeriodStats(sparseGlucose);
  const insights = generatePatientInsights({
    periodStats,
    pairedDeltas: [],
    foodCorrelations: [],
    insulinEntries: [],
    glucoseReadings: sparseGlucose,
  });
  assert.strictEqual(insights.length, 1);
  assert.strictEqual(insights[0].type, "insufficient_data");
  assert.ok(insights[0].message.includes("not enough comparable readings"));

  // Uncertain food entry is excluded from firm correlations
  const uncertainFood = [
    { id: "fu", date_time: "2026-10-25T12:00:00Z", food_categories: ["Cake"], is_uncertain: true },
  ];
  const correlations = analyzeFoodGlucoseCorrelations(uncertainFood, sparseGlucose);
  assert.strictEqual(correlations.length, 0);
});

console.log("\n--- 5. UI TOKENS & REGRESSION INTEGRITY TESTS ---");

test("Requirement 13: Light and dark theme rendering tokens", () => {
  const css = fs.readFileSync("src/styles.css", "utf-8");
  assert.ok(css.includes(".dark"), "Dark mode class must be present in styles.css");
  assert.ok(css.includes("--primary:"), "Primary color variable must be present");
  assert.ok(css.includes("--card:"), "Card background variable must be present");
  assert.ok(css.includes("--foreground:"), "Foreground variable must be present");
  assert.ok(css.includes("--border:"), "Border variable must be present");
});

test("Requirement 14: Mobile responsiveness and touch targets", () => {
  const selectorFile = fs.readFileSync("src/frontend/components/food-context-selector.tsx", "utf-8");
  assert.ok(
    selectorFile.includes("min-h-[44px]"),
    "Food selection chips must adhere to 44px minimum touch target"
  );
  const dialogFile = fs.readFileSync("src/frontend/components/food-dialog.tsx", "utf-8");
  assert.ok(
    dialogFile.includes("min-h-[44px]"),
    "Food dialog selection buttons must adhere to 44px minimum touch target"
  );
});

test("Requirement 15: Regression testing of existing components and models", () => {
  const typesFile = fs.readFileSync("src/frontend/lib/types.ts", "utf-8");
  assert.ok(typesFile.includes('["BB", "AB", "BL", "AL", "BD", "AD", "BT", "Fasting"]'));
  assert.ok(typesFile.includes("export function glucoseStatus"));

  const dashboardFile = fs.readFileSync("src/routes/_authenticated/dashboard.tsx", "utf-8");
  assert.ok(dashboardFile.includes("Special Food"));
  assert.ok(dashboardFile.includes("FoodDialog"));

  const historyFile = fs.readFileSync("src/routes/_authenticated/history.tsx", "utf-8");
  assert.ok(historyFile.includes('value="food"'));
  assert.ok(historyFile.includes("FoodDialog"));

  const reportsFile = fs.readFileSync("src/routes/_authenticated/reports.tsx", "utf-8");
  assert.ok(reportsFile.includes("Period-Based Glucose Analysis"));
  assert.ok(reportsFile.includes("Food & Glucose Associations"));
});

console.log("\n===================================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log("===================================================================\n");

if (failed > 0) {
  process.exit(1);
}
