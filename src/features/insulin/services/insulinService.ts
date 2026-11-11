/**
 * GLUCOLAB INSULIN COLLECTOR — AUTHORITATIVE BACKEND SERVICE
 * Directly integrates with public.insulin_entries and Supabase authentication.
 */

import { supabase, getLocalDbService } from "@/db/client";
import type {
  InsulinEntryRecord,
  CreateInsulinInput,
  UpdateInsulinInput,
  HistoricalInsulinOptions,
  HistoricalInsulinResult,
  InsulinServiceResult,
} from "../types/insulin.types";
import {
  validateCreatePayload,
  validateUpdatePayload,
  validateDate,
} from "../utils/insulinValidation";

export class InsulinService {
  /**
   * Helper to retrieve and strictly verify current authenticated user session
   */
  private async getAuthenticatedUser(): Promise<{ id: string }> {
    let user: any = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      user = session?.user;
    } catch {
      // Offline or network error
    }

    if (!user) {
      const { data: { user: fallbackUser }, error } = await supabase.auth.getUser();
      if (error || !fallbackUser) {
        throw new Error("You must be signed in to perform this insulin operation.");
      }
      user = fallbackUser;
    }

    if (!user?.id) {
      throw new Error("Invalid patient session: Missing user identifier.");
    }

