import {
  type GlucoseEntry,
  type InsulinEntry,
  type FoodEntry,
  type ReadingType,
  READING_TYPES,
  READING_LABELS,
} from "./types";
import { format, differenceInMinutes, parseISO } from "date-fns";

export interface PeriodStats {
  period: ReadingType;
  label: string;
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
  coefficientOfVariation: number; // CV %
  inRangeCount: number;
  inRangePercent: number;
  highCount: number;
  lowCount: number;
}

export interface PairedMealDelta {
  meal: "Breakfast" | "Lunch" | "Dinner";
  prePeriod: ReadingType;
  postPeriod: ReadingType;
  pairCount: number;
  averageDelta: number; // post - pre
  medianDelta: number;
}

export interface FoodGlucoseCorrelation {
  category: string;
  observationCount: number;
  averagePostGlucose: number;
  medianPostGlucose: number;
  elevatedCount: number; // >180 mg/dL
  elevatedRate: number; // percentage
  averageRise?: number; // rise compared to pre-meal if paired pre-meal exists
  timeRangeDescription: string;
}

export interface PatientInsight {
  id: string;
  type: "pattern_high" | "pattern_low" | "food_association" | "insulin_trajectory" | "insufficient_data" | "info";
  severity: "info" | "warning" | "alert";
  title: string;
  message: string;
  supportingObservations: number;
  timeframe?: string;
  safetyNote?: string;
}

// Target ranges defined clinically
export const TARGET_RANGES = {
  FASTING_OR_PREMEAL: { min: 70, max: 130 },
  POSTMEAL_OR_BEDTIME: { min: 70, max: 180 },
  CRITICAL_LOW: 70,
  CRITICAL_HIGH: 250,
};

/**
 * Calculates standard deviation of a dataset
 */
