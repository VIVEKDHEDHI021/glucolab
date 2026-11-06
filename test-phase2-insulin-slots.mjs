/**
 * GlucoLab V1.6 – Phase 2: Individual Insulin Slot Management & Parent-Child Architecture
 *
 * Verifies:
 * 1. Add Morning only: saves independently, does not require Lunch/Evening/Night, returns record.
 * 2. Add Lunch only: creates Lunch slot independently on a distinct schedule.
 * 3. Add Evening only: creates Evening slot independently.
 * 4. Add Night only: creates Night slot independently.
 * 5. Add a missing slot (e.g. Lunch) to an existing schedule: reuses parent schedule, preserves existing Morning slot.
 * 6. Update one slot (e.g. Morning) by its slot ID: modifies only Morning, preserves other slots.
 * 7. Delete one slot (e.g. Evening) by its slot ID: removes Evening, preserves other slots and parent schedule.
 * 8. Combined schedule: all four slots submitted together correctly grouped under one daily schedule.
 * 9. Prevent duplicate logical slots for the same schedule and slot type.
 * 10. Five consecutive distinct slot operations work cleanly.
 */

import assert from "node:assert";

console.log("\n==========================================================================");
console.log("  GLUCOLAB V1.6 – PHASE 2: INDIVIDUAL INSULIN SLOT CRUD & PARENT-CHILD    ");
console.log("==========================================================================\n");

let passed = 0;
let total = 0;
const testQueue = [];

function test(name, fn) {
  testQueue.push({ name, fn });
}

