/**
 * GLUCOLAB INSULIN COLLECTOR — DATA VALIDATION UTILITIES
 * Pure validation functions enforcing NUMERIC(5,2) constraints and NULL vs 0.00 distinction
 */

import type {
  CreateInsulinInput,
  UpdateInsulinInput,
  DoseValidationResult,
} from "../types/insulin.types";

export const MAX_SAFE_INSULIN_DOSE = 200.0;
export const MIN_SAFE_INSULIN_DOSE = 0.0;
export const MAX_NOTES_LENGTH = 500;

/**
 * Validate a single insulin dose value.
 * Strictly preserves NULL vs 0.00 vs positive float doses.
 */
export function validateDose(
  rawDose: unknown,
  slotName: string = "dosage"
): DoseValidationResult {
  // 1. Explicit NULL / undefined / empty string -> Preserved as NULL (unrecorded)
  if (rawDose === null || rawDose === undefined) {
    return { isValid: true, value: null };
  }

  if (typeof rawDose === "string") {
    const trimmed = rawDose.trim();
    if (trimmed === "") {
      return { isValid: true, value: null };
    }
    const parsed = Number(trimmed);
    if (isNaN(parsed)) {
      return {
        isValid: false,
        error: `Invalid numeric value for ${slotName}: "${rawDose}".`,
      };
    }
    rawDose = parsed;
  }

  if (typeof rawDose !== "number" || !Number.isFinite(rawDose)) {
    return {
      isValid: false,
      error: `Invalid number for ${slotName}.`,
    };
  }

  // 2. Reject negative doses
  if (rawDose < MIN_SAFE_INSULIN_DOSE) {
    return {
      isValid: false,
      error: `Insulin dose for ${slotName} cannot be negative (got ${rawDose}).`,
    };
  }

  // 3. Reject doses exceeding safe clinical threshold (200.00 units)
  if (rawDose > MAX_SAFE_INSULIN_DOSE) {
    return {
      isValid: false,
      error: `Insulin dose for ${slotName} cannot exceed safe limit of ${MAX_SAFE_INSULIN_DOSE} units (got ${rawDose}).`,
    };
  }

  // 4. Enforce NUMERIC(5,2) precision (up to 2 decimal places, e.g. 0.25, 0.50, 4.75)
  // Avoid floating-point epsilon truncation
  const rounded = Math.round((rawDose + Number.EPSILON) * 100) / 100;

  // Explicit 0.00 is preserved as 0
  return { isValid: true, value: rounded };
}

/**
 * Validate ISO date string (YYYY-MM-DD format only, prevents timezone shifting)
 */
export function validateDate(dateStr: string): { isValid: boolean; error?: string; cleanDate?: string } {
  if (!dateStr || typeof dateStr !== "string") {
    return { isValid: false, error: "Missing or invalid entry date." };
  }

  const clean = dateStr.split("T")[0].trim();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(clean)) {
    return {
      isValid: false,
      error: `Date must be formatted as YYYY-MM-DD (got "${dateStr}").`,
    };
  }

  const [year, month, day] = clean.split("-").map(Number);
  const dateObj = new Date(year, month - 1, day);

  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { isValid: false, error: `Invalid calendar date: "${clean}".` };
  }

  return { isValid: true, cleanDate: clean };
}

/**
 * Validate notes text
 */
export function validateNotes(notes?: string | null): { isValid: boolean; error?: string; cleanNotes: string | null } {
  if (notes === undefined || notes === null) {
    return { isValid: true, cleanNotes: null };
  }

  if (typeof notes !== "string") {
    return { isValid: false, error: "Notes must be a string.", cleanNotes: null };
  }

  const trimmed = notes.trim();
  if (trimmed.length > MAX_NOTES_LENGTH) {
    return {
      isValid: false,
      error: `Notes cannot exceed ${MAX_NOTES_LENGTH} characters (currently ${trimmed.length}).`,
      cleanNotes: null,
    };
  }

  return { isValid: true, cleanNotes: trimmed.length > 0 ? trimmed : null };
}

/**
 * Validate entire create payload before database insertion
 */
