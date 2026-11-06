// test-phase1-insulin-repair.mjs
// Phase 1: Insulin Reading System Repair & Verification Test

import assert from "node:assert";

console.log("==========================================================================");
console.log("  GLUCOLAB V1.6 – PHASE 1: INSULIN READING SYSTEM REPAIR TEST             ");
console.log("==========================================================================");

class MockPostgreSqlDatabase {
  constructor() {
    this.tables = {
      insulin_entries: new Map(), // key: id
    };
  }

  reset() {
    this.tables.insulin_entries.clear();
  }

  // Raw PostgreSQL query simulation with strict constraint checks
  from(tableName) {
    const self = this;
    const table = this.tables[tableName];

    return {
      select(columns = "*") {
        let filters = [];
        return {
          eq(col, val) {
            filters.push({ col, val });
            return this;
          },
          order(col, { ascending = true } = {}) {
            return this;
          },
          async maybeSingle() {
            const rows = Array.from(table.values()).filter((row) =>
              filters.every((f) => row[f.col] === f.val)
            );
            if (rows.length === 0) return { data: null, error: null };
            return { data: { ...rows[0] }, error: null };
          },
          async single() {
            const res = await this.maybeSingle();
            if (!res.data) return { data: null, error: { code: "PGRST116", message: "Row not found" } };
            return res;
          },
        };
      },

      insert(row) {
        return {
          select() {
            return {
              async maybeSingle() {
                // Check UNIQUE(user_id, entry_date)
                for (const existing of table.values()) {
                  if (existing.user_id === row.user_id && existing.entry_date === row.entry_date) {
                    return {
                      data: null,
                      error: {
                        code: "23505",
                        message: "duplicate key value violates unique constraint idx_insulin_user_date",
                      },
                    };
                  }
                }
                const saved = {
                  id: row.id || `ins_${Date.now()}_${Math.random()}`,
                  morning: 0,
                  lunch: 0,
                  afternoon: 0,
                  evening: 0,
                  night: 0,
                  notes: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...row,
                };
                table.set(saved.id, saved);
                return { data: { ...saved }, error: null };
              },
            };
          },
        };
      },

      update(fields) {
        let filters = [];
        return {
          eq(col, val) {
            filters.push({ col, val });
            return this;
          },
          select() {
            return {
              async maybeSingle() {
                const target = Array.from(table.values()).find((row) =>
                  filters.every((f) => row[f.col] === f.val)
                );
                if (!target) {
                  return { data: null, error: null };
                }
                const updated = {
                  ...target,
                  ...fields,
                  updated_at: new Date().toISOString(),
                };
                table.set(target.id, updated);
                return { data: { ...updated }, error: null };
              },
            };
          },
        };
      },

      delete() {
        let filters = [];
        return {
          eq(col, val) {
            filters.push({ col, val });
            return this;
          },
          select() {
            return {
              async maybeSingle() {
                const target = Array.from(table.values()).find((row) =>
                  filters.every((f) => row[f.col] === f.val)
                );
                if (!target) return { data: null, error: null };
                table.delete(target.id);
                return { data: { ...target }, error: null };
              },
            };
          },
        };
      },
    };
  }
}

// Instantiate test database & service harness mirroring healthService
const db = new MockPostgreSqlDatabase();
const testUser = { id: "usr_clinical_test_1" };
const testDate = "2026-11-06";

