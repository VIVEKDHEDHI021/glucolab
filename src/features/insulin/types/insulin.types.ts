/**
 * GLUCOLAB INSULIN COLLECTOR — DOMAIN & DATABASE TYPES
 * Authoritative types for public.insulin_entries and UI integration
 */

export type ClinicalSlot = "morning" | "lunch" | "afternoon" | "evening" | "night";

export type SlotLabel = "Breakfast" | "Lunch" | "Afternoon" | "Dinner" | "Bedtime";

export interface SlotDefinition {
  id: ClinicalSlot;
  label: SlotLabel;
  dbColumn: "morning" | "lunch" | "afternoon" | "evening" | "night";
  defaultTime: string;
}

export const CLINICAL_SLOTS: SlotDefinition[] = [
  { id: "morning", label: "Breakfast", dbColumn: "morning", defaultTime: "08:00" },
  { id: "lunch", label: "Lunch", dbColumn: "lunch", defaultTime: "13:00" },
  { id: "afternoon", label: "Afternoon", dbColumn: "afternoon", defaultTime: "16:00" },
  { id: "evening", label: "Dinner", dbColumn: "evening", defaultTime: "20:00" },
  { id: "night", label: "Bedtime", dbColumn: "night", defaultTime: "22:00" },
];

/**
 * Exact representation of PostgreSQL public.insulin_entries record
 */
export interface InsulinEntryRecord {
  id: string; // UUID primary key
  user_id: string; // UUID patient identifier
  entry_date: string; // DATE YYYY-MM-DD
  morning: number | null; // NUMERIC(5,2)
  lunch: number | null; // NUMERIC(5,2)
  afternoon: number | null; // NUMERIC(5,2) [0..200]
  evening: number | null; // NUMERIC(5,2)
  night: number | null; // NUMERIC(5,2)
  notes: string | null; // TEXT
  created_at?: string;
  updated_at?: string;
}

/**
 * Input for creating a new daily insulin record
 */
export interface CreateInsulinInput {
  entry_date: string; // YYYY-MM-DD
  morning?: number | null;
  lunch?: number | null;
  afternoon?: number | null;
  evening?: number | null;
  night?: number | null;
  notes?: string | null;
  id?: string; // Optional client-supplied UUID
}

/**
 * Input for updating an existing daily insulin record
 */
export interface UpdateInsulinInput {
  id?: string;
  entry_date?: string; // YYYY-MM-DD
  morning?: number | null;
  lunch?: number | null;
  afternoon?: number | null;
  evening?: number | null;
  night?: number | null;
  notes?: string | null;
}

/**
 * Query options for historical records
 */
export interface HistoricalInsulinOptions {
  from?: string; // Inclusive start date YYYY-MM-DD
  to?: string; // Inclusive end date YYYY-MM-DD
  limit?: number; // Page size (default: 50, max: 200)
  offset?: number; // Pagination offset
}

/**
 * Paginated historical results
 */
export interface HistoricalInsulinResult {
  entries: InsulinEntryRecord[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Generic service result wrapper
 */
export interface InsulinServiceResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Dose validation result
 */
export interface DoseValidationResult {
  isValid: boolean;
  value?: number | null;
  error?: string;
}

