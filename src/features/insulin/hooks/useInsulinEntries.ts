/**
 * GLUCOLAB INSULIN COLLECTOR — REACT INTEGRATION HOOK
 * Manages daily record fetching, stale-response protection, optimistic updates, and concurrency locks
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { insulinService } from "../services/insulinService";
import type {
  InsulinEntryRecord,
  CreateInsulinInput,
  ClinicalSlot,
} from "../types/insulin.types";
import { validateDose } from "../utils/insulinValidation";

export interface UseInsulinEntriesOptions {
  initialDate?: string;
  autoFetch?: boolean;
}

export function useInsulinEntries(options: UseInsulinEntriesOptions = {}) {
  const [currentDate, setCurrentDate] = useState<string>(
    () => (options.initialDate || new Date().toISOString()).split("T")[0]
  );
  const [record, setRecord] = useState<InsulinEntryRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Request race condition / stale-response prevention
  const requestSeqRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);

  /**
   * Fetch daily record for a specific date with stale-response protection
   */
  const fetchForDate = useCallback(async (targetDate: string) => {
    const cleanDate = targetDate.split("T")[0];
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await insulinService.fetchDailyRecord(cleanDate);

      // Discard stale responses if user switched dates while in-flight
      if (seq !== requestSeqRef.current) {
        return;
      }

      if (res.error) {
        setError(res.error);
        setRecord(null);
      } else {
        setRecord(res.data);
      }
    } catch (err: any) {
      if (seq === requestSeqRef.current) {
        setError(err?.message || "Failed to load insulin entry.");
        setRecord(null);
      }
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Change active date
   */
  const changeDate = useCallback((newDate: string) => {
    const clean = newDate.split("T")[0];
    setCurrentDate(clean);
    fetchForDate(clean);
  }, [fetchForDate]);

  /**
   * Save or update daily record with double-click guard
   */
  const saveRecord = useCallback(
    async (
      doses: Record<ClinicalSlot, number | null>,
      notes?: string | null,
      customDate?: string
    ): Promise<InsulinEntryRecord | null> => {
      if (isSavingRef.current) {
        console.warn("[useInsulinEntries] Concurrent save blocked by submission guard.");
        return null;
      }

      isSavingRef.current = true;
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const targetDate = (customDate || currentDate).split("T")[0];

      try {
        const payload: CreateInsulinInput = {
          entry_date: targetDate,
          morning: validateDose(doses.morning, "morning").value ?? null,
          lunch: validateDose(doses.lunch, "lunch").value ?? null,
          afternoon: validateDose(doses.afternoon, "afternoon").value ?? null,
          evening: validateDose(doses.evening, "evening").value ?? null,
          night: validateDose(doses.night, "night").value ?? null,
          notes: notes ?? null,
        };

        const res = await insulinService.createDailyRecord(payload);

        if (res.error || !res.data) {
          setError(res.error || "Save failed.");
          return null;
        }

        setRecord(res.data);
        setSaveSuccess(true);
        return res.data;
      } catch (err: any) {
        setError(err?.message || "Failed to save insulin doses.");
        return null;
      } finally {
        setSaving(false);
        isSavingRef.current = false;
      }
    },
    [currentDate]
  );

  /**
   * Delete current record
   */
  const deleteRecord = useCallback(
    async (idOrDate?: string): Promise<boolean> => {
      const target = idOrDate || record?.id || currentDate;
      setSaving(true);
      setError(null);

      try {
        const res = await insulinService.deleteDailyRecord(target);
        if (res.error) {
          setError(res.error);
          return false;
        }

        setRecord(null);
        return true;
      } catch (err: any) {
        setError(err?.message || "Failed to delete record.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [record, currentDate]
  );

  // Auto fetch initial date if enabled
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchForDate(currentDate);
    }
  }, [currentDate, fetchForDate, options.autoFetch]);

  return {
    currentDate,
    record,
    loading,
    saving,
    error,
    saveSuccess,
    changeDate,
    refetch: () => fetchForDate(currentDate),
    saveRecord,
    deleteRecord,
  };
}

