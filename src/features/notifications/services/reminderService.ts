import { supabase } from "@/db/client";
import type { Reminder, ReminderHistory } from "../types";
import { format } from "date-fns";

// ─── LocalStorage Fallback ───────────────────────────────────────────────────
// Used when Supabase reminders/reminder_history tables don't exist yet or are
// unreachable. All data is stored in browser localStorage keyed by userId so
// reminders work immediately on web without a database migration.

const LS_REMINDERS  = (uid: string) => `glucolab_reminders_${uid}`;
const LS_HISTORY    = (uid: string) => `glucolab_reminder_history_${uid}`;

function lsGetReminders(userId: string): Reminder[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveReminders(userId: string, reminders: Reminder[]): void {
  try {
    localStorage.setItem(LS_REMINDERS(userId), JSON.stringify(reminders));
  } catch { /* quota exceeded — silently skip */ }
}

function lsGetHistory(userId: string): ReminderHistory[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveHistory(userId: string, history: ReminderHistory[]): void {
  try {
    localStorage.setItem(LS_HISTORY(userId), JSON.stringify(history));
  } catch { /* quota exceeded — silently skip */ }
}

// Helper: detect "table not found" Supabase errors (PGRST205 / schema cache miss)
function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const code = error?.code ?? "";
  const msg  = (error?.message ?? "").toLowerCase();
  return (
    code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("relation") ||
    code === "42P01"
  );
}

// ─── Reminder Service ────────────────────────────────────────────────────────

export const reminderService = {
  // Get all reminders configured by the user
  async getReminders(userId: string): Promise<Reminder[]> {
    try {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          // Table not yet migrated — return from localStorage
          console.warn("[REMINDER_SERVICE] reminders table missing, using localStorage cache.");
          return lsGetReminders(userId);
        }
        console.error("[REMINDER_SERVICE] Error fetching reminders:", error);
        // Non-fatal: fall back to local cache
        return lsGetReminders(userId);
      }

      // Success: sync remote list back to localStorage as a cache
      const reminders = (data || []) as Reminder[];
      lsSaveReminders(userId, reminders);
      return reminders;
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error fetching reminders, using localStorage:", err);
      return lsGetReminders(userId);
    }
  },

  // Add a new reminder
  async createReminder(
    reminder: Omit<Reminder, "id" | "created_at" | "updated_at"> & { id?: string }
  ): Promise<Reminder> {
    const id = reminder.id || crypto.randomUUID();
    const record: Reminder = {
      id,
      ...reminder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Reminder;

    try {
      const { data, error } = await supabase
        .from("reminders")
        .insert(record)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[REMINDER_SERVICE] reminders table missing, saving to localStorage.");
          const existing = lsGetReminders(record.user_id);
          lsSaveReminders(record.user_id, [record, ...existing]);
          return record;
        }
        console.error("[REMINDER_SERVICE] Error creating reminder:", error);
        // Fallback: save locally anyway so the user's work isn't lost
        const existing = lsGetReminders(record.user_id);
        lsSaveReminders(record.user_id, [record, ...existing]);
        return record;
      }

      // Success: also persist to localStorage as backup cache
      const saved = (data || record) as Reminder;
      const existing = lsGetReminders(record.user_id);
      lsSaveReminders(record.user_id, [saved, ...existing.filter(r => r.id !== saved.id)]);
      return saved;
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error creating reminder, saving to localStorage:", err);
      const existing = lsGetReminders(record.user_id);
      lsSaveReminders(record.user_id, [record, ...existing]);
      return record;
    }
  },

  // Update a reminder configuration
  async updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder> {
    const recordUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("reminders")
        .update(recordUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[REMINDER_SERVICE] reminders table missing, updating in localStorage.");
          // We need userId — get it from existing local records
          const userId = updates.user_id || "";
          const existing = lsGetReminders(userId) as Reminder[];
          const updated = existing.map(r =>
            r.id === id ? { ...r, ...recordUpdates } as Reminder : r
          );
          lsSaveReminders(userId, updated);
          return (updated.find(r => r.id === id) || { id, ...recordUpdates }) as Reminder;
        }
        console.error("[REMINDER_SERVICE] Error updating reminder:", error);
        // Fallback: try updating in all local caches
        const userId = updates.user_id || "";
        if (userId) {
          const existing = lsGetReminders(userId);
          const updated = existing.map(r =>
            r.id === id ? { ...r, ...recordUpdates } as Reminder : r
          );
          lsSaveReminders(userId, updated);
          return (updated.find(r => r.id === id) || { id, ...recordUpdates }) as Reminder;
        }
        throw error;
      }

      // Success: keep localStorage in sync
      const saved = data as Reminder;
      if (saved.user_id) {
        const existing = lsGetReminders(saved.user_id);
        lsSaveReminders(
          saved.user_id,
          existing.map(r => (r.id === saved.id ? saved : r))
        );
      }
      return saved;
    } catch (err: any) {
      if (isTableMissingError(err)) {
        const userId = updates.user_id || "";
        const existing = lsGetReminders(userId);
        const updated = existing.map(r =>
          r.id === id ? { ...r, ...recordUpdates } as Reminder : r
        );
        lsSaveReminders(userId, updated);
        return (updated.find(r => r.id === id) || { id, ...recordUpdates }) as Reminder;
      }
      throw err;
    }
  },

  // Remove a reminder
  async deleteReminder(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("reminders")
        .delete()
        .eq("id", id);

      if (error && !isTableMissingError(error)) {
        console.error("[REMINDER_SERVICE] Error deleting reminder:", error);
      }
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error deleting reminder:", err);
    }

    // Always remove from localStorage too
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith("glucolab_reminders_"));
    for (const key of allKeys) {
      try {
        const items: Reminder[] = JSON.parse(localStorage.getItem(key) || "[]");
        const filtered = items.filter(r => r.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch { /* ignore */ }
    }
  },

  // Fetch reminder response log/history
  async getHistory(userId: string): Promise<ReminderHistory[]> {
    try {
      const { data, error } = await supabase
        .from("reminder_history")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_time", { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[REMINDER_SERVICE] reminder_history table missing, using localStorage cache.");
          return lsGetHistory(userId);
        }
        console.error("[REMINDER_SERVICE] Error fetching history logs:", error);
        return lsGetHistory(userId);
      }

      const history = (data || []) as ReminderHistory[];
      lsSaveHistory(userId, history);
      return history;
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error fetching history, using localStorage:", err);
      return lsGetHistory(userId);
    }
  },

  // Create a history log (e.g. triggered, taken, skipped, etc.)
  async logHistoryEntry(
    entry: Omit<ReminderHistory, "id" | "created_at" | "updated_at"> & { id?: string }
  ): Promise<ReminderHistory> {
    const id = entry.id || crypto.randomUUID();
    const record: ReminderHistory = {
      id,
      ...entry,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ReminderHistory;

    try {
      const { data, error } = await supabase
        .from("reminder_history")
        .insert(record)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[REMINDER_SERVICE] reminder_history table missing, saving to localStorage.");
          const existing = lsGetHistory(record.user_id);
          lsSaveHistory(record.user_id, [record, ...existing]);
          return record;
        }
        console.error("[REMINDER_SERVICE] Error logging history entry:", error);
        const existing = lsGetHistory(record.user_id);
        lsSaveHistory(record.user_id, [record, ...existing]);
        return record;
      }

      const saved = (data || record) as ReminderHistory;
      const existing = lsGetHistory(record.user_id);
      lsSaveHistory(record.user_id, [saved, ...existing.filter(h => h.id !== saved.id)]);
      return saved;
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error logging history, saving to localStorage:", err);
      const existing = lsGetHistory(record.user_id);
      lsSaveHistory(record.user_id, [record, ...existing]);
      return record;
    }
  },

  // Update a log entry status (e.g. updating triggered -> completed)
  async updateHistoryEntry(id: string, updates: Partial<ReminderHistory>): Promise<ReminderHistory> {
    const recordUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("reminder_history")
        .update(recordUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[REMINDER_SERVICE] Error updating history log:", error);
        return { id, ...recordUpdates } as ReminderHistory;
      }

      return data as ReminderHistory;
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Network error updating history entry:", err);
      return { id, ...recordUpdates } as ReminderHistory;
    }
  },

  // Smart check: evaluate if logged entries auto-complete today's reminders
  async checkReminderAutoCompletes(userId: string): Promise<void> {
    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const [reminders, history] = await Promise.all([
        this.getReminders(userId),
        this.getHistory(userId),
      ]);

      const activeReminders = reminders.filter((r) => r.is_enabled);
      const todayLogs = history.filter(
        (h) => h.scheduled_time.startsWith(todayStr) && h.status === "completed"
      );

      // 1. Check Glucose entries recorded today
      const { data: glucoseEntries } = await supabase
        .from("glucose_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("date_time", `${todayStr}T00:00:00`)
        .lte("date_time", `${todayStr}T23:59:59`);

      if (glucoseEntries && glucoseEntries.length > 0) {
        const glucoseReminders = activeReminders.filter((r) => r.category === "glucose");
        for (const rem of glucoseReminders) {
          const matchedReading = glucoseEntries.find(
            (g) =>
              g.reading_type.toLowerCase() ===
                (rem.reminder_data.meal_type || "any").toLowerCase() ||
              (rem.reminder_data.notes &&
                g.notes &&
                g.notes.toLowerCase().includes(rem.reminder_data.notes.toLowerCase()))
          );

          if (matchedReading) {
            const alreadyLogged = todayLogs.some((h) => h.reminder_id === rem.id);
            if (!alreadyLogged) {
              await this.logHistoryEntry({
                user_id: userId,
                reminder_id: rem.id,
                category: "glucose",
                title: rem.title,
                description: `Auto-completed by manual glucose log: ${matchedReading.glucose} mg/dL`,
                scheduled_time: new Date().toISOString(),
                status: "completed",
                action_taken: "manual_entry",
                action_time: matchedReading.date_time || new Date().toISOString(),
                notes: matchedReading.notes || undefined,
              });
            }
          }
        }
      }

      // 2. Check Insulin entries recorded today
      const { data: insulinEntries } = await supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("entry_date", `${todayStr}T00:00:00`)
        .lte("entry_date", `${todayStr}T23:59:59`);

      if (insulinEntries && insulinEntries.length > 0) {
        const insulinReminders = activeReminders.filter((r) => r.category === "insulin");
        const ins = insulinEntries[0];

        for (const rem of insulinReminders) {
          const timing = rem.reminder_data.notes?.toLowerCase() || "";
          let doseLogged = 0;

          if (timing.includes("morning") || rem.title.toLowerCase().includes("morning")) {
            doseLogged = Number(ins.morning) || 0;
          } else if (timing.includes("lunch") || rem.title.toLowerCase().includes("lunch")) {
            doseLogged = Number(ins.lunch) || 0;
          } else if (timing.includes("afternoon") || rem.title.toLowerCase().includes("afternoon")) {
            doseLogged = Number(ins.afternoon) || 0;
          } else if (timing.includes("evening") || rem.title.toLowerCase().includes("evening")) {
            doseLogged = Number(ins.evening) || 0;
          } else if (
            timing.includes("night") ||
            rem.title.toLowerCase().includes("night") ||
            timing.includes("bedtime")
          ) {
            doseLogged = Number(ins.night) || 0;
          }

          if (doseLogged > 0) {
            const alreadyLogged = todayLogs.some((h) => h.reminder_id === rem.id);
            if (!alreadyLogged) {
              await this.logHistoryEntry({
                user_id: userId,
                reminder_id: rem.id,
                category: "insulin",
                title: rem.title,
                description: `Auto-completed by manual insulin log: ${doseLogged} units`,
                scheduled_time: new Date().toISOString(),
                status: "completed",
                action_taken: "manual_entry",
                action_time: ins.entry_date || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn("[REMINDER_SERVICE] Smart auto-complete check encountered an error:", err);
    }
  },
};
