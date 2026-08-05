import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import type { Reminder, ReminderHistory } from "../types";
import { reminderService } from "../services/reminderService";
import { reminderScheduler, hashStringToId } from "../scheduler/reminderScheduler";
import { format, parseISO, isSameMinute } from "date-fns";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/db/client";

interface ReminderContextValue {
  reminders: Reminder[];
  history: ReminderHistory[];
  loading: boolean;
  refreshReminders: () => Promise<void>;
  triggerScheduler: () => Promise<void>;
  handleReminderAction: (reminder: Reminder, action: "taken" | "skip" | "snooze", scheduledTimeStr?: string) => Promise<void>;
}

const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);

const ENABLE_REMINDERS = false; // Set to true when feature is completely ready

export function ReminderProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [history, setHistory] = useState<ReminderHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastTriggeredMinutes, setLastTriggeredMinutes] = useState<Record<string, string>>({}); // Maps reminderId -> YYYY-MM-DD HH:MM

  const refreshReminders = async () => {
    if (!user || !ENABLE_REMINDERS) return;
    setLoading(true);
    try {
      const [rData, hData] = await Promise.all([
        reminderService.getReminders(user.id),
        reminderService.getHistory(user.id),
      ]);
      setReminders(rData);
      setHistory(hData);

      // Perform smart auto-completes on data refresh
      await reminderService.checkReminderAutoCompletes(user.id);
    } catch (err) {
      console.warn("[REMINDER_PROVIDER] Failed to fetch reminders:", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerScheduler = async () => {
    if (!user || !ENABLE_REMINDERS) return;
    await reminderScheduler.scheduleAllReminders(user.id);
  };

  // Process a reminder response (Taken, Snoozed, Skipped)
  const handleReminderAction = async (
    reminder: Reminder,
    action: "taken" | "skip" | "snooze",
    scheduledTimeStr?: string
  ) => {
    if (!user) return;
    const timeStr = scheduledTimeStr || new Date().toISOString();

    try {
      let status: any = "completed";
      let actionTaken: any = "taken";

      if (action === "skip") {
        status = "skipped";
        actionTaken = "skip";
      } else if (action === "snooze") {
        status = "snoozed";
        actionTaken = "snooze";
      }

      // 1. Log in reminder_history
      await reminderService.logHistoryEntry({
        user_id: user.id,
        reminder_id: reminder.id,
        category: reminder.category,
        title: reminder.title,
        description: reminder.description || undefined,
        scheduled_time: timeStr,
        status,
        action_taken: actionTaken,
        action_time: new Date().toISOString(),
      });

      // 2. Perform category specific auto-logging
      if (action === "taken") {
        const todayStr = format(new Date(), "yyyy-MM-dd");

        if (reminder.category === "insulin") {
          const dose = Number(reminder.reminder_data.dosage) || 4;
          const timing = (reminder.reminder_data.notes || "").toLowerCase();
          
          // Check if insulin entry already exists for today
          const { data: existing } = await supabase
            .from("insulin_entries")
            .select("*")
            .eq("user_id", user.id)
            .eq("entry_date", todayStr);

          if (existing && existing.length > 0) {
            const current = existing[0];
            const updates: any = {};
            if (timing.includes("morning") || reminder.title.toLowerCase().includes("morning")) updates.morning = dose;
            else if (timing.includes("lunch") || reminder.title.toLowerCase().includes("lunch")) updates.lunch = dose;
            else if (timing.includes("afternoon") || reminder.title.toLowerCase().includes("afternoon")) updates.afternoon = dose;
            else if (timing.includes("evening") || reminder.title.toLowerCase().includes("evening")) updates.evening = dose;
            else if (timing.includes("night") || reminder.title.toLowerCase().includes("night") || timing.includes("bedtime")) updates.night = dose;
            else updates.morning = dose; // Default fallback

            await supabase
              .from("insulin_entries")
              .update(updates)
              .eq("id", current.id);
          } else {
            const entry: any = {
              user_id: user.id,
              morning: 0,
              lunch: 0,
              afternoon: 0,
              evening: 0,
              night: 0,
              entry_date: todayStr,
            };
            if (timing.includes("morning") || reminder.title.toLowerCase().includes("morning")) entry.morning = dose;
            else if (timing.includes("lunch") || reminder.title.toLowerCase().includes("lunch")) entry.lunch = dose;
            else if (timing.includes("afternoon") || reminder.title.toLowerCase().includes("afternoon")) entry.afternoon = dose;
            else if (timing.includes("evening") || reminder.title.toLowerCase().includes("evening")) entry.evening = dose;
            else if (timing.includes("night") || reminder.title.toLowerCase().includes("night") || timing.includes("bedtime")) entry.night = dose;
            else entry.morning = dose;

            await supabase.from("insulin_entries").insert(entry);
          }
          toast.success("Insulin dose recorded successfully!");
        } else if (reminder.category === "water") {
          toast.success("Hydration logged! Keep it up.");
        } else if (reminder.category === "medication") {
          toast.success(`Marked ${reminder.reminder_data.medicine_name || "medication"} as taken.`);
        }
      } else if (action === "snooze") {
        await reminderScheduler.scheduleSnooze(
          reminder.id,
          reminder.category,
          reminder.title,
          reminder.description || `Snoozed ${reminder.category} alarm.`
        );
        toast.info("Reminder snoozed for 10 minutes.");
      }

      await refreshReminders();
    } catch (err) {
      console.error("[REMINDER_PROVIDER] Action handler failed:", err);
    }
  };

  // Native LocalNotifications action handlers
  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    let notificationListener: any = null;

    async function setupMobileListeners() {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");

        // Action button tapped listener
        notificationListener = await LocalNotifications.addListener(
          "localNotificationActionPerformed",
          async (actionEvent) => {
            const { notification, actionId } = actionEvent;
            const extra = notification.extra;

            if (!extra || !extra.reminderId) return;

            // Fetch the reminder configuration
            const remindersList = await reminderService.getReminders(userId);
            const reminder = remindersList.find((r) => r.id === extra.reminderId);
            if (!reminder) return;

            console.log(`[MOBILE_NOTIFICATION] User action '${actionId}' on reminder:`, reminder.title);

            if (actionId === "taken" || actionId === "done") {
              await handleReminderAction(reminder, "taken", extra.scheduledTime);
            } else if (actionId === "skip") {
              await handleReminderAction(reminder, "skip", extra.scheduledTime);
            } else if (actionId === "snooze") {
              await handleReminderAction(reminder, "snooze", extra.scheduledTime);
            } else if (actionId === "scan" || actionId === "manual_entry") {
              // Redirect to dashboard where the user can log glucose
              navigate({ to: "/dashboard" });
            }
          }
        );
      } catch (err) {
        console.warn("[REMINDER_PROVIDER] LocalNotifications listener setup failed:", err);
      }
    }

    setupMobileListeners();

    return () => {
      if (notificationListener) {
        notificationListener.remove();
      }
    };
  }, [user]);

  // Web background ticker for active sessions
  useEffect(() => {
    if (!user || !ENABLE_REMINDERS || Capacitor.isNativePlatform()) return;

    // Check every 30 seconds
    const interval = setInterval(() => {
      const now = new Date();
      const currentMinuteStr = format(now, "yyyy-MM-dd HH:mm");

      for (const r of reminders.filter((rem) => rem.is_enabled)) {
        // Calculate schedules for today only
        const upcomingTimes = reminderScheduler.getUpcomingScheduledTimes(r, 1);
        
        for (const time of upcomingTimes) {
          if (isSameMinute(time, now)) {
            // Check if already triggered this minute
            const triggerKey = `${r.id}_${currentMinuteStr}`;
            if (lastTriggeredMinutes[r.id] === currentMinuteStr) continue;

            // Mark triggered
            setLastTriggeredMinutes((prev) => ({
              ...prev,
              [r.id]: currentMinuteStr,
            }));

            // Log notification as triggered
            reminderService.logHistoryEntry({
              user_id: user.id,
              reminder_id: r.id,
              category: r.category,
              title: r.title,
              description: r.description || undefined,
              scheduled_time: time.toISOString(),
              status: "triggered",
            }).then(() => refreshReminders());

            // 1. Desktop Notification
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification(r.title, {
                body: r.description || `Time for your ${r.category} log.`,
                icon: "/icon/icon.png",
              });
            }

            // 2. Play subtle haptic/audio alert via Web Audio API if browser allows, or simple click
            // 3. Premium Interactive Toast
            toast(r.title, {
              description: r.description || `Time for your ${r.category} log.`,
              duration: 25000,
              action: {
                label: "Mark Taken",
                onClick: () => handleReminderAction(r, "taken", time.toISOString()),
              },
              cancel: {
                label: "Skip",
                onClick: () => handleReminderAction(r, "skip", time.toISOString()),
              },
            });
          }
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, reminders, lastTriggeredMinutes]);

  // Initial trigger and sync
  useEffect(() => {
    if (user) {
      refreshReminders().then(() => triggerScheduler());
    }
  }, [user]);

  return (
    <ReminderContext.Provider
      value={{
        reminders,
        history,
        loading,
        refreshReminders,
        triggerScheduler,
        handleReminderAction,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(ReminderContext);
  if (!ctx) throw new Error("useReminders must be used within ReminderProvider");
  return ctx;
}