export function validateCreatePayload(input: CreateInsulinInput): {
  isValid: boolean;
  cleanPayload?: CreateInsulinInput;
  error?: string;
} {
  const dateCheck = validateDate(input.entry_date);
  if (!dateCheck.isValid || !dateCheck.cleanDate) {
    return { isValid: false, error: dateCheck.error };
  }

  const morningCheck = validateDose(input.morning, "morning (breakfast)");
  if (!morningCheck.isValid) return { isValid: false, error: morningCheck.error };

  const lunchCheck = validateDose(input.lunch, "lunch");
  if (!lunchCheck.isValid) return { isValid: false, error: lunchCheck.error };

  const afternoonCheck = validateDose(input.afternoon, "afternoon (extra dose)");
  if (!afternoonCheck.isValid) return { isValid: false, error: afternoonCheck.error };

  const eveningCheck = validateDose(input.evening, "evening (dinner)");
  if (!eveningCheck.isValid) return { isValid: false, error: eveningCheck.error };

  const nightCheck = validateDose(input.night, "night (bedtime)");
  if (!nightCheck.isValid) return { isValid: false, error: nightCheck.error };

  const notesCheck = validateNotes(input.notes);
  if (!notesCheck.isValid) return { isValid: false, error: notesCheck.error };

  return {
    isValid: true,
    cleanPayload: {
      entry_date: dateCheck.cleanDate,
      morning: morningCheck.value ?? null,
      lunch: lunchCheck.value ?? null,
      afternoon: afternoonCheck.value ?? null,
      evening: eveningCheck.value ?? null,
      night: nightCheck.value ?? null,
      notes: notesCheck.cleanNotes,
      ...(input.id ? { id: input.id } : {}),
    },
  };
}

/**
 * Validate update payload
 */
export function validateUpdatePayload(input: UpdateInsulinInput): {
  isValid: boolean;
  cleanPayload?: UpdateInsulinInput;
  error?: string;
} {
  const clean: UpdateInsulinInput = {};

  if (input.entry_date !== undefined) {
    const dateCheck = validateDate(input.entry_date);
    if (!dateCheck.isValid || !dateCheck.cleanDate) {
      return { isValid: false, error: dateCheck.error };
    }
    clean.entry_date = dateCheck.cleanDate;
  }

  if (input.morning !== undefined) {
    const check = validateDose(input.morning, "morning");
    if (!check.isValid) return { isValid: false, error: check.error };
    clean.morning = check.value ?? null;
  }

  if (input.lunch !== undefined) {
    const check = validateDose(input.lunch, "lunch");
    if (!check.isValid) return { isValid: false, error: check.error };
    clean.lunch = check.value ?? null;
  }

  if (input.afternoon !== undefined) {
    const check = validateDose(input.afternoon, "afternoon");
    if (!check.isValid) return { isValid: false, error: check.error };
    clean.afternoon = check.value ?? null;
  }

  if (input.evening !== undefined) {
    const check = validateDose(input.evening, "evening");
    if (!check.isValid) return { isValid: false, error: check.error };
    clean.evening = check.value ?? null;
  }

  if (input.night !== undefined) {
    const check = validateDose(input.night, "night");
    if (!check.isValid) return { isValid: false, error: check.error };
    clean.night = check.value ?? null;
  }

  if (input.notes !== undefined) {
    const notesCheck = validateNotes(input.notes);
    if (!notesCheck.isValid) return { isValid: false, error: notesCheck.error };
    clean.notes = notesCheck.cleanNotes;
  }

  if (input.id) {
    clean.id = input.id;
  }

  return { isValid: true, cleanPayload: clean };
}

export type DailyStatus = "EMPTY" | "PARTIAL" | "COMPLETE";

/**
 * Evaluate collection status of a day's doses (EMPTY, PARTIAL, COMPLETE)
 */
export function evaluateDailyStatus(
  doses: {
    morning?: number | null;
    lunch?: number | null;
    afternoon?: number | null;
    evening?: number | null;
    night?: number | null;
  },
  showAfternoon: boolean = false
): DailyStatus {
  const slots: (number | null | undefined)[] = [
    doses.morning,
    doses.lunch,
    doses.evening,
    doses.night,
  ];
  if (showAfternoon) {
    slots.push(doses.afternoon);
  }

  const recordedCount = slots.filter((v) => v !== null && v !== undefined && Number(v) > 0).length;
  if (recordedCount === 0) return "EMPTY";
  if (recordedCount === slots.length) return "COMPLETE";
  return "PARTIAL";
}

