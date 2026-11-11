export const READING_TYPES = ["BB", "AB", "BL", "AL", "BD", "AD", "BT", "Fasting"] as const;
export type ReadingType = (typeof READING_TYPES)[number];

export const READING_LABELS: Record<ReadingType, string> = {
  BB: "Before Breakfast",
  AB: "After Breakfast",
  BL: "Before Lunch",
  AL: "After Lunch",
  BD: "Before Dinner",
  AD: "After Dinner",
  BT: "Bedtime",
  Fasting: "Fasting",
};

export interface GlucoseEntry {
  id: string;
  user_id: string;
  glucose: number;
  reading_type: ReadingType;
  food: string | null;
  notes: string | null;
  symptoms: string | null;
  date_time: string;
  created_at: string;
  updated_at: string;
}

export interface InsulinEntry {
  id: string;
  user_id: string;
  entry_date: string;
  morning: number;
  lunch: number;
  afternoon?: number;
  evening: number;
  night: number;
  notes: string | null;
  revision?: number;
  collection_status?: "EMPTY" | "PARTIAL" | "COMPLETE";
  sync_status?: string;
  timezone?: string;
  last_synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  entry_date: string;
  weight_kg: number;
  notes: string | null;
}

export type PortionCategory = "small" | "regular" | "large" | "unspecified";

export const PORTION_LABELS: Record<PortionCategory, string> = {
  small: "Small portion",
  regular: "Regular portion",
  large: "Large portion",
  unspecified: "Standard / Unspecified",
};

export const MEAL_PERIODS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Morning snack",
  "Evening snack",
  "Other time",
] as const;

export type MealPeriod = (typeof MEAL_PERIODS)[number] | ReadingType | "recent";

export const FOOD_CATEGORIES = [
  "Sweets and mithai",
  "Sugary drinks and sweetened tea",
  "Rice and roti-based meals",
  "Snacks",
  "Fried foods",
  "Restaurant or fast food",
  "Fruits and juices",
  "Festival and celebration foods",
  "Other food",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

// Quick food context categories for the glucose dialog
export const QUICK_FOOD_OPTIONS = [
  { id: "sweets_mithai", label: "Sweets / mithai, including jalebi and ladoo" },
  { id: "sugary_drinks", label: "Sugary drinks or sweetened tea" },
  { id: "large_carb_meal", label: "Large rice or roti meal" },
  { id: "festival_meal", label: "Festival or celebration meal" },
  { id: "fast_food", label: "Outside food or fast food" },
  { id: "no_unusual_food", label: "No unusual food", exclusive: true },
  { id: "not_sure", label: "Not sure", exclusive: true },
] as const;

export type QuickFoodOptionId = (typeof QUICK_FOOD_OPTIONS)[number]["id"];

export interface FoodEntry {
  id: string;
  user_id: string;
  food_categories: string[];
  portion_category: PortionCategory;
  meal_period: MealPeriod;
  date_time: string;
  notes: string | null;
  is_uncertain: boolean;
  glucose_entry_id?: string | null;
  sync_status?: string;
  created_at?: string;
  updated_at?: string;
}

export function glucoseStatus(value: number, type: ReadingType): "low" | "normal" | "high" {
  const isFasting =
    type === "Fasting" || type === "BB" || type === "BL" || type === "BD" || type === "BT";
  if (value < 70) return "low";
  if (isFasting) return value > 130 ? "high" : "normal";
  return value > 180 ? "high" : "normal";
}

