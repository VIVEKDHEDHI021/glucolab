import { Capacitor } from "@capacitor/core";
import { supabase } from "@/db/client";
import { localDbService } from "./localDbService";
import { toast } from "sonner";

const isMobile = Capacitor.isNativePlatform();
let isSyncing = false;

export const syncService = {
  // Setup listener for network reconnection
  async setupNetworkSyncListener() {
    if (!isMobile) return;

    try {
      const { Network } = await import("@capacitor/network");

      // Check current status on load
      const status = await Network.getStatus();
      if (status.connected) {
        this.syncPendingData();
      }

      // Add reconnection listener
      Network.addListener("networkStatusChange", (change) => {
        console.log("[SYNC] Network status change detected:", change);
        if (change.connected) {
          // Silent sync - no toast message shown to user
          this.syncPendingData();
        }
      });
    } catch (err) {
      console.error("[SYNC] Failed to initialize Network connection listener:", err);
    }
  },

  // Read SQLite pending rows and upload them to Supabase
  async syncPendingData() {
    if (!isMobile || isSyncing) return;
    isSyncing = true;

    try {
      console.log("[SYNC] Querying pending records from SQLite...");
      const { glucose, insulin, weight, profile, scans, reminders, history, reminderSettings } = await localDbService.getPendingSyncRows();

      let syncedCount = 0;

      // 1. Sync Glucose Entries
      if (glucose.length > 0) {
        console.log(`[SYNC] Syncing ${glucose.length} glucose entries...`);
        for (const g of glucose) {
          const { error } = await supabase.from("glucose_entries").insert({
            id: g.id,
            user_id: g.user_id,
            glucose: g.glucose,
            reading_type: g.reading_type,
            notes: g.notes,
            date_time: g.date_time,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE glucose_entries SET sync_status = 'synced' WHERE id = ?`,
              [g.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync glucose ID ${g.id}:`, error);
          }
        }
      }

      // 2. Sync Insulin Entries
      if (insulin.length > 0) {
        console.log(`[SYNC] Syncing ${insulin.length} insulin entries...`);
        for (const i of insulin) {
          const { error } = await supabase.from("insulin_entries").insert({
            id: i.id,
            user_id: i.user_id,
            morning: i.morning,
            lunch: i.lunch,
            afternoon: i.afternoon || 0,
            evening: i.evening,
            night: i.night,
            entry_date: i.entry_date,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE insulin_entries SET sync_status = 'synced' WHERE id = ?`,
              [i.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync insulin ID ${i.id}:`, error);
          }
        }
      }

      // 3. Sync Weight Entries
      if (weight.length > 0) {
        console.log(`[SYNC] Syncing ${weight.length} weight entries...`);
        for (const w of weight) {
          const { error } = await supabase.from("weight_entries").insert({
            id: w.id,
            user_id: w.user_id,
            weight_kg: w.weight_kg,
            notes: w.notes,
            entry_date: w.entry_date,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE weight_entries SET sync_status = 'synced' WHERE id = ?`,
              [w.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync weight ID ${w.id}:`, error);
          }
        }
      }

      // 4. Sync Profiles
      if (profile.length > 0) {
        console.log(`[SYNC] Syncing ${profile.length} profiles...`);
        for (const p of profile) {
          const { error } = await supabase.from("profiles").upsert({
            user_id: p.user_id,
            name: p.name,
            phone: p.phone,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE profiles SET sync_status = 'synced' WHERE user_id = ?`,
              [p.user_id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync profile for user ${p.user_id}:`, error);
          }
        }
      }

      // 5. Sync Smart Scans
      if (scans.length > 0) {
        console.log(`[SYNC] Syncing ${scans.length} smart scans...`);
        for (const s of scans) {
          const { error } = await supabase.from("smart_scan_readings").insert({
            id: s.id,
            user_id: s.user_id,
            device_type: s.device_type,
            reading_date: s.reading_date,
            reading_time: s.reading_time,
            confidence: s.confidence,
            ocr_source: s.ocr_source,
            image_url: s.image_url || null,
            notes: s.notes || null,
            sync_status: "synced",
            data: s.data,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE smart_scan_readings SET sync_status = 'synced' WHERE id = ?`,
              [s.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync scan ID ${s.id}:`, error);
          }
        }
      }

      // 6. Sync Reminders
      if (reminders && reminders.length > 0) {
        console.log(`[SYNC] Syncing ${reminders.length} reminders...`);
        for (const r of reminders) {
          const { error } = await supabase.from("reminders").upsert({
            id: r.id,
            user_id: r.user_id,
            category: r.category,
            title: r.title,
            description: r.description,
            is_enabled: r.is_enabled,
            schedule_type: r.schedule_type,
            schedule_data: r.schedule_data,
            reminder_data: r.reminder_data,
            sound: r.sound,
            vibrate: r.vibrate,
            sync_status: "synced",
            created_at: r.created_at,
            updated_at: r.updated_at,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE reminders SET sync_status = 'synced' WHERE id = ?`,
              [r.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync reminder ID ${r.id}:`, error);
          }
        }
      }

      // 7. Sync Reminder History
      if (history && history.length > 0) {
        console.log(`[SYNC] Syncing ${history.length} reminder logs...`);
        for (const h of history) {
          const { error } = await supabase.from("reminder_history").insert({
            id: h.id,
            user_id: h.user_id,
            reminder_id: h.reminder_id,
            category: h.category,
            title: h.title,
            description: h.description,
            scheduled_time: h.scheduled_time,
            status: h.status,
            action_taken: h.action_taken,
            action_time: h.action_time,
            notes: h.notes,
            sync_status: "synced",
            created_at: h.created_at,
            updated_at: h.updated_at,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE reminder_history SET sync_status = 'synced' WHERE id = ?`,
              [h.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync reminder history ID ${h.id}:`, error);
          }
        }
      }

      // 8. Sync Patient Reminder Settings
      if (reminderSettings && reminderSettings.length > 0) {
        console.log(`[SYNC] Syncing ${reminderSettings.length} patient reminder settings...`);
        for (const s of reminderSettings) {
          const { error } = await supabase.from("patient_reminder_settings").upsert({
            id: s.id,
            user_id: s.user_id,
            insulin_reminder_enabled: s.insulin_reminder_enabled,
            insulin_reminder_time: s.insulin_reminder_time,
            glucose_reminder_enabled: s.glucose_reminder_enabled,
            glucose_reminder_days: s.glucose_reminder_days,
            last_insulin_reminder_at: s.last_insulin_reminder_at,
            last_glucose_reminder_at: s.last_glucose_reminder_at,
            user_timezone: s.user_timezone,
            updated_at: s.updated_at,
          });

          if (!error) {
            await localDbService.runQuery(
              `UPDATE patient_reminder_settings SET sync_status = 'synced' WHERE id = ?`,
              [s.id]
            );
            syncedCount++;
          } else {
            console.error(`[SYNC] Failed to sync reminder settings ID ${s.id}:`, error);
          }
        }
      }

      // Silent sync complete - no toast message shown to user
    } catch (err) {
      console.error("[SYNC] Sync execution failed:", err);
    } finally {
      isSyncing = false;
    }
  },
};
