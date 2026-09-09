import { supabase } from "@/db/client";
import type { Database } from "@/db/types";

export type PatientReminderSettingsRow = Database["public"]["Tables"]["patient_reminder_settings"]["Row"];
export type PatientReminderSettingsInsert = Database["public"]["Tables"]["patient_reminder_settings"]["Insert"];

export const patientReminderService = {
  /**
   * Fetch current patient reminder settings from Supabase (with offline SQLite cache fallback)
   */
  async getSettings(userId: string): Promise<PatientReminderSettingsRow> {
    const userTimezone =
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        : "UTC";

    const defaultSettings: PatientReminderSettingsRow = {
      id: "local_default",
      user_id: userId,
      insulin_reminder_enabled: false,
      insulin_reminder_time: "20:00",
      glucose_reminder_enabled: false,
      glucose_reminder_days: 2,
      last_insulin_reminder_at: null,
      last_glucose_reminder_at: null,
      user_timezone: userTimezone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!userId) return defaultSettings;

    try {
      const { data, error } = await supabase
        .from("patient_reminder_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("[PatientReminderService] Error fetching reminder settings:", error);
        return defaultSettings;
      }

      if (!data) {
        return defaultSettings;
      }

      return data as PatientReminderSettingsRow;
    } catch (err) {
      console.error("[PatientReminderService] Unexpected error getting reminder settings:", err);
      return defaultSettings;
    }
  },

  /**
   * Save or update patient reminder settings
   */
  async saveSettings(
    userId: string,
    updates: Partial<PatientReminderSettingsInsert>,
  ): Promise<{ success: boolean; data?: PatientReminderSettingsRow; error?: any }> {
    if (!userId) return { success: false, error: "Missing userId" };

    try {
      const userTimezone =
        updates.user_timezone ||
        (typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
          : "UTC");

      const payload = {
        user_id: userId,
        user_timezone: userTimezone,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const res = await supabase
        .from("patient_reminder_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (res?.error) {
        console.error("[PatientReminderService] Failed to save reminder settings:", res.error);
        return { success: false, error: res.error };
      }

      console.log("[PatientReminderService] Reminder settings saved successfully.");
      return { success: true, data: (res?.data || payload) as PatientReminderSettingsRow };
    } catch (err) {
      console.error("[PatientReminderService] Unexpected error saving reminder settings:", err);
      return { success: false, error: err };
    }
  },
};