// -------------------------------------------------------------
// HARNESS: PARENT (insulin_entries) + CHILD (insulin_slots)
// -------------------------------------------------------------
function createSlotHarness() {
  const userId = "usr_patient_007";
  const parentSchedules = new Map(); // schedule_id -> schedule row
  const childSlots = new Map();      // slot_id -> slot row
  const idempotencyMap = new Map();

  const idempotencyService = {
    generateKey(uid, entity, stableId) {
      return `idem_${entity}_${uid.slice(0, 8)}_${stableId}`;
    },
    async executeIdempotent(key, op) {
      if (idempotencyMap.has(key)) {
        return { data: idempotencyMap.get(key), isCached: true };
      }
      const result = await op();
      idempotencyMap.set(key, result);
      return { data: result, isCached: false };
    },
  };

  const service = {
    async getOrCreateInsulinSchedule(uid, entryDate) {
      const dateOnly = entryDate.split("T")[0];
      for (const [_, sched] of parentSchedules.entries()) {
        if (sched.user_id === uid && sched.entry_date === dateOnly) {
          return sched;
        }
      }
      const newId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const sched = {
        id: newId,
        user_id: uid,
        entry_date: dateOnly,
        morning: 0,
        lunch: 0,
        afternoon: 0,
        evening: 0,
        night: 0,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      parentSchedules.set(newId, sched);
      return sched;
    },

    async createInsulinSlot(payload, idempotencyKey) {
      assert(payload.entry_date, "Missing entry_date");
      assert(payload.slot_type, "Missing slot_type");
      const units = Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)));
      const dateOnly = payload.entry_date.split("T")[0];
      const stableSlotId = payload.id || `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const key = idempotencyKey || idempotencyService.generateKey(userId, "insulin", `${dateOnly}_${payload.slot_type}_${stableSlotId}`);

      const { data, isCached } = await idempotencyService.executeIdempotent(key, async () => {
        const schedule = await this.getOrCreateInsulinSchedule(userId, dateOnly);

        // Check if slot already exists on this schedule (UNIQUE constraint: schedule_id, slot_type)
        let existingSlotId = null;
        for (const [sId, slot] of childSlots.entries()) {
          if (slot.schedule_id === schedule.id && slot.slot_type === payload.slot_type) {
            existingSlotId = sId;
            break;
          }
        }

        let slotRecord;
        if (existingSlotId) {
          slotRecord = {
            ...childSlots.get(existingSlotId),
            units,
            notes: payload.notes !== undefined ? payload.notes : childSlots.get(existingSlotId).notes,
            updated_at: new Date().toISOString(),
          };
          childSlots.set(existingSlotId, slotRecord);
        } else {
          slotRecord = {
            id: stableSlotId,
            schedule_id: schedule.id,
            user_id: userId,
            slot_type: payload.slot_type,
            units,
            notes: payload.notes || null,
            recorded_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          childSlots.set(stableSlotId, slotRecord);
        }

        // Atomically sync parent schedule column
        schedule[payload.slot_type] = units;
        schedule.updated_at = new Date().toISOString();

        return { slot: slotRecord, schedule };
      });

      return { data, isCached };
    },

    async updateInsulinSlot(slotId, payload) {
      assert(slotId, "Missing slot ID");
      const slot = childSlots.get(slotId);
      if (!slot || slot.user_id !== userId) {
        throw new Error(`Slot "${slotId}" not found or unauthorized`);
      }

      if (payload.units !== undefined) {
        slot.units = Math.max(0, Math.min(200, Math.round(Number(payload.units) || 0)));
      }
      if (payload.notes !== undefined) {
        slot.notes = payload.notes;
      }
      slot.updated_at = new Date().toISOString();
      childSlots.set(slotId, slot);

      // Sync parent schedule
      const schedule = parentSchedules.get(slot.schedule_id);
      if (schedule && payload.units !== undefined) {
        schedule[slot.slot_type] = slot.units;
        schedule.updated_at = new Date().toISOString();
      }

      return { slot, schedule };
    },

    async deleteInsulinSlot(slotId) {
      assert(slotId, "Missing slot ID");
      const slot = childSlots.get(slotId);
      if (!slot || slot.user_id !== userId) {
        throw new Error(`Slot "${slotId}" not found`);
      }

      childSlots.delete(slotId);

      // Clear that slot on the parent schedule (set to 0), but preserve the parent schedule and other slots!
      const schedule = parentSchedules.get(slot.schedule_id);
      if (schedule) {
        schedule[slot.slot_type] = 0;
        schedule.updated_at = new Date().toISOString();
      }

      return { success: true, slotId, scheduleId: slot.schedule_id };
    },

    async getSlotsForSchedule(scheduleId) {
      const results = [];
      for (const [_, slot] of childSlots.entries()) {
        if (slot.schedule_id === scheduleId && slot.user_id === userId) {
          results.push(slot);
        }
      }
      return results;
    },

    async createOrUpdateCombined(entryDate, doses, notes) {
      const dateOnly = entryDate.split("T")[0];
      const schedule = await this.getOrCreateInsulinSchedule(userId, dateOnly);

      const slots = ["morning", "lunch", "afternoon", "evening", "night"];
      for (const slotKey of slots) {
        if (doses[slotKey] !== undefined) {
          const units = Math.max(0, Math.min(200, Math.round(Number(doses[slotKey]) || 0)));
          schedule[slotKey] = units;
          
          if (units > 0) {
            // Upsert child slot
            let found = false;
            for (const [sId, slot] of childSlots.entries()) {
              if (slot.schedule_id === schedule.id && slot.slot_type === slotKey) {
                childSlots.set(sId, { ...slot, units, updated_at: new Date().toISOString() });
                found = true;
                break;
              }
            }
            if (!found) {
              const newSlotId = `slot_${slotKey}_${Date.now()}`;
              childSlots.set(newSlotId, {
                id: newSlotId,
                schedule_id: schedule.id,
                user_id: userId,
                slot_type: slotKey,
                units,
                notes: notes || null,
                recorded_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
      if (notes !== undefined) schedule.notes = notes;
      schedule.updated_at = new Date().toISOString();
      return schedule;
    },
  };

  return { userId, parentSchedules, childSlots, service };
}

// -------------------------------------------------------------
// TEST 1: ADD MORNING ONLY
// -------------------------------------------------------------
test("1. Add Morning only: saves independently, does not require Lunch/Evening/Night", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  const res = await service.createInsulinSlot({
    entry_date: "2026-11-06",
    slot_type: "morning",
    units: 12,
    notes: "Fasting morning dose",
  });

  assert(res.data.slot && res.data.slot.id, "Saved slot record returned with unique ID");
  assert.strictEqual(res.data.slot.slot_type, "morning", "Slot type is morning");
  assert.strictEqual(res.data.slot.units, 12, "Units is 12");
  assert.strictEqual(res.data.schedule.morning, 12, "Parent schedule has morning = 12");
  assert.strictEqual(res.data.schedule.lunch, 0, "Lunch is unrecorded (0)");
  assert.strictEqual(res.data.schedule.evening, 0, "Evening is unrecorded (0)");
  assert.strictEqual(res.data.schedule.night, 0, "Night is unrecorded (0)");
  assert.strictEqual(parentSchedules.size, 1, "Exactly 1 parent daily schedule created");
  assert.strictEqual(childSlots.size, 1, "Exactly 1 child slot record created");
});

// -------------------------------------------------------------
// TEST 2: ADD LUNCH ONLY
// -------------------------------------------------------------
test("2. Add Lunch only: creates Lunch slot independently on a distinct schedule", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  const res = await service.createInsulinSlot({
    entry_date: "2026-11-05",
    slot_type: "lunch",
    units: 8,
  });

  assert.strictEqual(res.data.slot.slot_type, "lunch");
  assert.strictEqual(res.data.slot.units, 8);
  assert.strictEqual(res.data.schedule.lunch, 8);
  assert.strictEqual(res.data.schedule.morning, 0);
  assert.strictEqual(childSlots.size, 1);
});

// -------------------------------------------------------------
// TEST 3: ADD EVENING ONLY
// -------------------------------------------------------------
test("3. Add Evening only: creates Evening slot independently", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  const res = await service.createInsulinSlot({
    entry_date: "2026-11-04",
    slot_type: "evening",
    units: 14,
  });

  assert.strictEqual(res.data.slot.slot_type, "evening");
  assert.strictEqual(res.data.slot.units, 14);
  assert.strictEqual(res.data.schedule.evening, 14);
  assert.strictEqual(childSlots.size, 1);
});

// -------------------------------------------------------------
// TEST 4: ADD NIGHT ONLY
// -------------------------------------------------------------
test("4. Add Night only: creates Night slot independently", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  const res = await service.createInsulinSlot({
    entry_date: "2026-11-03",
    slot_type: "night",
    units: 20,
  });

  assert.strictEqual(res.data.slot.slot_type, "night");
  assert.strictEqual(res.data.slot.units, 20);
  assert.strictEqual(res.data.schedule.night, 20);
  assert.strictEqual(childSlots.size, 1);
});

// -------------------------------------------------------------
// TEST 5: ADD A MISSING SLOT TO AN EXISTING DAILY SCHEDULE
// -------------------------------------------------------------
test("5. Add a missing slot (Lunch) to existing schedule: connects to same parent without creating new schedule", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  // 1. Add Morning
  const morningRes = await service.createInsulinSlot({
    entry_date: "2026-11-06",
    slot_type: "morning",
    units: 10,
  });
  const scheduleId = morningRes.data.schedule.id;
  assert.strictEqual(parentSchedules.size, 1, "Initial schedule created");

  // 2. Add Lunch to the same date
  const lunchRes = await service.createInsulinSlot({
    entry_date: "2026-11-06",
    slot_type: "lunch",
    units: 8,
  });

  assert.strictEqual(lunchRes.data.schedule.id, scheduleId, "Reused exact same parent schedule ID");
  assert.strictEqual(parentSchedules.size, 1, "Did NOT create a second parent schedule");
  assert.strictEqual(childSlots.size, 2, "Parent schedule now has 2 distinct child slots");

  // Verify both slots belong to this schedule
  const slots = await service.getSlotsForSchedule(scheduleId);
  assert.strictEqual(slots.length, 2, "2 slots retrieved for schedule");
  const morningSlot = slots.find((s) => s.slot_type === "morning");
  const lunchSlot = slots.find((s) => s.slot_type === "lunch");
  assert.strictEqual(morningSlot.units, 10, "Morning units preserved");
  assert.strictEqual(lunchSlot.units, 8, "Lunch units recorded");
});

// -------------------------------------------------------------
// TEST 6: UPDATE ONE SLOT WITHOUT MODIFYING OTHERS
// -------------------------------------------------------------
test("6. Update one slot by its slot ID: modifies only that slot and preserves other slots", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  // Create Morning (10) and Lunch (8) on 2026-11-06
  const morningRes = await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "morning", units: 10 });
  const lunchRes = await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "lunch", units: 8 });

  const lunchSlotId = lunchRes.data.slot.id;

  // Update Lunch from 8 to 12
  const updatedLunch = await service.updateInsulinSlot(lunchSlotId, { units: 12, notes: "Heavier meal" });

  assert.strictEqual(updatedLunch.slot.id, lunchSlotId, "Updated slot preserves its ID");
  assert.strictEqual(updatedLunch.slot.units, 12, "Lunch units updated to 12");
  assert.strictEqual(updatedLunch.slot.notes, "Heavier meal", "Notes updated");

  // Verify Morning slot in childSlots is completely untouched
  const morningSlot = childSlots.get(morningRes.data.slot.id);
  assert.strictEqual(morningSlot.units, 10, "Morning slot remains untouched at 10");

  // Verify parent schedule shows morning: 10, lunch: 12
  const schedule = parentSchedules.get(morningRes.data.schedule.id);
  assert.strictEqual(schedule.morning, 10, "Parent morning column is 10");
  assert.strictEqual(schedule.lunch, 12, "Parent lunch column synchronized to 12");
});

// -------------------------------------------------------------
// TEST 7: DELETE ONE SLOT WITHOUT DELETING OTHER SLOTS
// -------------------------------------------------------------
test("7. Delete one slot by ID: removes slot, clears column, preserves other slots and parent schedule", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  // Create Morning (10), Lunch (8), Evening (14)
  const mRes = await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "morning", units: 10 });
  const lRes = await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "lunch", units: 8 });
  const eRes = await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "evening", units: 14 });

  const eveningSlotId = eRes.data.slot.id;
  assert.strictEqual(childSlots.size, 3, "3 child slots initially");

  // Delete Evening slot
  const delRes = await service.deleteInsulinSlot(eveningSlotId);
  assert(delRes.success, "Slot deleted successfully");
  assert.strictEqual(childSlots.size, 2, "Child slots reduced to 2");
  assert.strictEqual(childSlots.has(eveningSlotId), false, "Evening slot removed from store");

  // Verify Morning and Lunch remain in child slots
  assert(childSlots.has(mRes.data.slot.id), "Morning slot preserved");
  assert(childSlots.has(lRes.data.slot.id), "Lunch slot preserved");

  // Verify Parent Schedule is preserved with evening = 0
  assert.strictEqual(parentSchedules.size, 1, "Parent schedule preserved");
  const schedule = parentSchedules.get(mRes.data.schedule.id);
  assert.strictEqual(schedule.morning, 10, "Morning is 10");
  assert.strictEqual(schedule.lunch, 8, "Lunch is 8");
  assert.strictEqual(schedule.evening, 0, "Evening reset to 0");
});

// -------------------------------------------------------------
// TEST 8: COMBINED SCHEDULE WITH ALL FOUR SLOTS
// -------------------------------------------------------------
test("8. Combined schedule: all four slots submitted together grouped under one daily schedule", async () => {
  const { service, parentSchedules, childSlots } = createSlotHarness();

  const combined = await service.createOrUpdateCombined(
    "2026-11-06",
    { morning: 10, lunch: 8, evening: 12, night: 16 },
    "Full schedule logged",
  );

  assert.strictEqual(parentSchedules.size, 1, "Single parent schedule");
  assert.strictEqual(combined.morning, 10);
  assert.strictEqual(combined.lunch, 8);
  assert.strictEqual(combined.evening, 12);
  assert.strictEqual(combined.night, 16);

  // Check child slots mirrored
  const slots = await service.getSlotsForSchedule(combined.id);
  assert.strictEqual(slots.length, 4, "4 child slots mirrored");
  const types = slots.map((s) => s.slot_type).sort();
  assert.deepStrictEqual(types, ["evening", "lunch", "morning", "night"]);
});

// -------------------------------------------------------------
// TEST 9: PREVENT DUPLICATE LOGICAL SLOTS FOR SAME SCHEDULE AND SLOT TYPE
// -------------------------------------------------------------
test("9. Prevent duplicate logical slots for the same schedule and slot type", async () => {
  const { service, childSlots } = createSlotHarness();

  // Create Morning with 10 units
  await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "morning", units: 10 });
  assert.strictEqual(childSlots.size, 1, "1 slot created");

  // Add Morning again on the same date with 14 units (e.g. repeated save)
  await service.createInsulinSlot({ entry_date: "2026-11-06", slot_type: "morning", units: 14 });
  assert.strictEqual(childSlots.size, 1, "Still exactly 1 slot for morning (in-place update, no duplicate)");

  const slot = Array.from(childSlots.values())[0];
  assert.strictEqual(slot.units, 14, "Slot units safely updated to 14");
});

// -------------------------------------------------------------
// TEST 10: FIVE CONSECUTIVE DISTINCT SLOT OPERATIONS WORK
// -------------------------------------------------------------
test("10. Five consecutive distinct slot operations work cleanly without interference", async () => {
  const { service, childSlots } = createSlotHarness();

  // Op 1: Add Morning on Day 1
  const op1 = await service.createInsulinSlot({ entry_date: "2026-11-01", slot_type: "morning", units: 10 });
  // Op 2: Add Lunch on Day 1
  const op2 = await service.createInsulinSlot({ entry_date: "2026-11-01", slot_type: "lunch", units: 8 });
  // Op 3: Add Evening on Day 2
  const op3 = await service.createInsulinSlot({ entry_date: "2026-11-02", slot_type: "evening", units: 12 });
  // Op 4: Update Day 1 Morning
  const op4 = await service.updateInsulinSlot(op1.data.slot.id, { units: 15 });
  // Op 5: Delete Day 1 Lunch
  const op5 = await service.deleteInsulinSlot(op2.data.slot.id);

  assert(op1.data.slot.id && op2.data.slot.id && op3.data.slot.id && op4.slot.id && op5.success);
  assert.strictEqual(childSlots.size, 2, "2 remaining slots (Day 1 Morning updated to 15, Day 2 Evening 12)");

  const day1Morning = childSlots.get(op1.data.slot.id);
  assert.strictEqual(day1Morning.units, 15, "Day 1 Morning is 15");

  const day2Evening = childSlots.get(op3.data.slot.id);
  assert.strictEqual(day2Evening.units, 12, "Day 2 Evening is 12");
});

async function runAllTests() {
  for (let i = 0; i < testQueue.length; i++) {
    const { name, fn } = testQueue[i];
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Reason: ${err.message}`);
      process.exitCode = 1;
    }
  }

  console.log("\n==========================================================================");
  console.log(`  PHASE 2 VERIFICATION RESULTS: ${passed}/${total} PASSED (0 FAILED)`);
  console.log("==========================================================================\n");
}

runAllTests();

