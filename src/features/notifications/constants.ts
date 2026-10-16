import type { PatientNotificationSettings } from "./types";

export const NOTIFICATION_CHANNELS = {
  GLUCOSE: {
    id: "glucolab_glucose",
    name: "Blood Glucose Reminders",
    description: "Scheduled reminders to check and log blood glucose levels",
    importance: 5, // IMPORTANCE_HIGH (heads-up banner)
    sound: "default",
    vibration: true,
  },
  MEDICATION: {
    id: "glucolab_medication",
    name: "Medication & Insulin Reminders",
    description: "Critical dose alerts and administration confirmations",
    importance: 5, // IMPORTANCE_HIGH (heads-up banner)
    sound: "default",
    vibration: true,
  },
  MEALS: {
    id: "glucolab_meals",
    name: "Meal & Nutrition Reminders",
    description: "Configurable mealtime reminders for breakfast, lunch, and dinner",
    importance: 4, // IMPORTANCE_DEFAULT / HIGH
    sound: "default",
    vibration: true,
  },
  HYDRATION: {
    id: "glucolab_hydration",
    name: "Hydration Reminders",
    description: "Periodic hydration alerts during active hours",
    importance: 3, // IMPORTANCE_DEFAULT
    sound: "default",
    vibration: false,
  },
  SUMMARIES: {
    id: "glucolab_summaries",
    name: "Daily & Weekly Summaries",
    description: "Health tracking completeness and glucose trend reports",
    importance: 3,
    sound: "default",
    vibration: false,
  },
  TEST: {
    id: "glucolab_test",
    name: "GlucoLab Diagnostic Alerts",
    description: "Channel for instant test notifications and system checks",
    importance: 5,
    sound: "default",
    vibration: true,
  },
} as const;

export const ACTION_TYPES = {
  GLUCOSE_ACTION: "GLUCOLAB_GLUCOSE_ACTION",
  MEDICATION_ACTION: "GLUCOLAB_MEDICATION_ACTION",
  MEAL_ACTION: "GLUCOLAB_MEAL_ACTION",
  HYDRATION_ACTION: "GLUCOLAB_HYDRATION_ACTION",
  SUMMARY_ACTION: "GLUCOLAB_SUMMARY_ACTION",
} as const;

export const ACTION_IDS = {
  LOG_READING: "LOG_READING",
  TAKEN: "TAKEN",
  REMIND_LATER: "REMIND_LATER",
  DISMISS: "DISMISS",
  OPEN_REPORTS: "OPEN_REPORTS",
} as const;

export function getDefaultNotificationSettings(userId: string): PatientNotificationSettings {
  return {
    userId,
    glucose: {
      enabled: true,
      slots: [
        {
          id: "morning",
          label: "Morning Fasting",
          time: "07:30",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          readingType: "BB",
        },
        {
          id: "after_lunch",
          label: "After Lunch",
          time: "14:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          readingType: "AL",
        },
        {
          id: "before_dinner",
          label: "Before Dinner",
          time: "19:00",
          enabled: false,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          readingType: "BD",
        },
        {
          id: "bedtime",
          label: "Bedtime",
          time: "22:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          readingType: "BT",
        },
      ],
    },
    medication: {
      enabled: true,
      slots: [
        {
          id: "breakfast",
          label: "Breakfast Dose",
          time: "08:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          id: "lunch",
          label: "Lunch Dose",
          time: "13:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          id: "dinner",
          label: "Dinner Dose",
          time: "20:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          id: "bedtime",
          label: "Bedtime Dose",
          time: "22:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    },
    meals: {
      enabled: false,
      slots: [
        {
          id: "breakfast",
          label: "Breakfast",
          time: "08:00",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          id: "lunch",
          label: "Lunch",
          time: "12:30",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          id: "dinner",
          label: "Dinner",
          time: "19:30",
          enabled: true,
          weekdays: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    },
    hydration: {
      enabled: false,
      startTime: "08:00",
      endTime: "20:00",
      intervalMinutes: 120,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      dailyLimit: 6,
    },
    summaries: {
      dailyEnabled: true,
      dailyTime: "21:00",
      weeklyEnabled: true,
      weeklyDay: 1, // Sunday
      weeklyTime: "18:00",
    },
    quietHours: {
      enabled: true,
      startTime: "22:30",
      endTime: "07:00",
    },
    snooze: {
      defaultDurationMinutes: 15,
    },
    updatedAt: new Date().toISOString(),
  };
}

export const SETTINGS_STORAGE_KEY_PREFIX = "glucolab_notification_settings_";