export function calculateStandardDeviation(values: number[], mean: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * Calculates median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

/**
 * Calculate detailed statistics for each clinical reading period
 */
export function calculatePeriodStats(readings: GlucoseEntry[]): PeriodStats[] {
  return READING_TYPES.map((period) => {
    const periodReadings = readings
      .filter((r) => r.reading_type === period)
      .map((r) => Number(r.glucose))
      .filter((v) => !isNaN(v) && v > 0);

    const count = periodReadings.length;
    if (count === 0) {
      return {
        period,
        label: READING_LABELS[period],
        count: 0,
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0,
        inRangeCount: 0,
        inRangePercent: 0,
        highCount: 0,
        lowCount: 0,
      };
    }

    const mean = Math.round((periodReadings.reduce((sum, v) => sum + v, 0) / count) * 10) / 10;
    const median = calculateMedian(periodReadings);
    const min = Math.min(...periodReadings);
    const max = Math.max(...periodReadings);
    const sd = calculateStandardDeviation(periodReadings, mean);
    const cv = mean > 0 ? Math.round(((sd / mean) * 100) * 10) / 10 : 0;

    const isFasting = period === "BB" || period === "BL" || period === "BD" || period === "Fasting";
    const targetMax = isFasting ? TARGET_RANGES.FASTING_OR_PREMEAL.max : TARGET_RANGES.POSTMEAL_OR_BEDTIME.max;
    const targetMin = TARGET_RANGES.FASTING_OR_PREMEAL.min;

    let inRangeCount = 0;
    let highCount = 0;
    let lowCount = 0;

    for (const val of periodReadings) {
      if (val < targetMin) {
        lowCount++;
      } else if (val > targetMax) {
        highCount++;
      } else {
        inRangeCount++;
      }
    }

    const inRangePercent = Math.round((inRangeCount / count) * 100);

    return {
      period,
      label: READING_LABELS[period],
      count,
      mean,
      median,
      min,
      max,
      standardDeviation: sd,
      coefficientOfVariation: cv,
      inRangeCount,
      inRangePercent,
      highCount,
      lowCount,
    };
  });
}

/**
 * Calculates before vs after meal differences for paired readings on identical calendar dates
 */
export function calculatePairedMealDeltas(readings: GlucoseEntry[]): PairedMealDelta[] {
  const mealPairs: Array<{
    meal: "Breakfast" | "Lunch" | "Dinner";
    pre: ReadingType;
    post: ReadingType;
  }> = [
    { meal: "Breakfast", pre: "BB", post: "AB" },
    { meal: "Lunch", pre: "BL", post: "AL" },
    { meal: "Dinner", pre: "BD", post: "AD" },
  ];

  return mealPairs.map(({ meal, pre, post }) => {
    // Group readings by date (yyyy-MM-dd)
    const readingsByDate = new Map<string, { pre?: number; post?: number }>();

    for (const r of readings) {
      const dateStr = r.date_time.slice(0, 10);
      const entry = readingsByDate.get(dateStr) || {};
      if (r.reading_type === pre && entry.pre === undefined) {
        entry.pre = Number(r.glucose);
      } else if (r.reading_type === post && entry.post === undefined) {
        entry.post = Number(r.glucose);
      }
      readingsByDate.set(dateStr, entry);
    }

    const deltas: number[] = [];
    for (const pair of readingsByDate.values()) {
      if (pair.pre !== undefined && pair.post !== undefined) {
        deltas.push(pair.post - pair.pre);
      }
    }

    const pairCount = deltas.length;
    const averageDelta =
      pairCount > 0 ? Math.round((deltas.reduce((sum, d) => sum + d, 0) / pairCount) * 10) / 10 : 0;
    const medianDelta = pairCount > 0 ? calculateMedian(deltas) : 0;

    return {
      meal,
      prePeriod: pre,
      postPeriod: post,
      pairCount,
      averageDelta,
      medianDelta,
    };
  });
}

/**
 * Analyzes correlation between logged food categories and subsequent glucose readings
 * Looks for glucose readings recorded within a 60-240 min window after food, or matching meal period.
 */
export function analyzeFoodGlucoseCorrelations(
  foodLogs: FoodEntry[],
  glucoseReadings: GlucoseEntry[]
): FoodGlucoseCorrelation[] {
  if (foodLogs.length === 0 || glucoseReadings.length === 0) {
    return [];
  }

  // Map category to matching glucose observations
  const categoryObservations = new Map<string, number[]>();

  for (const food of foodLogs) {
    if (food.is_uncertain || !food.food_categories || food.food_categories.length === 0) {
      continue;
    }

    const foodTime = parseISO(food.date_time);

    // Find glucose readings recorded within 45 to 240 minutes following this food event
    // OR if explicitly linked via glucose_entry_id
    const subsequentReadings = glucoseReadings.filter((g) => {
      if (food.glucose_entry_id && g.id === food.glucose_entry_id) {
        return true;
      }
      const gTime = parseISO(g.date_time);
      const diffMin = differenceInMinutes(gTime, foodTime);
      return diffMin >= 30 && diffMin <= 240;
    });

    for (const cat of food.food_categories) {
      if (!cat || cat === "No unusual food" || cat === "Not sure") continue;
      const existing = categoryObservations.get(cat) || [];
      for (const r of subsequentReadings) {
        existing.push(Number(r.glucose));
      }
      categoryObservations.set(cat, existing);
    }
  }

  const results: FoodGlucoseCorrelation[] = [];

  for (const [category, values] of categoryObservations.entries()) {
    if (values.length === 0) continue;

    const count = values.length;
    const mean = Math.round((values.reduce((s, v) => s + v, 0) / count) * 10) / 10;
    const median = calculateMedian(values);
    const elevated = values.filter((v) => v > 180).length;
    const elevatedRate = Math.round((elevated / count) * 100);

    results.push({
      category,
      observationCount: count,
      averagePostGlucose: mean,
      medianPostGlucose: median,
      elevatedCount: elevated,
      elevatedRate,
      timeRangeDescription: "Recorded readings within 1–4 hours of meal",
    });
  }

  return results.sort((a, b) => b.observationCount - a.observationCount);
}

/**
 * Generates patient-friendly, evidence-based, neutral clinical insights and safety alerts.
 * Strictly adheres to safety constraints: NO prescriptive dosing, neutral observational phrasing.
 */
export function generatePatientInsights(params: {
  periodStats: PeriodStats[];
  pairedDeltas: PairedMealDelta[];
  foodCorrelations: FoodGlucoseCorrelation[];
  insulinEntries: InsulinEntry[];
  glucoseReadings: GlucoseEntry[];
}): PatientInsight[] {
  const { periodStats, pairedDeltas, foodCorrelations, insulinEntries, glucoseReadings } = params;
  const insights: PatientInsight[] = [];

  // Check for sufficient data
  const totalReadings = glucoseReadings.length;
  if (totalReadings < 3) {
    insights.push({
      id: "insufficient_data",
      type: "insufficient_data",
      severity: "info",
      title: "Data collection in progress",
      message: "There are not enough comparable readings to establish a consistent pattern. Continue logging your glucose, food, and insulin.",
      supportingObservations: totalReadings,
    });
    return insights;
  }

  // 1. Period-based elevated patterns (e.g., frequently elevated after lunch)
  for (const p of periodStats) {
    if (p.count >= 3 && p.highCount / p.count >= 0.5) {
      insights.push({
        id: `elevated_${p.period}`,
        type: "pattern_high",
        severity: "warning",
        title: `Elevated readings around ${p.label}`,
        message: `Your glucose has frequently been elevated ${p.label.toLowerCase()} in your recent records (${p.highCount} of ${p.count} readings were above target).`,
        supportingObservations: p.count,
        timeframe: "Recent records",
      });
    }

    if (p.count >= 2 && p.lowCount > 0) {
      insights.push({
        id: `low_${p.period}`,
        type: "pattern_low",
        severity: "alert",
        title: `Low readings observed: ${p.label}`,
        message: `Readings below 70 mg/dL were recorded around ${p.label.toLowerCase()} (${p.lowCount} event${p.lowCount > 1 ? "s" : ""}). Review potential causes with your doctor.`,
        supportingObservations: p.lowCount,
        safetyNote: "Always carry fast-acting carbohydrates to treat hypoglycemia.",
      });
    }
  }

  // 2. Pre-to-post meal delta insights
  for (const delta of pairedDeltas) {
    if (delta.pairCount >= 3 && delta.averageDelta > 50) {
      insights.push({
        id: `delta_${delta.meal.toLowerCase()}`,
        type: "pattern_high",
        severity: "warning",
        title: `Significant glucose rise after ${delta.meal}`,
        message: `Across ${delta.pairCount} comparable days, glucose rose by an average of ${Math.round(delta.averageDelta)} mg/dL from before ${delta.meal.toLowerCase()} to after ${delta.meal.toLowerCase()}.`,
        supportingObservations: delta.pairCount,
      });
    }
  }

  // 3. Food category associations
  for (const food of foodCorrelations) {
    if (food.observationCount >= 2) {
      if (food.elevatedRate >= 50) {
        insights.push({
          id: `food_${food.category.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          type: "food_association",
          severity: "warning",
          title: `Post-meal pattern: ${food.category}`,
          message: `Elevated readings have frequently occurred after meals where ${food.category.toLowerCase()} was recorded (average ${food.averagePostGlucose} mg/dL across ${food.observationCount} observations).`,
          supportingObservations: food.observationCount,
          timeframe: food.timeRangeDescription,
          safetyNote: "This observation reflects historical correlations, not clinical proof of causation.",
        });
      } else {
        insights.push({
          id: `food_${food.category.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          type: "food_association",
          severity: "info",
          title: `Observations for ${food.category}`,
          message: `Recorded ${food.observationCount} times with an average subsequent glucose reading of ${food.averagePostGlucose} mg/dL (${100 - food.elevatedRate}% in target).`,
          supportingObservations: food.observationCount,
        });
      }
    }
  }

  // 4. Trajectory following recorded insulin administration
  if (insulinEntries.length > 0) {
    // Check if any low glucose reading occurred on days with recorded insulin
    const daysWithInsulin = new Set(insulinEntries.map((i) => i.entry_date.slice(0, 10)));
    const lowsOnInsulinDays = glucoseReadings.filter((g) => {
      const d = g.date_time.slice(0, 10);
      return daysWithInsulin.has(d) && Number(g.glucose) < 70;
    });

    if (lowsOnInsulinDays.length >= 2) {
      insights.push({
        id: "insulin_drops",
        type: "insulin_trajectory",
        severity: "alert",
        title: "Glucose drops on recorded insulin days",
        message: "Your glucose has sometimes dropped below 70 mg/dL after recorded insulin doses. Review this pattern with your healthcare professional.",
        supportingObservations: lowsOnInsulinDays.length,
        safetyNote: "Do not alter your prescribed insulin regimen without clinician supervision.",
      });
    }
  }

  return insights;
}
