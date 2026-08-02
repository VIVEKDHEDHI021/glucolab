export type ReminderCategory =
  | "insulin"
  | "medication"
  | "glucose"
  | "meal"
  | "water"
  | "exercise"
  | "sleep"
  | "appointment"
  | "lab_test"
  | "supply"
  | "report"
  | "motivation";

export type ScheduleType = "daily" | "weekly" | "monthly" | "custom_days" | "interval" | "one_time";

export interface ScheduleData {
  times?: string[]; // Array of "HH:MM" strings
  days?: number[]; // [0-6] where 0 is Sunday, 1 is Monday, etc.
  intervalMinutes?: number; // e.g. 60, 120 for water
  intervalStart?: string; // "HH:MM"
  intervalEnd?: string; // "HH:MM"
  date?: string; // "YYYY-MM-DD" for appointment / lab test
}

export interface ReminderData {
  dosage?: string;
  unit?: string;
  medicine_name?: string;
  notes?: string;
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack" | "any";
  meal_timing?: "before" | "after" | "during" | "any";
  exercise_type?: string;
  target_water_ml?: number;
  doctor_name?: string;
  location?: string;
  threshold_quantity?: number;
  current_quantity?: number;
  item_name?: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  category: ReminderCategory;
  title: string;
  description?: string;
  is_enabled: boolean;
  schedule_type: ScheduleType;
  schedule_data: ScheduleData;
  reminder_data: ReminderData;
  sound: string;
  vibrate: boolean;
  sync_status?: "synced" | "pending_sync";
  created_at?: string;
  updated_at?: string;
}

export type HistoryStatus = "triggered" | "completed" | "skipped" | "snoozed" | "missed";
export type HistoryAction = "taken" | "skip" | "snooze" | "scan" | "manual_entry" | "later";

export interface ReminderHistory {
  id: string;
  user_id: string;
  reminder_id?: string;
  category: ReminderCategory;
  title: string;
  description?: string;
  scheduled_time: string;
  status: HistoryStatus;
  action_taken?: HistoryAction;
  action_time?: string;
  notes?: string;
  sync_status?: "synced" | "pending_sync";
  created_at?: string;
  updated_at?: string;
}
