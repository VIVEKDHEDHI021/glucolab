import type { ClinicalSlotId, DbInsulinColumn, InsulinScheduleConfig } from "../types";

/**
 * 4 Default Configurable Insulin Schedule Slots
 */
export const DEFAULT_CLINICAL_INSULIN_SCHEDULES: InsulinScheduleConfig[] = [
  {
    id: "breakfast",
    label: "Breakfast",
    time: "08:00",
    enabled: true,
  },
  {
    id: "lunch",
    label: "Lunch",
    time: "13:00",
    enabled: true,
  },
  {
    id: "dinner",
    label: "Dinner",
    time: "20:00",
    enabled: true,
  },
  {
    id: "bedtime",
    label: "Bedtime",
    time: "22:00",
    enabled: true,
  },
];

const SCHEDULES_STORAGE_KEY_PREFIX = "glucolab_insulin_schedules_";

/**
 * Map slot identifiers to insulin_entries database columns
 */
export function mapSlotToDbColumn(slotId: ClinicalSlotId): DbInsulinColumn {
  switch (slotId) {
    case "breakfast":
    case "morning":
      return "morning";
    case "lunch":
      return "lunch";
    case "afternoon":
      return "afternoon";
    case "dinner":
    case "evening":
      return "evening";
    case "bedtime":
    case "night":
      return "night";
    default:
      return "morning";
  }
}

/**
 * Normalize raw schedules from storage into clinical schedules
 */
export function normalizeClinicalSchedules(rawSchedules: any[] | null | undefined): InsulinScheduleConfig[] {
  if (!rawSchedules || !Array.isArray(rawSchedules) || rawSchedules.length === 0) {
    return DEFAULT_CLINICAL_INSULIN_SCHEDULES;
  }

  const slotMap: Record<string, InsulinScheduleConfig> = {
    breakfast: { id: "breakfast", label: "Breakfast", time: "08:00", enabled: false },
    lunch: { id: "lunch", label: "Lunch", time: "13:00", enabled: false },
    dinner: { id: "dinner", label: "Dinner", time: "20:00", enabled: false },
    bedtime: { id: "bedtime", label: "Bedtime", time: "22:00", enabled: false },
  };

  for (const item of rawSchedules) {
    if (!item || !item.id) continue;
    let targetKey = item.id;
    let targetLabel = item.label || "";

    if (item.id === "morning") {
      targetKey = "breakfast";
      if (!targetLabel || targetLabel === "Morning") targetLabel = "Breakfast";
    } else if (item.id === "evening") {
      targetKey = "dinner";
      if (!targetLabel || targetLabel === "Evening") targetLabel = "Dinner";
    } else if (item.id === "night") {
      targetKey = "bedtime";
      if (!targetLabel || targetLabel === "Night") targetLabel = "Bedtime";
    }

    if (slotMap[targetKey]) {
      slotMap[targetKey] = {
        ...slotMap[targetKey],
        ...item,
        id: targetKey as ClinicalSlotId,
        label: targetLabel || slotMap[targetKey].label,
      };
    } else if (item.id === "afternoon") {
      slotMap.afternoon = {
        id: "afternoon",
        label: item.label || "Afternoon",
        time: item.time || "14:00",
        enabled: Boolean(item.enabled),
      };
    }
  }

  const result = [slotMap.breakfast, slotMap.lunch];
  if (slotMap.afternoon) {
    result.push(slotMap.afternoon);
  }
  result.push(slotMap.dinner, slotMap.bedtime);
  return result;
}

export const insulinScheduleService = {
  getDefaultSchedules(): InsulinScheduleConfig[] {
    return DEFAULT_CLINICAL_INSULIN_SCHEDULES;
  },

  getSchedules(userId?: string): InsulinScheduleConfig[] {
    if (typeof window === "undefined" || !window.localStorage || !userId) {
      return DEFAULT_CLINICAL_INSULIN_SCHEDULES;
    }
    try {
      const raw = window.localStorage.getItem(`${SCHEDULES_STORAGE_KEY_PREFIX}${userId}`);
      if (!raw) return DEFAULT_CLINICAL_INSULIN_SCHEDULES;
      const parsed = JSON.parse(raw);
      return normalizeClinicalSchedules(parsed);
    } catch {
      return DEFAULT_CLINICAL_INSULIN_SCHEDULES;
    }
  },

  saveSchedules(userId: string, schedules: InsulinScheduleConfig[]): void {
    if (typeof window === "undefined" || !window.localStorage || !userId) return;
    try {
      window.localStorage.setItem(`${SCHEDULES_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(schedules));
    } catch (e) {
      console.warn("[InsulinScheduleService] Failed to save schedules:", e);
    }
  },

  mapSlotToDbColumn,
  normalizeClinicalSchedules,
};
