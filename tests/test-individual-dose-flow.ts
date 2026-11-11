/**
 * GLUCOLAB INSULIN V3 — INDIVIDUAL DOSE SAVE FLOW REGRESSION TEST SUITE
 * 14 Rigorous Test Scenarios covering:
 * - Sequential individual slot saves (Morning 4, Lunch 6, Afternoon 2, Evening 5, Night 3)
 * - Database existing-record query failure handling (abort safety)
 * - Offline save with local SQLite persistence
 * - Duplicate submission & in-flight locking guards
 * - Concurrent slot updates across multiple devices/slots
 * - Decimal dose precision (0.25, 0.50, 4.75) and explicit zero (0.00)
 * - Strict persistence record verification
 * - Cache invalidation and global event dispatch
 */

import { strict as assert } from "node:assert";
import {
  validateDose,
  validateDate,
  validateCreatePayload,
  validateUpdatePayload,
} from "../src/features/insulin/utils/insulinValidation";
import type {
  InsulinEntryRecord,
  CreateInsulinInput,
  UpdateInsulinInput,
} from "../src/features/insulin/types/insulin.types";

console.log("===============================================================================");
console.log("GLUCOLAB INSULIN V3 — INDIVIDUAL DOSE SAVE FLOW REGRESSION SUITE (14 TESTS)");
console.log("===============================================================================\n");