    return { id: user.id };
  }

  /**
   * Dispatches a global event so UI components (dashboard, charts, history) can refresh
   */
  private notifyDataChanged(action: "create" | "update" | "delete", recordId?: string, date?: string) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("health-data-updated", {
          detail: { entity: "insulin", action, id: recordId, date },
        })
      );
    }
  }

  /**
   * A. FETCH DAILY INSULIN RECORD
   * Queries local SQLite cache first for instant response, then Supabase with timeout.
   * Preserves NULL values and explicit 0.00 values accurately.
   */
  async fetchDailyRecord(entryDate: string): Promise<InsulinServiceResult<InsulinEntryRecord>> {
    try {
      const { cleanDate, error: dateErr } = validateDate(entryDate);
      if (dateErr || !cleanDate) {
        return { data: null, error: dateErr || "Invalid date." };
      }

      const user = await this.getAuthenticatedUser();

      // 1. Fast Path: Check local SQLite cache first (<5ms)
      try {
        const localDb = await getLocalDbService();
        const localRecords = await localDb.getInsulin(user.id);
        const match = localRecords.find((r: any) => r.entry_date?.split("T")[0] === cleanDate);
        if (match && match.sync_status === "pending_sync") {
          return { data: match as InsulinEntryRecord, error: null };
        }
      } catch (sqliteErr) {
        console.warn("[InsulinService] Local SQLite pre-lookup notice:", sqliteErr);
      }

      // 2. Query Supabase with a 3-second timeout to prevent UI hanging
      const fetchPromise = supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("entry_date", cleanDate)
        .maybeSingle();

      const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
        setTimeout(() => reject(new Error("Supabase fetch timeout")), 3000)
      );

      let data: any = null;
      let error: any = null;

      try {
        const res = await Promise.race([fetchPromise, timeoutPromise]);
        data = res.data;
        error = res.error;
      } catch (timeoutErr: any) {
        error = timeoutErr;
      }

      if (error) {
        console.warn("[InsulinService] Supabase fetch error/timeout, checking local cache:", error.message);
        // Fallback to local SQLite cache if offline or timed out
        try {
          const localDb = await getLocalDbService();
          const localRecords = await localDb.getInsulin(user.id);
          const match = localRecords.find((r: any) => r.entry_date?.split("T")[0] === cleanDate);
          if (match) {
            return { data: match as InsulinEntryRecord, error: null };
          }
        } catch (sqliteErr) {
          console.warn("[InsulinService] Local SQLite offline fallback notice:", sqliteErr);
        }
        if (error.message?.includes("timeout")) {
          return { data: null, error: null }; // Treat timeout gracefully as not found or offline
        }
        return { data: null, error: error.message };
      }

      if (data) {
        // Cache to local SQLite in background
        try {
          const localDb = await getLocalDbService();
          await localDb.cacheInsulin([data]);
        } catch {}
      }

      return { data: (data as InsulinEntryRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to fetch daily insulin record." };
    }
  }

  /**
   * B. CREATE INSULIN RECORD
   * Inserts into public.insulin_entries using authenticated user_id.
   * Handles duplicate daily records idempotently using the (user_id, entry_date) unique constraint.
   */
  async createDailyRecord(input: CreateInsulinInput): Promise<InsulinServiceResult<InsulinEntryRecord>> {
    try {
      const { isValid, cleanPayload, error: valErr } = validateCreatePayload(input);
      if (!isValid || !cleanPayload) {
        return { data: null, error: valErr || "Validation failed for insulin record." };
      }

      const user = await this.getAuthenticatedUser();

      const localRow: any = {
        user_id: user.id,
        entry_date: cleanPayload.entry_date,
        morning: cleanPayload.morning,
        lunch: cleanPayload.lunch,
        afternoon: cleanPayload.afternoon,
        evening: cleanPayload.evening,
        night: cleanPayload.night,
        notes: cleanPayload.notes,
        revision: 1,
        updated_at: new Date().toISOString(),
        sync_status: "pending_sync",
      };

      if (cleanPayload.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanPayload.id)) {
        localRow.id = cleanPayload.id;
      } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
        localRow.id = crypto.randomUUID();
      }

      // 1. Fast Local SQLite persistence (<10ms) before cloud sync
      try {
        const localDb = await getLocalDbService();
        await localDb.cacheInsulin([localRow]);
      } catch (cacheErr) {
        console.warn("[InsulinService] Fast local cache save warning:", cacheErr);
      }

      // 2. Cloud synchronization with Supabase (strictly send valid remote columns)
      const remotePayload: any = {
        user_id: user.id,
        entry_date: cleanPayload.entry_date,
        morning: cleanPayload.morning,
        lunch: cleanPayload.lunch,
        afternoon: cleanPayload.afternoon,
        evening: cleanPayload.evening,
        night: cleanPayload.night,
        notes: cleanPayload.notes,
      };

      if (cleanPayload.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanPayload.id)) {
        remotePayload.id = cleanPayload.id;
      }

      const { data, error } = await supabase
        .from("insulin_entries")
        .upsert(remotePayload, { onConflict: "user_id,entry_date" })
        .select()
        .single();

      if (error) {
        // If offline or network disconnected, return local record gracefully
        const isNetworkError =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          error.message?.includes("fetch") ||
          error.message?.includes("network") ||
          error.message?.includes("Failed to fetch");

        if (isNetworkError) {
          console.log("[InsulinService] Network unreachable: saved locally in SQLite");
          this.notifyDataChanged("create", localRow.id, localRow.entry_date);
          return { data: localRow as InsulinEntryRecord, error: null };
        }

        // Rollback local SQLite cache on validation/database error
        try {
          const localDb = await getLocalDbService();
          await localDb.deleteInsulin(localRow.entry_date);
        } catch {}

        console.error("[InsulinService] Database error creating daily record:", error);
        return { data: null, error: error.message };
      }

      const savedRecord = { ...data, sync_status: "synced" } as InsulinEntryRecord;

      // 3. Mark local SQLite record as synced
      try {
        const localDb = await getLocalDbService();
        await localDb.cacheInsulin([savedRecord]);
      } catch (cacheErr) {
        console.warn("[InsulinService] Local cache sync update warning:", cacheErr);
      }

      this.notifyDataChanged("create", savedRecord.id, savedRecord.entry_date);
      return { data: savedRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to create insulin record." };
    }
  }

  /**
   * C. UPDATE EXISTING RECORD
   * Updates an existing record for the authenticated user without overwriting untouched fields with NULL.
   */
  async updateDailyRecord(
    idOrDate: string,
    input: UpdateInsulinInput
  ): Promise<InsulinServiceResult<InsulinEntryRecord>> {
    try {
      const { isValid, cleanPayload, error: valErr } = validateUpdatePayload(input);
      if (!isValid || !cleanPayload) {
        return { data: null, error: valErr || "Validation failed for update." };
      }

      const user = await this.getAuthenticatedUser();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrDate);
      const isDate = /^\d{4}-\d{2}-\d{2}/.test(idOrDate);
      const cleanDate = cleanPayload.entry_date || (isDate ? idOrDate.split("T")[0] : undefined);

      // 1. Build partial update data preserving untouched fields (for remote Supabase)
      const remoteUpdateData: any = {};

      if (cleanPayload.morning !== undefined) remoteUpdateData.morning = cleanPayload.morning;
      if (cleanPayload.lunch !== undefined) remoteUpdateData.lunch = cleanPayload.lunch;
      if (cleanPayload.afternoon !== undefined) remoteUpdateData.afternoon = cleanPayload.afternoon;
      if (cleanPayload.evening !== undefined) remoteUpdateData.evening = cleanPayload.evening;
      if (cleanPayload.night !== undefined) remoteUpdateData.night = cleanPayload.night;
      if (cleanPayload.notes !== undefined) remoteUpdateData.notes = cleanPayload.notes;

      // Local-first durable persistence: Update local SQLite cache FIRST with pending_sync
      let localTarget: any = null;
      try {
        const localDb = await getLocalDbService();
        const localEntries = await localDb.getInsulin(user.id);
        localTarget = localEntries.find(
          (r: any) =>
            (isUuid && r.id === idOrDate) ||
            (cleanDate && r.entry_date?.split("T")[0] === cleanDate)
        );
        if (localTarget) {
          const merged = {
            ...localTarget,
            ...remoteUpdateData,
            revision: (localTarget.revision || 1) + 1,
            updated_at: new Date().toISOString(),
            sync_status: "pending_sync",
          };
          await localDb.cacheInsulin([merged]);
        }
      } catch (sqliteErr) {
        console.warn("[InsulinService] Local SQLite pre-update notice:", sqliteErr);
      }

      // 2. Direct atomic UPDATE (1 network round-trip instead of 2)
      let updateQuery = supabase
        .from("insulin_entries")
        .update(remoteUpdateData)
        .eq("user_id", user.id);

      if (isUuid) {
        updateQuery = updateQuery.eq("id", idOrDate);
      } else if (cleanDate) {
        updateQuery = updateQuery.eq("entry_date", cleanDate);
      } else {
        // If neither UUID nor date, fallback to createDailyRecord
        const createPayload: CreateInsulinInput = {
          entry_date: cleanPayload.entry_date || new Date().toISOString().split("T")[0],
          morning: cleanPayload.morning !== undefined ? cleanPayload.morning : (localTarget?.morning ?? null),
          lunch: cleanPayload.lunch !== undefined ? cleanPayload.lunch : (localTarget?.lunch ?? null),
          afternoon: cleanPayload.afternoon !== undefined ? cleanPayload.afternoon : (localTarget?.afternoon ?? null),
          evening: cleanPayload.evening !== undefined ? cleanPayload.evening : (localTarget?.evening ?? null),
          night: cleanPayload.night !== undefined ? cleanPayload.night : (localTarget?.night ?? null),
          notes: cleanPayload.notes !== undefined ? cleanPayload.notes : (localTarget?.notes ?? null),
        };
        return this.createDailyRecord(createPayload);
      }

      const { data: updated, error: updateErr } = await updateQuery.select().maybeSingle();

      if (updateErr) {
        const isNetworkError =
          (typeof navigator !== "undefined" && !navigator.onLine) ||
          updateErr.message?.includes("fetch") ||
          updateErr.message?.includes("network") ||
          updateErr.message?.includes("Failed to fetch");

        if (isNetworkError && localTarget) {
          const merged = { ...localTarget, ...remoteUpdateData, sync_status: "pending_sync" };
          this.notifyDataChanged("update", merged.id, merged.entry_date);
          return { data: merged as InsulinEntryRecord, error: null };
        }

        console.error("[InsulinService] Database error updating daily record:", updateErr);
        return { data: null, error: updateErr.message };
      }

      if (!updated) {
        // Record did not exist yet on server, seamlessly create it while preserving any existing local slots
        const createPayload: CreateInsulinInput = {
          entry_date: cleanDate || new Date().toISOString().split("T")[0],
          morning: cleanPayload.morning !== undefined ? cleanPayload.morning : (localTarget?.morning ?? null),
          lunch: cleanPayload.lunch !== undefined ? cleanPayload.lunch : (localTarget?.lunch ?? null),
          afternoon: cleanPayload.afternoon !== undefined ? cleanPayload.afternoon : (localTarget?.afternoon ?? null),
          evening: cleanPayload.evening !== undefined ? cleanPayload.evening : (localTarget?.evening ?? null),
          night: cleanPayload.night !== undefined ? cleanPayload.night : (localTarget?.night ?? null),
          notes: cleanPayload.notes !== undefined ? cleanPayload.notes : (localTarget?.notes ?? null),
          ...(isUuid ? { id: idOrDate } : {}),
        };
        return this.createDailyRecord(createPayload);
      }

      const savedRecord = { ...updated, sync_status: "synced" } as InsulinEntryRecord;

      // 3. Update local SQLite cache in background with synced status
      try {
        const localDb = await getLocalDbService();
        await localDb.cacheInsulin([savedRecord]);
      } catch (cacheErr) {
        console.warn("[InsulinService] Background cache save warning:", cacheErr);
      }

      this.notifyDataChanged("update", savedRecord.id, savedRecord.entry_date);
      return { data: savedRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to update insulin record." };
    }
  }

  /**
   * D. HISTORICAL RECORD RETRIEVAL
   * Queries historical records for the authenticated user with optional date range,
   * sorted by entry_date descending with pagination support.
   */
  async getHistoricalRecords(
    options: HistoricalInsulinOptions = {}
  ): Promise<InsulinServiceResult<HistoricalInsulinResult>> {
    try {
      const user = await this.getAuthenticatedUser();
      const limit = Math.min(200, Math.max(1, options.limit || 50));
      const offset = Math.max(0, options.offset || 0);

      let query = supabase
        .from("insulin_entries")
        .select("*", { count: "exact" })
        .eq("user_id", user.id);

      if (options.from) {
        const fromDate = options.from.split("T")[0];
        query = query.gte("entry_date", fromDate);
      }

      if (options.to) {
        const toDate = options.to.split("T")[0];
        query = query.lte("entry_date", toDate);
      }

      query = query
        .order("entry_date", { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        console.warn("[InsulinService] Historical query error, checking local cache:", error);
        try {
          const localDb = await getLocalDbService();
          const localEntries = await localDb.getInsulin(user.id);
          let filtered = localEntries;
          if (options.from) {
            filtered = filtered.filter((e: any) => e.entry_date >= options.from!.split("T")[0]);
          }
          if (options.to) {
            filtered = filtered.filter((e: any) => e.entry_date <= options.to!.split("T")[0]);
          }
          const paged = filtered.slice(offset, offset + limit);
          return {
            data: {
              entries: paged as InsulinEntryRecord[],
              totalCount: filtered.length,
              hasMore: offset + limit < filtered.length,
            },
            error: null,
          };
        } catch {
          return { data: null, error: error.message };
        }
      }

      const totalCount = count ?? (data?.length || 0);
      const entries = (data || []) as InsulinEntryRecord[];
      const hasMore = offset + limit < totalCount;

      return {
        data: {
          entries,
          totalCount,
          hasMore,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to retrieve historical insulin records." };
    }
  }

  /**
   * E. DELETE OPERATION
   * Deletes a daily insulin record by ID or entry date for the authenticated user.
   */
  async deleteDailyRecord(idOrDate: string): Promise<InsulinServiceResult<{ success: boolean; id: string }>> {
    try {
      if (!idOrDate) {
        return { data: null, error: "Missing required record ID or date for deletion." };
      }

      const user = await this.getAuthenticatedUser();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrDate);

      let deleteQuery = supabase.from("insulin_entries").delete().eq("user_id", user.id);
      if (isUuid) {
        deleteQuery = deleteQuery.eq("id", idOrDate);
      } else {
        deleteQuery = deleteQuery.eq("entry_date", idOrDate.split("T")[0]);
      }

      const { data, error } = await deleteQuery.select().maybeSingle();

      if (error) {
        console.error("[InsulinService] Database error deleting record:", error);
        return { data: null, error: error.message };
      }

      const deletedId = data?.id || idOrDate;

      // Clean local cache
      try {
        const localDb = await getLocalDbService();
        await localDb.deleteInsulin(deletedId);
      } catch (cacheErr) {
        console.warn("[InsulinService] Local cache delete notice:", cacheErr);
      }

      this.notifyDataChanged("delete", deletedId, data?.entry_date);
      return { data: { success: true, id: deletedId }, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || "Failed to delete insulin record." };
    }
  }
}

export const insulinService = new InsulinService();
