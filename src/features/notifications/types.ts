export type NotificationCategory =
  | "glucose"
  | "medication"
  | "meals"
  | "hydration"
  | "summary_daily"
  | "summary_weekly";

export type ReadingSlotType = "BB" | "AB" | "BL" | "AL" | "BD" | "AD" | "BT" | "Fasting";

export interface QuietHoursConfig {
  enabled: boolean;
  startTime: string; // "HH:mm" e.g. "22:00"
  endTime: string;   // "HH:mm" e.g. "07:00"
}

export interface SnoozeConfig {
  defaultDurationMinutes: number; // e.g. 15
}

export interface GlucoseSlotConfig {
  id: string; // e.g. "morning", "before_lunch", "bedtime"
  label: string;
  time: string; // "HH:mm"
  enabled: boolean;
  weekdays: number[]; // 1 = Sun, 2 = Mon, 3 = Tue, 4 = Wed, 5 = Thu, 6 = Fri, 7 = Sat
  readingType: ReadingSlotType;
}

export interface BloodGlucoseReminderConfig {
  enabled: boolean;
  slots: GlucoseSlotConfig[];
}

export interface MedicationSlotConfig {
  id: string; // "breakfast", "lunch", "afternoon", "dinner", "bedtime"
  label: string;
  time: string; // "HH:mm"
  enabled: boolean;
  weekdays: number[];
  doseUnits?: number;
}

export interface MedicationReminderConfig {
  enabled: boolean;
  slots: MedicationSlotConfig[];
}

export interface MealSlotConfig {
  id: string; // "breakfast", "lunch", "dinner", "snack"
  label: string;
  time: string; // "HH:mm"
  enabled: boolean;
  weekdays: number[];
}

export interface MealReminderConfig {
  enabled: boolean;
  slots: MealSlotConfig[];
}

export interface HydrationReminderConfig {
  enabled: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "20:00"
  intervalMinutes: number; // 60, 90, 120, 180
  weekdays: number[];
  dailyLimit: number; // max alerts per day, e.g. 6
}

export interface SummaryReminderConfig {
  dailyEnabled: boolean;
  dailyTime: string; // "21:00"
  weeklyEnabled: boolean;
  weeklyDay: number; // 1 = Sunday, 2 = Monday, etc.
  weeklyTime: string; // "18:00"
}

export interface PatientNotificationSettings {
  userId: string;
  glucose: BloodGlucoseReminderConfig;
  medication: MedicationReminderConfig;
  meals: MealReminderConfig;
  hydration: HydrationReminderConfig;
  summaries: SummaryReminderConfig;
  quietHours: QuietHoursConfig;
  snooze: SnoozeConfig;
  updatedAt: string;
}

export interface NotificationHealthStatus {
  permissionGranted: boolean;
  exactAlarmGranted: boolean;
  channelsConfigured: boolean;
  pendingNotificationsCount: number;
  batteryOptimizationIgnored?: boolean;
  activeCategoriesCount: number;
  lastSyncTime?: string;
  nextScheduled?: {
    category: NotificationCategory;
    title: string;
    scheduledAt: Date;
  } | null;
  errors: string[];
}

export interface ActionPayload {
  actionId: string; // "LOG_READING" | "TAKEN" | "REMIND_LATER" | "DISMISS"
  notificationId: number;
  category: NotificationCategory;
  slotId?: string;
  readingType?: ReadingSlotType;
  timestamp: string;
  extra?: Record<string, any>;
}
