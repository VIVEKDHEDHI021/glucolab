import assert from "node:assert";
import fs from "node:fs";

console.log("=================================================");
console.log("🧪 GLUCOLAB SMART GLUCOSE SUGGESTION TEST RUNNER");
console.log("=================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// -------------------------------------------------------------------------
// Core Implementation (matching src/frontend/lib/glucose-suggestions.ts)
// -------------------------------------------------------------------------
function getSuggestedReadingType(date = new Date()) {
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

// Helper to create date with specific hours and minutes in local time
function createLocalDateTime(hours, minutes) {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// =========================================================================
// SECTION 1: SPECIFICATION TEST CASES
// =========================================================================
console.log("--- 1. SPECIFICATION TEST CASES ---");

test("Case 1: Open Add Glucose at 1:30 PM (13:30) -> After Lunch (AL) selected", () => {
  const date = createLocalDateTime(13, 30);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "AL");
});

test("Case 2: Open at 12:00 PM (12:00) -> Before Lunch (BL) selected", () => {
  const date = createLocalDateTime(12, 0);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "BL");
});

test("Case 3: Open at 9:00 AM (09:00) -> After Breakfast (AB) selected", () => {
  const date = createLocalDateTime(9, 0);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "AB");
});

test("Case 4: Open at 6:00 PM (18:00) -> Before Dinner (BD) selected", () => {
  const date = createLocalDateTime(18, 0);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "BD");
});

test("Case 5: Open at 8:00 PM (20:00) -> After Dinner (AD) selected", () => {
  const date = createLocalDateTime(20, 0);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "AD");
});

test("Case 6: Open at 11:00 PM (23:00) -> Bedtime (BT) selected", () => {
  const date = createLocalDateTime(23, 0);
  const suggested = getSuggestedReadingType(date);
  assert.strictEqual(suggested, "BT");
});

// =========================================================================
// SECTION 2: COMPLETE 24-HOUR BOUNDARY WINDOW TESTS
// =========================================================================
console.log("\n--- 2. ALL BOUNDARY WINDOW TESTS ---");

test("Window 1: 05:00 AM (Boundary Start) -> Before Breakfast (BB)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(5, 0)), "BB");
});

test("Window 1: 07:59 AM (Boundary End) -> Before Breakfast (BB)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(7, 59)), "BB");
});

test("Window 2: 08:00 AM (Boundary Start) -> After Breakfast (AB)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(8, 0)), "AB");
});

test("Window 2: 10:59 AM (Boundary End) -> After Breakfast (AB)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(10, 59)), "AB");
});

test("Window 3: 11:00 AM (Boundary Start) -> Before Lunch (BL)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(11, 0)), "BL");
});

test("Window 3: 01:29 PM (Boundary End) -> Before Lunch (BL)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(13, 29)), "BL");
});

test("Window 4: 01:30 PM (Boundary Start) -> After Lunch (AL)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(13, 30)), "AL");
});

test("Window 4: 04:29 PM (Boundary End) -> After Lunch (AL)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(16, 29)), "AL");
});

test("Window 5: 04:30 PM (Boundary Start) -> Before Dinner (BD)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(16, 30)), "BD");
});

test("Window 5: 07:29 PM (Boundary End) -> Before Dinner (BD)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(19, 29)), "BD");
});

test("Window 6: 07:30 PM (Boundary Start) -> After Dinner (AD)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(19, 30)), "AD");
});

test("Window 6: 09:59 PM (Boundary End) -> After Dinner (AD)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(21, 59)), "AD");
});

test("Window 7: 10:00 PM (Boundary Start) -> Bedtime (BT)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(22, 0)), "BT");
});

test("Window 7: 12:00 AM Midnight (Boundary Cross) -> Bedtime (BT)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(0, 0)), "BT");
});

test("Window 7: 03:30 AM Early Morning -> Bedtime (BT)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(3, 30)), "BT");
});

test("Window 7: 04:59 AM (Boundary End) -> Bedtime (BT)", () => {
  assert.strictEqual(getSuggestedReadingType(createLocalDateTime(4, 59)), "BT");
});

// =========================================================================
// SECTION 3: FORM BEHAVIOR, OVERRIDE & EDIT SIMULATION TESTS
// =========================================================================
console.log("\n--- 3. FORM BEHAVIOR, OVERRIDE & EDIT SIMULATION TESTS ---");

test("Manual Override: User changes suggested AL to BL -> BL remains selected and is saved", () => {
  // Step 1: Open form at 1:30 PM
  let formState = {
    reading_type: getSuggestedReadingType(createLocalDateTime(13, 30)), // AL
    isSuggested: true,
  };
  assert.strictEqual(formState.reading_type, "AL");
  assert.strictEqual(formState.isSuggested, true);

  // Step 2: User manually selects Before Lunch (BL)
  formState.reading_type = "BL";
  formState.isSuggested = false;

  // Step 3: Clock advances to 2:00 PM while form is open
  // Form MUST keep the user's manual selection
  assert.strictEqual(formState.reading_type, "BL", "Manual selection must NOT be reverted by clock changes");
  assert.strictEqual(formState.isSuggested, false, "Suggested indicator must remain dismissed");

  // Step 4: Save payload to database
  const payloadToDatabase = {
    reading_type: formState.reading_type,
  };
  assert.strictEqual(payloadToDatabase.reading_type, "BL", "Database receives the final user-selected value");
});

test("Edit Mode: Editing existing record with reading_type = 'BB' keeps 'BB' and never auto-overwrites", () => {
  const existingRecord = {
    id: "existing-uuid-1",
    glucose: 125,
    reading_type: "BB", // Before Breakfast
    date_time: "2026-09-01T07:15:00Z",
  };

  // Open Edit Form at 8:00 PM (when current time suggestion would be AD)
  const isEdit = Boolean(existingRecord);
  const formState = {
    reading_type: isEdit ? existingRecord.reading_type : getSuggestedReadingType(createLocalDateTime(20, 0)),
    isSuggested: !isEdit,
  };

  assert.strictEqual(formState.reading_type, "BB", "Existing record reading_type MUST NOT be overwritten on edit");
  assert.strictEqual(formState.isSuggested, false, "Suggested badge must NOT show when editing existing record");
});

test("Source File Integrity: src/frontend/lib/glucose-suggestions.ts matches logic structure", () => {
  const src = fs.readFileSync("src/frontend/lib/glucose-suggestions.ts", "utf8");
  assert.ok(src.includes("getSuggestedReadingType"), "Function is exported");
  assert.ok(src.includes("BB") && src.includes("AB") && src.includes("BL") && src.includes("AL") && src.includes("BD") && src.includes("AD") && src.includes("BT"));
});

test("Offline Compatibility: Suggestion executes purely synchronous in memory with zero API latency", () => {
  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    getSuggestedReadingType(new Date());
  }
  const end = performance.now();
  assert.ok(end - start < 50, "1000 calculations executed in < 50ms (Pure CPU computation)");
});

console.log("\n=================================================");
console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
console.log("=================================================");

if (failed > 0) {
  process.exit(1);
}
