import { supabase } from "@/db/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

export interface DailySummaryData {
  hasData: boolean;
  readingCount: number;
  averageGlucose: number | null;
  dosesLoggedCount: number;
  message: string;
}

export interface WeeklySummaryData {
  hasData: boolean;
  readingCount: number;
  averageGlucose: number | null;
  daysWithReadings: number;
  message: string;
}

export const summaryAggregator = {
  /**
   * Aggregate today's tracking data for daily health summary
   */
  async getDailySummary(userId: string): Promise<DailySummaryData> {
    if (!userId) {
      return {
        hasData: false,
        readingCount: 0,
        averageGlucose: null,
        dosesLoggedCount: 0,
        message: "No tracking data available for today.",
      };
    }

    try {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const todayDateStr = format(today, "yyyy-MM-dd");

      // 1. Fetch today's glucose readings
      const { data: glucoseRows } = await supabase
        .from("glucose_entries")
        .select("glucose")
        .eq("user_id", userId)
        .gte("date_time", todayStart)
        .lte("date_time", todayEnd);

      const readingCount = glucoseRows?.length ?? 0;
      let averageGlucose: number | null = null;

      if (glucoseRows && glucoseRows.length > 0) {
        const sum = glucoseRows.reduce((acc, row) => acc + (Number(row.glucose) || 0), 0);
        averageGlucose = Math.round(sum / glucoseRows.length);
      }

      // 2. Fetch today's insulin doses
      const { data: insulinRow } = await supabase
        .from("insulin_entries")
        .select("morning, lunch, afternoon, evening, night")
        .eq("user_id", userId)
        .eq("entry_date", todayDateStr)
        .maybeSingle();

      let dosesLoggedCount = 0;
      if (insulinRow) {
        if (Number(insulinRow.morning) > 0) dosesLoggedCount++;
        if (Number(insulinRow.lunch) > 0) dosesLoggedCount++;
        if (Number(insulinRow.afternoon) > 0) dosesLoggedCount++;
        if (Number(insulinRow.evening) > 0) dosesLoggedCount++;
        if (Number(insulinRow.night) > 0) dosesLoggedCount++;
      }

      if (readingCount === 0 && dosesLoggedCount === 0) {
        return {
          hasData: false,
          readingCount: 0,
          averageGlucose: null,
          dosesLoggedCount: 0,
          message: "Gentle reminder: No entries were logged today. Logging daily helps maintain steady glucose tracking.",
        };
      }

      let message = `Daily Summary: ${readingCount} glucose reading${readingCount === 1 ? "" : "s"} logged today`;
      if (averageGlucose) {
        message += ` (Avg: ${averageGlucose} mg/dL)`;
      }
      if (dosesLoggedCount > 0) {
        message += `, with ${dosesLoggedCount} insulin dose${dosesLoggedCount === 1 ? "" : "s"} recorded.`;
      } else {
        message += `.`;
      }

      return {
        hasData: true,
        readingCount,
        averageGlucose,
        dosesLoggedCount,
        message,
      };
    } catch (err) {
      console.warn("[SummaryAggregator] Error calculating daily summary:", err);
      return {
        hasData: false,
        readingCount: 0,
        averageGlucose: null,
        dosesLoggedCount: 0,
        message: "Your daily health tracking summary is ready for review.",
      };
    }
  },

  /**
   * Aggregate past 7 days tracking data for weekly health summary
   */
  async getWeeklySummary(userId: string): Promise<WeeklySummaryData> {
    if (!userId) {
      return {
        hasData: false,
        readingCount: 0,
        averageGlucose: null,
        daysWithReadings: 0,
        message: "No tracking data available for the past week.",
      };
    }

    try {
      const sinceDate = subDays(new Date(), 7).toISOString();

      const { data: glucoseRows } = await supabase
        .from("glucose_entries")
        .select("glucose, date_time")
        .eq("user_id", userId)
        .gte("date_time", sinceDate);

      const readingCount = glucoseRows?.length ?? 0;
      let averageGlucose: number | null = null;
      const daySet = new Set<string>();

      if (glucoseRows && glucoseRows.length > 0) {
        let sum = 0;
        for (const row of glucoseRows) {
          sum += Number(row.glucose) || 0;
          daySet.add(row.date_time.substring(0, 10));
        }
        averageGlucose = Math.round(sum / glucoseRows.length);
      }

      const daysWithReadings = daySet.size;

      if (readingCount === 0) {
        return {
          hasData: false,
          readingCount: 0,
          averageGlucose: null,
          daysWithReadings: 0,
          message: "Weekly summary: No readings logged in the past 7 days. Start logging tomorrow to see weekly insights!",
        };
      }

      const message = `Weekly Review: ${readingCount} readings across ${daysWithReadings} of 7 days (7-day Avg: ${averageGlucose} mg/dL). Tap to view full trends.`;

      return {
        hasData: true,
        readingCount,
        averageGlucose,
        daysWithReadings,
        message,
      };
    } catch (err) {
      console.warn("[SummaryAggregator] Error calculating weekly summary:", err);
      return {
        hasData: false,
        readingCount: 0,
        averageGlucose: null,
        daysWithReadings: 0,
        message: "Your weekly health summary and report trends are ready.",
      };
    }
  },
};
