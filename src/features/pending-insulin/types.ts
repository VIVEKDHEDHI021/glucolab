export type ClinicalSlotId = "breakfast" | "lunch" | "dinner" | "bedtime" | "afternoon" | "morning" | "evening" | "night";

export type DbInsulinColumn = "morning" | "lunch" | "afternoon" | "evening" | "night";

export type SlotDoseStatus = "pending" | "upcoming" | "completed";

export interface InsulinScheduleConfig {
  id: ClinicalSlotId;
  label: string; // e.g. "Breakfast", "Lunch", "Dinner", "Bedtime"
  time: string; // "HH:mm" e.g. "08:00"
  enabled: boolean;
  notes?: string | null;
}

export interface PendingDoseSlot {
  id: string; // e.g. "2026-09-17_breakfast"
  date: string; // "YYYY-MM-DD" e.g. "2026-09-17"
  displayDate: string; // "Today", "Yesterday", or "Wednesday, Sep 16"
  slotId: ClinicalSlotId;
  dbColumn: DbInsulinColumn;
  slotName: string; // "Breakfast", "Lunch", "Dinner", "Bedtime"
  time: string; // "08:00"
  displayTime: string; // "08:00 AM"
  scheduledDateTime: Date;
  status: SlotDoseStatus;
  recordedUnits?: number | null;
}

export interface ScheduledSlotSummary extends PendingDoseSlot {}

export interface SaveDosePayload {
  userId: string;
  slot: PendingDoseSlot;
  units: number;
  notes?: string;
}

export interface DoseValidationResult {
  isValid: boolean;
  error?: string;
}