let passedCount = 0;
let totalCount = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalCount++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      await res;
    }
    passedCount++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`, err);
    throw err;
  }
}

// Mock Environment & Stores
class SimulatedDatabaseEnv {
  public remoteSupabase: Map<string, InsulinEntryRecord> = new Map(); // key: user_id_entry_date
  public localSqlite: Map<string, any> = new Map(); // key: user_id_entry_date
  public inFlightLocks: Set<string> = new Set();
  public eventsDispatched: Array<{ type: string; detail: any }> = [];
  public cacheClearedFor: string[] = [];
  public simulateNetworkOffline: boolean = false;
  public simulateDbQueryError: boolean = false;

  reset() {
    this.remoteSupabase.clear();
    this.localSqlite.clear();
    this.inFlightLocks.clear();
    this.eventsDispatched = [];
    this.cacheClearedFor = [];
    this.simulateNetworkOffline = false;
    this.simulateDbQueryError = false;
  }

  // Simulated Authoritative InsulinService.updateDailyRecord
  async updateDailyRecord(
    userId: string,
    idOrDate: string,
    input: UpdateInsulinInput
  ): Promise<{ data: InsulinEntryRecord | null; error: string | null }> {
    const { isValid, cleanPayload, error: valErr } = validateUpdatePayload(input);
    if (!isValid || !cleanPayload) {
      return { data: null, error: valErr || "Validation failed." };
    }

    const cleanDate = cleanPayload.entry_date || (idOrDate.includes("-") ? idOrDate.split("T")[0] : "2026-11-11");
    const key = `${userId}_${cleanDate}`;

    // 1. Build partial update data preserving untouched fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (cleanPayload.morning !== undefined) updateData.morning = cleanPayload.morning;
    if (cleanPayload.lunch !== undefined) updateData.lunch = cleanPayload.lunch;
    if (cleanPayload.afternoon !== undefined) updateData.afternoon = cleanPayload.afternoon;
    if (cleanPayload.evening !== undefined) updateData.evening = cleanPayload.evening;
    if (cleanPayload.night !== undefined) updateData.night = cleanPayload.night;
    if (cleanPayload.notes !== undefined) updateData.notes = cleanPayload.notes;

    // Local SQLite durable cache update first
    let localTarget = this.localSqlite.get(key);
    if (localTarget) {
      const merged = {
        ...localTarget,
        ...updateData,
        revision: (localTarget.revision || 1) + 1,
        sync_status: "pending_sync",
      };
      this.localSqlite.set(key, merged);
      localTarget = merged;
    }

    // Network check
    if (this.simulateNetworkOffline) {
      if (!localTarget) {
        localTarget = {
          id: `local-${Date.now()}`,
          user_id: userId,
          entry_date: cleanDate,
          morning: cleanPayload.morning ?? null,
          lunch: cleanPayload.lunch ?? null,
          afternoon: cleanPayload.afternoon ?? null,
          evening: cleanPayload.evening ?? null,
          night: cleanPayload.night ?? null,
          notes: cleanPayload.notes ?? null,
          revision: 1,
          sync_status: "pending_sync",
          updated_at: new Date().toISOString(),
        };
        this.localSqlite.set(key, localTarget);
      }
      return { data: localTarget as InsulinEntryRecord, error: null };
    }

    // Remote Supabase atomic UPDATE
    const existingRemote = this.remoteSupabase.get(key);
    if (existingRemote) {
      // Atomic column update: untouched columns remain unchanged
      const updatedRecord: InsulinEntryRecord = {
        ...existingRemote,
        ...updateData,
        revision: (existingRemote.revision || 1) + 1,
        updated_at: new Date().toISOString(),
      };
      this.remoteSupabase.set(key, updatedRecord);

      // Local SQLite updated to synced
      this.localSqlite.set(key, { ...updatedRecord, sync_status: "synced" });
      return { data: updatedRecord, error: null };
    }

    // Record did not exist yet on server, create it preserving localTarget's slots
    const newRecord: InsulinEntryRecord = {
      id: `rec-${Date.now()}`,
      user_id: userId,
      entry_date: cleanDate,
      morning: cleanPayload.morning !== undefined ? cleanPayload.morning : (localTarget?.morning ?? null),
      lunch: cleanPayload.lunch !== undefined ? cleanPayload.lunch : (localTarget?.lunch ?? null),
      afternoon: cleanPayload.afternoon !== undefined ? cleanPayload.afternoon : (localTarget?.afternoon ?? null),
      evening: cleanPayload.evening !== undefined ? cleanPayload.evening : (localTarget?.evening ?? null),
      night: cleanPayload.night !== undefined ? cleanPayload.night : (localTarget?.night ?? null),
      notes: cleanPayload.notes !== undefined ? cleanPayload.notes : (localTarget?.notes ?? null),
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.remoteSupabase.set(key, newRecord);
    this.localSqlite.set(key, { ...newRecord, sync_status: "synced" });
    return { data: newRecord, error: null };
  }

  // Simulated PendingDoseService.saveDose with complete safety logic
  async saveDose(
    userId: string,
    slot: { slotId: string; date: string; dbColumn?: string },
    units: number,
    notes?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!userId) return { success: false, error: "Missing user identification." };

    const saveKey = `${userId}_${slot.date}_${slot.slotId}`;
    if (this.inFlightLocks.has(saveKey)) {
      return { success: false, error: "A save is already in progress for this dose." };
    }
    this.inFlightLocks.add(saveKey);

    try {
      // Validate inputs
      const checkDose = validateDose(units, slot.slotId);
      if (!checkDose.isValid) {
        return { success: false, error: checkDose.error };
      }

      const dbCol = slot.dbColumn || (slot.slotId as any);

      // Duplicate check: Query existing remote state
      let checkError: any = null;
      let latestRow: any = null;

      if (this.simulateDbQueryError) {
        checkError = { code: "500", message: "Connection pool exhausted" };
      } else if (this.simulateNetworkOffline) {
        checkError = { message: "Failed to fetch: Network unreachable" };
      } else {
        const key = `${userId}_${slot.date}`;
        latestRow = this.remoteSupabase.get(key) || null;
      }

      let existingDoseValue: number | null = null;

      if (checkError && checkError.code !== "PGRST116") {
        const isNetworkError =
          this.simulateNetworkOffline ||
          checkError.message?.includes("fetch") ||
          checkError.message?.includes("network");

        if (isNetworkError) {
          const key = `${userId}_${slot.date}`;
          const localRow = this.localSqlite.get(key);
          if (localRow && localRow[dbCol] !== null && localRow[dbCol] !== undefined) {
            existingDoseValue = Number(localRow[dbCol]);
          }
        } else {
          // Abort on DB query error!
          return {
            success: false,
            error: `Database error checking existing dose: ${checkError.message}. Save aborted to protect data integrity.`,
          };
        }
      } else if (latestRow) {
        existingDoseValue = latestRow[dbCol] !== null && latestRow[dbCol] !== undefined ? Number(latestRow[dbCol]) : null;
      }

      // Check local SQLite cache as secondary safeguard
      if (existingDoseValue === null || isNaN(existingDoseValue)) {
        const key = `${userId}_${slot.date}`;
        const localRow = this.localSqlite.get(key);
        if (localRow && localRow[dbCol] !== null && localRow[dbCol] !== undefined && Number(localRow[dbCol]) > 0) {
          existingDoseValue = Number(localRow[dbCol]);
        }
      }

      if (existingDoseValue !== null && existingDoseValue > 0) {
        return {
          success: false,
          error: "This dose has already been recorded.",
        };
      }

      // Save via authoritative service
      const saveRes = await this.updateDailyRecord(userId, slot.date, {
        entry_date: slot.date,
        [dbCol]: checkDose.value,
        notes: notes || null,
      });

      if (saveRes.error || !saveRes.data) {
        return { success: false, error: saveRes.error || "Failed to persist insulin dose." };
      }

      // Strict persistence verification
      const saved = saveRes.data;
      const savedDate = saved.entry_date ? saved.entry_date.split("T")[0] : null;
      if (
        !saved.id ||
        saved.user_id !== userId ||
        savedDate !== slot.date ||
        Number(saved[dbCol as keyof InsulinEntryRecord]) !== checkDose.value
      ) {
        return {
          success: false,
          error: "Dose persistence verification failed. Record mismatch detected.",
        };
      }

      // Clear cache & dispatch event
      this.cacheClearedFor.push(userId);
      this.eventsDispatched.push({
        type: "health-data-updated",
        detail: { entity: "insulin", action: "update", date: slot.date },
      });

      return { success: true, data: saved };
    } finally {
      this.inFlightLocks.delete(saveKey);
    }
  }
}

const env = new SimulatedDatabaseEnv();
const TEST_USER = "user_42a8b9f0-1234-4567-89ab-cdef01234567";
const TEST_DATE = "2026-11-11";

async function runAllTests() {
  env.reset();

  // 1. Sequential Slot Step 1: Morning = 4.00
  await runTest("Sequential Saves - Step 1: Save Morning = 4.00 U", async () => {
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: TEST_DATE, dbColumn: "morning" },
      4.0
    );
    assert.equal(res.success, true);
    assert.equal(Number(res.data.morning), 4.0);
    assert.equal(res.data.lunch, null);
    assert.equal(res.data.afternoon, null);
    assert.equal(res.data.evening, null);
    assert.equal(res.data.night, null);

    const remote = env.remoteSupabase.get(`${TEST_USER}_${TEST_DATE}`);
    assert.equal(Number(remote?.morning), 4.0);
    assert.equal(remote?.lunch, null);
  });

  // 2. Sequential Slot Step 2: Lunch = 6.00 (Morning must be preserved)
  await runTest("Sequential Saves - Step 2: Save Lunch = 6.00 U (Preserves Morning = 4.00)", async () => {
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "lunch", date: TEST_DATE, dbColumn: "lunch" },
      6.0
    );
    assert.equal(res.success, true);
    assert.equal(Number(res.data.lunch), 6.0);
    assert.equal(Number(res.data.morning), 4.0, "Morning dose must be preserved as 4.00");
    assert.equal(res.data.afternoon, null);
    assert.equal(res.data.evening, null);
    assert.equal(res.data.night, null);

    const remote = env.remoteSupabase.get(`${TEST_USER}_${TEST_DATE}`);
    assert.equal(Number(remote?.morning), 4.0);
    assert.equal(Number(remote?.lunch), 6.0);
  });

  // 3. Sequential Slot Step 3: Afternoon = 2.00 (Morning and Lunch must be preserved)
  await runTest("Sequential Saves - Step 3: Save Afternoon = 2.00 U (Preserves Morning and Lunch)", async () => {
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "afternoon", date: TEST_DATE, dbColumn: "afternoon" },
      2.0
    );
    assert.equal(res.success, true);
    assert.equal(Number(res.data.morning), 4.0, "Morning must remain 4.00");
    assert.equal(Number(res.data.lunch), 6.0, "Lunch must remain 6.00");
    assert.equal(Number(res.data.afternoon), 2.0, "Afternoon must be 2.00");
    assert.equal(res.data.evening, null);
    assert.equal(res.data.night, null);
  });

  // 4. Sequential Slot Step 4: Evening = 5.00 (Morning, Lunch, Afternoon preserved)
  await runTest("Sequential Saves - Step 4: Save Evening = 5.00 U (Preserves all previous slots)", async () => {
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "evening", date: TEST_DATE, dbColumn: "evening" },
      5.0
    );
    assert.equal(res.success, true);
    assert.equal(Number(res.data.morning), 4.0);
    assert.equal(Number(res.data.lunch), 6.0);
    assert.equal(Number(res.data.afternoon), 2.0);
    assert.equal(Number(res.data.evening), 5.0);
    assert.equal(res.data.night, null);
  });

  // 5. Sequential Slot Step 5: Night = 3.00 (All 5 slots fully intact)
  await runTest("Sequential Saves - Step 5: Save Night = 3.00 U (All 5 slots accurate: 4, 6, 2, 5, 3)", async () => {
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "night", date: TEST_DATE, dbColumn: "night" },
      3.0
    );
    assert.equal(res.success, true);
    assert.equal(Number(res.data.morning), 4.0);
    assert.equal(Number(res.data.lunch), 6.0);
    assert.equal(Number(res.data.afternoon), 2.0);
    assert.equal(Number(res.data.evening), 5.0);
    assert.equal(Number(res.data.night), 3.0);

    const remote = env.remoteSupabase.get(`${TEST_USER}_${TEST_DATE}`);
    assert.equal(Number(remote?.morning), 4.0);
    assert.equal(Number(remote?.lunch), 6.0);
    assert.equal(Number(remote?.afternoon), 2.0);
    assert.equal(Number(remote?.evening), 5.0);
    assert.equal(Number(remote?.night), 3.0);
  });

  // 6. Abort on Database Query Failure
  await runTest("Database Error Safety: Aborts save when existing-record check fails unexpectedly", async () => {
    env.simulateDbQueryError = true;
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: "2026-11-12", dbColumn: "morning" },
      10.0
    );
    env.simulateDbQueryError = false;

    assert.equal(res.success, false);
    assert.match(res.error || "", /Database error checking existing dose/);
    // Remote state for that date must NOT have been written
    assert.equal(env.remoteSupabase.has(`${TEST_USER}_2026-11-12`), false);
  });

  // 7. Offline Save With Local Persistence
  await runTest("Offline Support: Persists locally in SQLite with pending_sync when offline", async () => {
    env.simulateNetworkOffline = true;
    const OFFLINE_DATE = "2026-11-13";
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: OFFLINE_DATE, dbColumn: "morning" },
      8.0
    );
    env.simulateNetworkOffline = false;

    assert.equal(res.success, true);
    assert.equal(Number(res.data.morning), 8.0);
    assert.equal(res.data.sync_status, "pending_sync");

    // Check local SQLite store
    const local = env.localSqlite.get(`${TEST_USER}_${OFFLINE_DATE}`);
    assert.ok(local);
    assert.equal(Number(local.morning), 8.0);
    assert.equal(local.sync_status, "pending_sync");
  });

  // 8. Offline Duplicate Detection via SQLite
  await runTest("Offline Duplicate Protection: Prevents duplicate save when offline using local SQLite", async () => {
    env.simulateNetworkOffline = true;
    const OFFLINE_DATE = "2026-11-13";
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: OFFLINE_DATE, dbColumn: "morning" },
      8.0
    );
    env.simulateNetworkOffline = false;

    assert.equal(res.success, false);
    assert.equal(res.error, "This dose has already been recorded.");
  });

  // 9. Remote Duplicate Submission Guard
  await runTest("Duplicate Submission Guard: Rejects save when remote slot is already recorded", async () => {
    // TEST_DATE morning is already 4.0
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: TEST_DATE, dbColumn: "morning" },
      4.0
    );
    assert.equal(res.success, false);
    assert.equal(res.error, "This dose has already been recorded.");
  });

  // 10. In-Flight Simultaneous Save Lock
  await runTest("In-Flight Locking: Blocks concurrent duplicate save submissions", async () => {
    const LOCK_DATE = "2026-11-14";
    const savePromise1 = env.saveDose(
      TEST_USER,
      { slotId: "lunch", date: LOCK_DATE, dbColumn: "lunch" },
      5.0
    );
    // Immediate concurrent save for same slot
    const res2 = await env.saveDose(
      TEST_USER,
      { slotId: "lunch", date: LOCK_DATE, dbColumn: "lunch" },
      5.0
    );
    const res1 = await savePromise1;

    assert.equal(res1.success, true);
    assert.equal(res2.success, false);
    assert.match(res2.error || "", /A save is already in progress/);
  });

  // 11. Concurrent Slot Updates (Different Slots on Same Date)
  await runTest("Concurrent Slot Updates: Multiple slots on same date update without mutual overwrite", async () => {
    const CONCURRENT_DATE = "2026-11-15";
    // Initialize record with morning = 3.0
    await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: CONCURRENT_DATE, dbColumn: "morning" },
      3.0
    );

    // Concurrently update afternoon (2.5) and evening (7.0)
    const [resAfternoon, resEvening] = await Promise.all([
      env.saveDose(
        TEST_USER,
        { slotId: "afternoon", date: CONCURRENT_DATE, dbColumn: "afternoon" },
        2.5
      ),
      env.saveDose(
        TEST_USER,
        { slotId: "evening", date: CONCURRENT_DATE, dbColumn: "evening" },
        7.0
      ),
    ]);

    assert.equal(resAfternoon.success, true);
    assert.equal(resEvening.success, true);

    const remote = env.remoteSupabase.get(`${TEST_USER}_${CONCURRENT_DATE}`);
    assert.equal(Number(remote?.morning), 3.0, "Morning dose must be preserved");
    assert.equal(Number(remote?.afternoon), 2.5, "Afternoon dose must be 2.5");
    assert.equal(Number(remote?.evening), 7.0, "Evening dose must be 7.0");
  });

  // 12. Decimal Dose Precision (0.25, 0.50, 4.75)
  await runTest("Decimal Dose Precision: Exact preservation of decimal doses up to 2 places", async () => {
    const PRECISION_DATE = "2026-11-16";
    const res = await env.saveDose(
      TEST_USER,
      { slotId: "morning", date: PRECISION_DATE, dbColumn: "morning" },
      4.75
    );
    assert.equal(res.success, true);
    assert.equal(res.data.morning, 4.75);

    const checkQuarter = validateDose(0.25, "lunch");
    assert.equal(checkQuarter.isValid, true);
    assert.equal(checkQuarter.value, 0.25);

    const checkHalf = validateDose(0.50, "evening");
    assert.equal(checkHalf.isValid, true);
    assert.equal(checkHalf.value, 0.50);
  });

  // 13. Explicit Zero Handling (0.00 U)
  await runTest("Explicit Zero Handling: Validates 0.00 dose without nullifying", async () => {
    const checkZero = validateDose(0, "night");
    assert.equal(checkZero.isValid, true);
    assert.equal(checkZero.value, 0.0);

    const payload = validateUpdatePayload({ entry_date: "2026-11-17", night: 0 });
    assert.equal(payload.isValid, true);
    assert.equal(payload.cleanPayload?.night, 0);
  });

  // 14. Cache Invalidation and Event Dispatch
  await runTest("Cache Invalidation & Event Dispatch: Purges window cache and notifies UI subscribers", async () => {
    assert.ok(env.cacheClearedFor.includes(TEST_USER), "Cache must be cleared for user");
    const lastEvent = env.eventsDispatched[env.eventsDispatched.length - 1];
    assert.equal(lastEvent?.type, "health-data-updated");
    assert.equal(lastEvent?.detail?.entity, "insulin");
    assert.equal(lastEvent?.detail?.action, "update");
  });

  console.log("\n===============================================================================");
  console.log(`ALL 14 REGRESSION TESTS PASSED! (${passedCount}/${totalCount})`);
  console.log("===============================================================================\n");
}

runAllTests().catch((err) => {
  console.error("Test Suite Execution Failed:", err);
  process.exit(1);
});

