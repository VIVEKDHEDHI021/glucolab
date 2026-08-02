import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { GlucoseEntry, InsulinEntry } from "@/frontend/lib/types";

interface WidgetPluginInterface {
  updateWidgetData(data: {
    glucose: string;
    unit: string;
    lastInsulin: string;
    todayCount: number;
    sparkline: number[];
  }): Promise<void>;
  saveQuickInsulinPresets(data: {
    preset1: number;
    preset2: number;
    preset3: number;
    preset4: number;
    safetyLimit: number;
  }): Promise<void>;
  getPendingQuickInsulin(): Promise<{ pending: Array<{ id: string; units: number; entry_date: string; timestamp: number }> }>;
  clearPendingQuickInsulin(): Promise<void>;
}

const WidgetPlugin = registerPlugin<WidgetPluginInterface>("WidgetPlugin");

export interface QuickInsulinPresets {
  preset1: number;
  preset2: number;
  preset3: number;
  preset4: number;
  safetyLimit: number;
}

const DEFAULT_PRESETS: QuickInsulinPresets = {
  preset1: 4,
  preset2: 6,
  preset3: 8,
  preset4: 10,
  safetyLimit: 20,
};

export const widgetService = {
  async getPresets(): Promise<QuickInsulinPresets> {
    try {
      const { value } = await Preferences.get({ key: "quick_insulin_presets" });
      if (value) {
        return JSON.parse(value);
      }
    } catch (e) {
      console.warn("[widgetService] Failed to load preset preferences:", e);
    }
    return DEFAULT_PRESETS;
  },

  async savePresets(presets: QuickInsulinPresets): Promise<void> {
    try {
      await Preferences.set({
        key: "quick_insulin_presets",
        value: JSON.stringify(presets),
      });

      if (Capacitor.isNativePlatform()) {
        await WidgetPlugin.saveQuickInsulinPresets(presets);
      }
    } catch (e) {
      console.error("[widgetService] Error saving presets:", e);
    }
  },

  async updateWidgets(
    glucoseEntries: GlucoseEntry[],
    insulinEntries: InsulinEntry[],
    unit: string = "mg/dL"
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // 1. Latest Glucose
      const latestGlucose = glucoseEntries.length > 0 ? glucoseEntries[0] : null;
      const glucoseValStr = latestGlucose ? String(Math.round(latestGlucose.glucose)) : "--";

      // 2. Last Insulin Dose
      let lastInsulinStr = "-- Units";
      if (insulinEntries.length > 0) {
        const lastI = insulinEntries[0];
        const total = (lastI.morning || 0) + (lastI.lunch || 0) + (lastI.afternoon || 0) + (lastI.evening || 0) + (lastI.night || 0);
        lastInsulinStr = `${total} U`;
      }

      // 3. Count of readings logged today
      const todayStr = new Date().toISOString().split("T")[0];
      const todayCount = glucoseEntries.filter((g) => {
        if (!g.date_time) return false;
        return g.date_time.startsWith(todayStr);
      }).length;

      // 4. Sparkline trend values (latest 7-10 readings, reversed for chronological display)
      const sparklineData = glucoseEntries
        .slice(0, 8)
        .map((g) => g.glucose)
        .reverse();

      await WidgetPlugin.updateWidgetData({
        glucose: glucoseValStr,
        unit: unit,
        lastInsulin: lastInsulinStr,
        todayCount: todayCount,
        sparkline: sparklineData.length > 0 ? sparklineData : [110, 135, 125, 142],
      });
    } catch (e) {
      console.error("[widgetService] Error updating native widgets:", e);
    }
  },

  async checkAndSyncPendingQuickInsulin(
    onSaveInsulin: (units: number, entryDate: string) => Promise<void>
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const res = await WidgetPlugin.getPendingQuickInsulin();
      if (res && res.pending && res.pending.length > 0) {
        console.log(`[widgetService] Syncing ${res.pending.length} quick insulin logs from widget...`);
        for (const item of res.pending) {
          await onSaveInsulin(item.units, item.entry_date);
        }
        await WidgetPlugin.clearPendingQuickInsulin();
      }
    } catch (e) {
      console.error("[widgetService] Error checking pending quick insulin:", e);
    }
  },
};