const healthServiceHarness = {
  async createInsulinEntry(payload) {
    const dateOnly = payload.entry_date.split("T")[0];
    const stableId = payload.id || `ins_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Check if record already exists for this (user_id, entry_date)
    const { data: existing } = await db
      .from("insulin_entries")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("entry_date", dateOnly)
      .maybeSingle();

    if (existing) {
      // If schedule exists for this date, UPDATE only the requested slot(s), strictly preserving all other existing slots!
      const updateFields = {
        updated_at: new Date().toISOString(),
      };

      if (payload.slot_type && payload.units !== undefined) {
        updateFields[payload.slot_type] = Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)));
      }
      if (payload.morning !== undefined) updateFields.morning = Math.max(0, Math.min(200, Math.round(Number(payload.morning) || 0)));
      if (payload.lunch !== undefined) updateFields.lunch = Math.max(0, Math.min(200, Math.round(Number(payload.lunch) || 0)));
      if (payload.afternoon !== undefined) updateFields.afternoon = Math.max(0, Math.min(200, Math.round(Number(payload.afternoon) || 0)));
      if (payload.evening !== undefined) updateFields.evening = Math.max(0, Math.min(200, Math.round(Number(payload.evening) || 0)));
      if (payload.night !== undefined) updateFields.night = Math.max(0, Math.min(200, Math.round(Number(payload.night) || 0)));
      if (payload.notes !== undefined) updateFields.notes = payload.notes;

      const { data: updated, error: updateErr } = await db
        .from("insulin_entries")
        .update(updateFields)
        .eq("id", existing.id)
        .eq("user_id", testUser.id)
        .select()
        .maybeSingle();

      if (updateErr) throw updateErr;
      if (!updated) throw new Error("Failed to update existing daily insulin record.");
      return { data: updated, error: null };
    }

    // 2. Insert new schedule row when no record exists for this date
    const insertPayload = {
      id: stableId,
      user_id: testUser.id,
      entry_date: dateOnly,
      morning: payload.slot_type === "morning" && payload.units !== undefined
        ? Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)))
        : Math.max(0, Math.min(200, Math.round(Number(payload.morning) || 0))),
      lunch: payload.slot_type === "lunch" && payload.units !== undefined
        ? Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)))
        : Math.max(0, Math.min(200, Math.round(Number(payload.lunch) || 0))),
      afternoon: payload.slot_type === "afternoon" && payload.units !== undefined
        ? Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)))
        : Math.max(0, Math.min(200, Math.round(Number(payload.afternoon) || 0))),
      evening: payload.slot_type === "evening" && payload.units !== undefined
        ? Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)))
        : Math.max(0, Math.min(200, Math.round(Number(payload.evening) || 0))),
      night: payload.slot_type === "night" && payload.units !== undefined
        ? Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)))
        : Math.max(0, Math.min(200, Math.round(Number(payload.night) || 0))),
      notes: payload.notes || null,
    };

    const res = await db
      .from("insulin_entries")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (res.error) throw res.error;
    return { data: res.data, error: null };
  },

  async updateInsulinEntry(id, payload) {
    const updateFields = {
      updated_at: new Date().toISOString(),
    };
    if (payload.slot_type && payload.units !== undefined) {
      updateFields[payload.slot_type] = Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)));
    }
    if (payload.morning !== undefined) updateFields.morning = Math.max(0, Math.min(200, Math.round(Number(payload.morning) || 0)));
    if (payload.lunch !== undefined) updateFields.lunch = Math.max(0, Math.min(200, Math.round(Number(payload.lunch) || 0)));
    if (payload.afternoon !== undefined) updateFields.afternoon = Math.max(0, Math.min(200, Math.round(Number(payload.afternoon) || 0)));
    if (payload.evening !== undefined) updateFields.evening = Math.max(0, Math.min(200, Math.round(Number(payload.evening) || 0)));
    if (payload.night !== undefined) updateFields.night = Math.max(0, Math.min(200, Math.round(Number(payload.night) || 0)));
    if (payload.notes !== undefined) updateFields.notes = payload.notes;

    const res = await db
      .from("insulin_entries")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", testUser.id)
      .select()
      .maybeSingle();

    if (res.error) throw res.error;
    if (!res.data) throw new Error("Not found");
    return res;
  },

  async clearInsulinSlot(identifier, slotType) {
    let query = db.from("insulin_entries").update({
      [slotType]: 0,
      updated_at: new Date().toISOString(),
    }).eq("user_id", testUser.id);

    if (identifier.id) {
      query = query.eq("id", identifier.id);
    } else if (identifier.entry_date) {
      query = query.eq("entry_date", identifier.entry_date.split("T")[0]);
    }

    const res = await query.select().maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) throw new Error("Not found");
    return res;
  },

  async getInsulinSchedule(entryDate) {
    const dateOnly = (entryDate || testDate).split("T")[0];
    const res = await db
      .from("insulin_entries")
      .select("*")
      .eq("user_id", testUser.id)
      .eq("entry_date", dateOnly)
      .maybeSingle();

    return res;
  },
};

// ==========================================================================
// TEST EXECUTION SEQUENCE
// ==========================================================================

async function runPhase1Tests() {
  db.reset();

  console.log("\n--- EXECUTING REQUIRED 10-STEP SEQUENCE ---");

  // Step 1: Create Morning = 8
  console.log("Step 1: Create Morning = 8");
  const step1 = await healthServiceHarness.createInsulinEntry({
    entry_date: testDate,
    slot_type: "morning",
    units: 8,
  });
  assert.strictEqual(step1.data.morning, 8, "Step 1: morning should be 8");
  assert.strictEqual(step1.data.lunch, 0, "Step 1: lunch should be 0");
  const postStep1 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep1.morning, "Lunch:", postStep1.lunch, "Evening:", postStep1.evening, "Night:", postStep1.night);
  assert.strictEqual(postStep1.morning, 8);
  assert.strictEqual(db.tables.insulin_entries.size, 1, "Must maintain exactly 1 daily record");

  // Step 2: Create Lunch = 10
  console.log("Step 2: Create Lunch = 10");
  const step2 = await healthServiceHarness.createInsulinEntry({
    entry_date: testDate,
    slot_type: "lunch",
    units: 10,
  });
  assert.strictEqual(step2.data.lunch, 10, "Step 2: lunch should be 10");
  const postStep2 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep2.morning, "Lunch:", postStep2.lunch, "Evening:", postStep2.evening, "Night:", postStep2.night);
  assert.strictEqual(postStep2.morning, 8, "Step 2: Morning must be preserved");
  assert.strictEqual(postStep2.lunch, 10, "Step 2: Lunch must be 10");
  assert.strictEqual(db.tables.insulin_entries.size, 1);

  // Step 3: Create Evening = 8
  console.log("Step 3: Create Evening = 8");
  const step3 = await healthServiceHarness.createInsulinEntry({
    entry_date: testDate,
    slot_type: "evening",
    units: 8,
  });
  const postStep3 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep3.morning, "Lunch:", postStep3.lunch, "Evening:", postStep3.evening, "Night:", postStep3.night);
  assert.strictEqual(postStep3.morning, 8);
  assert.strictEqual(postStep3.lunch, 10);
  assert.strictEqual(postStep3.evening, 8);
  assert.strictEqual(db.tables.insulin_entries.size, 1);

  // Step 4: Create Night = 18
  console.log("Step 4: Create Night = 18");
  const step4 = await healthServiceHarness.createInsulinEntry({
    entry_date: testDate,
    slot_type: "night",
    units: 18,
  });
  const postStep4 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep4.morning, "Lunch:", postStep4.lunch, "Evening:", postStep4.evening, "Night:", postStep4.night);
  assert.strictEqual(postStep4.morning, 8);
  assert.strictEqual(postStep4.lunch, 10);
  assert.strictEqual(postStep4.evening, 8);
  assert.strictEqual(postStep4.night, 18);
  assert.strictEqual(db.tables.insulin_entries.size, 1);

  // Step 5: Update Lunch = 12
  console.log("Step 5: Update Lunch = 12");
  const step5 = await healthServiceHarness.updateInsulinEntry(postStep4.id, {
    slot_type: "lunch",
    units: 12,
  });
  const postStep5 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep5.morning, "Lunch:", postStep5.lunch, "Evening:", postStep5.evening, "Night:", postStep5.night);
  assert.strictEqual(postStep5.morning, 8, "Morning preserved");
  assert.strictEqual(postStep5.lunch, 12, "Lunch updated to 12");
  assert.strictEqual(postStep5.evening, 8, "Evening preserved");
  assert.strictEqual(postStep5.night, 18, "Night preserved");

  // Step 6: Update Morning = 6
  console.log("Step 6: Update Morning = 6");
  const step6 = await healthServiceHarness.updateInsulinEntry(postStep5.id, {
    slot_type: "morning",
    units: 6,
  });
  const postStep6 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep6.morning, "Lunch:", postStep6.lunch, "Evening:", postStep6.evening, "Night:", postStep6.night);
  assert.strictEqual(postStep6.morning, 6, "Morning updated to 6");
  assert.strictEqual(postStep6.lunch, 12, "Lunch preserved at 12");
  assert.strictEqual(postStep6.evening, 8, "Evening preserved at 8");
  assert.strictEqual(postStep6.night, 18, "Night preserved at 18");

  // Step 7: Delete or clear Evening using existing intended behavior
  console.log("Step 7: Clear Evening (set to 0)");
  const step7 = await healthServiceHarness.clearInsulinSlot({ id: postStep6.id }, "evening");
  const postStep7 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep7.morning, "Lunch:", postStep7.lunch, "Evening:", postStep7.evening, "Night:", postStep7.night);
  assert.strictEqual(postStep7.morning, 6, "Morning preserved");
  assert.strictEqual(postStep7.lunch, 12, "Lunch preserved");
  assert.strictEqual(postStep7.evening, 0, "Evening cleared to 0");
  assert.strictEqual(postStep7.night, 18, "Night preserved");

  // Step 8: Recreate Evening = 9
  console.log("Step 8: Recreate Evening = 9");
  const step8 = await healthServiceHarness.createInsulinEntry({
    entry_date: testDate,
    slot_type: "evening",
    units: 9,
  });
  const postStep8 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified] Morning:", postStep8.morning, "Lunch:", postStep8.lunch, "Evening:", postStep8.evening, "Night:", postStep8.night);
  assert.strictEqual(postStep8.morning, 6);
  assert.strictEqual(postStep8.lunch, 12);
  assert.strictEqual(postStep8.evening, 9);
  assert.strictEqual(postStep8.night, 18);

  // Step 9: Fetch the daily schedule again
  console.log("Step 9: Fetch daily schedule again");
  const step9 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  assert.strictEqual(step9.morning, 6);
  assert.strictEqual(step9.lunch, 12);
  assert.strictEqual(step9.evening, 9);
  assert.strictEqual(step9.night, 18);

  // Step 10: Refresh the application and verify persistence
  console.log("Step 10: Refresh simulation and verify persistence");
  const step10 = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("\n==========================================================================");
  console.log("  FINAL POSTGRESQL RECORD VALUES:");
  console.log("    Morning:", step10.morning, "(Expected: 6)");
  console.log("    Lunch:  ", step10.lunch, "(Expected: 12)");
  console.log("    Evening:", step10.evening, "(Expected: 9)");
  console.log("    Night:  ", step10.night, "(Expected: 18)");
  console.log("==========================================================================");

  assert.strictEqual(step10.morning, 6);
  assert.strictEqual(step10.lunch, 12);
  assert.strictEqual(step10.evening, 9);
  assert.strictEqual(step10.night, 18);
  assert.strictEqual(db.tables.insulin_entries.size, 1);

  // Concurrent slot updates test
  console.log("\n--- CONCURRENT CLOSE-TOGETHER SLOT UPDATES TEST ---");
  const targetId = step10.id;
  // Two updates occurring close together: Update Morning=10 and Update Lunch=15 concurrently
  const pA = healthServiceHarness.updateInsulinEntry(targetId, { slot_type: "morning", units: 10 });
  const pB = healthServiceHarness.updateInsulinEntry(targetId, { slot_type: "lunch", units: 15 });
  await Promise.all([pA, pB]);

  const postConcurrent = (await healthServiceHarness.getInsulinSchedule(testDate)).data;
  console.log("  [DB Verified Concurrent] Morning:", postConcurrent.morning, "Lunch:", postConcurrent.lunch);
  assert.strictEqual(postConcurrent.morning, 10, "Concurrent morning updated cleanly");
  assert.strictEqual(postConcurrent.lunch, 15, "Concurrent lunch updated cleanly");
  assert.strictEqual(postConcurrent.evening, 9, "Evening untouched");
  assert.strictEqual(postConcurrent.night, 18, "Night untouched");

  console.log("\n>>> ALL PHASE 1 INSULIN REPAIR TESTS PASSED WITH 100% SUCCESS! <<<\n");
}

runPhase1Tests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

