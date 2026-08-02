import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { format, subDays, startOfDay, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Clock,
  Plus,
  Edit2,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Heart,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/frontend/lib/auth-context";
import { useReminders } from "@/features/notifications/providers/ReminderProvider";
import { reminderService } from "@/features/notifications/services/reminderService";
import { ReminderDialog } from "@/features/notifications/components/reminder-dialog";
import { Button } from "@/frontend/components/ui/button";
import { Switch } from "@/frontend/components/ui/switch";
import { toast } from "sonner";
import type { Reminder, ReminderHistory } from "@/features/notifications/types";

export const Route = createFileRoute("/_authenticated/reminders")({
  component: RemindersPage,
  head: () => ({ meta: [{ title: "GlucoLab — Health Companion Alerts" }] }),
});

function RemindersPage() {
  const { user } = useAuth();
  const {
    reminders,
    history,
    loading,
    refreshReminders,
    triggerScheduler,
    handleReminderAction,
  } = useReminders();

  const [activeTab, setActiveTab] = useState<"manage" | "history" | "stats">("manage");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    refreshReminders();
  }, [user]);

  const handleCreateNew = () => {
    setEditingReminder(null);
    setDialogOpen(true);
  };

  const handleEdit = (r: Reminder) => {
    setEditingReminder(r);
    setDialogOpen(true);
  };

  const handleDuplicate = async (r: Reminder) => {
    try {
      const clone: Omit<Reminder, "id" | "created_at" | "updated_at"> = {
        user_id: r.user_id,
        category: r.category,
        title: `${r.title} (Clone)`,
        description: r.description,
        is_enabled: r.is_enabled,
        schedule_type: r.schedule_type,
        schedule_data: r.schedule_data,
        reminder_data: r.reminder_data,
        sound: r.sound,
        vibrate: r.vibrate,
        sync_status: "pending_sync",
      };
      await reminderService.createReminder(clone);
      toast.success("Reminder configuration duplicated!");
      await refreshReminders();
      await triggerScheduler();
    } catch (err) {
      toast.error("Failed to duplicate reminder.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder rule?")) return;
    try {
      await reminderService.deleteReminder(id);
      toast.success("Reminder deleted.");
      await refreshReminders();
      await triggerScheduler();
    } catch (err) {
      toast.error("Failed to delete reminder.");
    }
  };

  const handleToggleActive = async (r: Reminder, checked: boolean) => {
    try {
      await reminderService.updateReminder(r.id, {
        is_enabled: checked,
        sync_status: "pending_sync",
      });
      toast.success(checked ? "Reminder enabled." : "Reminder muted.");
      await refreshReminders();
      await triggerScheduler();
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  // 7-day adherence calculations
  const statsData = useMemo(() => {
    const data: Record<string, { dateStr: string; dateLabel: string; total: number; done: number }> = {};
    
    // Initialize past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const dStr = format(d, "yyyy-MM-dd");
      const dLabel = format(d, "MM/dd");
      data[dStr] = { dateStr: dStr, dateLabel: dLabel, total: 0, done: 0 };
    }

    // Tabulate from log history
    history.forEach((h) => {
      if (!h.scheduled_time) return;
      const dStr = h.scheduled_time.split("T")[0];
      if (data[dStr]) {
        // Triggered/snoozed represents total scheduled occurrences
        if (h.status === "triggered" || h.status === "completed" || h.status === "skipped" || h.status === "missed") {
          data[dStr].total += 1;
        }
        if (h.status === "completed") {
          data[dStr].done += 1;
        }
      }
    });

    return Object.values(data).map((day) => ({
      name: day.dateLabel,
      compliance: day.total > 0 ? Math.round((day.done / day.total) * 100) : 100,
      totalAlerts: day.total,
      takenCount: day.done,
    }));
  }, [history]);

  // Overall Adherence Metrics
  const complianceStats = useMemo(() => {
    const logs = history.filter((h) => h.status !== "snoozed" && h.status !== "triggered");
    const completed = logs.filter((l) => l.status === "completed").length;
    const rate = logs.length > 0 ? Math.round((completed / logs.length) * 100) : 100;
    return { total: logs.length, completed, rate };
  }, [history]);

  // Helper to color category tags
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "insulin":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
      case "glucose":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "medication":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      case "water":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      case "meal":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  const formatScheduleText = (r: Reminder) => {
    const sData = r.schedule_data;
    if (r.schedule_type === "interval") {
      return `Every ${sData.intervalMinutes}m from ${sData.intervalStart} to ${sData.intervalEnd}`;
    }
    const daysText =
      r.schedule_type === "weekly" || r.schedule_type === "custom_days"
        ? ` (Days: ${sData.days?.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")})`
        : "";
    const timesText = sData.times?.join(", ") || "";
    return `${r.schedule_type.toUpperCase()}${daysText} at ${timesText}`;
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Temporarily Disabled Notice */}
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-5 text-warning-foreground">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-warning shrink-0" />
          <div>
            <h3 className="font-semibold text-base">Reminders Feature Temporarily Disabled</h3>
            <p className="text-sm opacity-90">
              The reminders and notification system is currently turned off while we optimize background alerts. It will be enabled soon.
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between opacity-50 pointer-events-none">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            Diabetes Companion Alerts <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure alarms, log daily checklists, and view health routine adherence. Works fully offline.
          </p>
        </div>
        <Button disabled onClick={handleCreateNew} className="gradient-primary text-white h-11 rounded-xl shadow-soft">
          <Plus className="h-4 w-4 mr-2" /> Configure Reminder
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["manage", "history", "stats"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-all duration-200 ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "manage" ? "Alert Rules" : tab === "history" ? "Action Log Feed" : "Adherence Insights"}
          </button>
        ))}
      </div>

      {/* TAB 1: MANAGE REMINDERS */}
      {activeTab === "manage" && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-10 text-sm text-muted-foreground animate-pulse">
              Loading configurations...
            </div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl space-y-3 bg-muted/20">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">No alerts configured yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Set up a schedule for your morning insulin, post-meal glucose checks, or hydration intervals.
              </p>
              <Button onClick={handleCreateNew} size="sm" className="gradient-primary text-white mt-2 rounded-lg">
                Create First Alert
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-2xl border border-border p-5 bg-card shadow-soft space-y-4 transition-all relative ${
                    !r.is_enabled ? "opacity-75" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border capitalize ${getCategoryColor(r.category)}`}>
                        {r.category.replace("_", " ")}
                      </span>
                      <h3 className="font-display font-bold text-base leading-snug">{r.title}</h3>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                    </div>

                    <Switch
                      checked={r.is_enabled}
                      onCheckedChange={(checked) => handleToggleActive(r, checked)}
                    />
                  </div>

                  {/* Schedule Details Row */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-xl border border-border/50">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium truncate">{formatScheduleText(r)}</span>
                  </div>

                  {/* Context specific tags */}
                  {r.category === "insulin" && r.reminder_data.dosage && (
                    <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/5 px-2.5 py-1 rounded-lg border border-purple-500/10 inline-block">
                      Dose: {r.reminder_data.dosage} {r.reminder_data.unit || "units"}
                    </div>
                  )}
                  {r.category === "medication" && r.reminder_data.medicine_name && (
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/5 px-2.5 py-1 rounded-lg border border-blue-500/10 inline-block">
                      {r.reminder_data.medicine_name} {r.reminder_data.dosage && `(${r.reminder_data.dosage} ${r.reminder_data.unit || "mg"})`}
                    </div>
                  )}

                  {/* Actions footer */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                    <button
                      onClick={() => handleDuplicate(r)}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      title="Duplicate"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(r)}
                      className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="p-2 rounded-lg border border-border text-destructive hover:bg-destructive-soft transition-all"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTION LOG FEED */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-16 border border-border rounded-3xl space-y-2 bg-muted/10">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">No response history yet</p>
              <p className="text-xs text-muted-foreground">
                History of logged triggers, completed dosages, and skipped reminders will display here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 30).map((h) => {
                const dateLabel = format(parseISO(h.scheduled_time), "MMM d, HH:mm");
                const matchedReminder = reminders.find((rem) => rem.id === h.reminder_id);

                return (
                  <div key={h.id} className="rounded-2xl border border-border p-4 bg-card shadow-soft flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {h.status === "completed" ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : h.status === "skipped" ? (
                          <XCircle className="h-5 w-5 text-muted-foreground" />
                        ) : h.status === "snoozed" ? (
                          <Clock className="h-5 w-5 text-warning" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">{h.title}</h4>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${getCategoryColor(h.category)}`}>
                            {h.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Scheduled: {dateLabel} {h.description && `• ${h.description}`}
                        </p>
                        {h.action_time && (
                          <p className="text-[10px] text-muted-foreground/80 italic">
                            Logged Action: {h.action_taken} at {format(parseISO(h.action_time), "HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Quick interactive trigger if status is triggered/missed */}
                    {(h.status === "triggered" || h.status === "snoozed") && matchedReminder && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReminderAction(matchedReminder, "taken", h.scheduled_time)}
                          className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                        >
                          Mark Taken
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReminderAction(matchedReminder, "snooze", h.scheduled_time)}
                          className="h-8 rounded-lg text-xs"
                        >
                          Snooze
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReminderAction(matchedReminder, "skip", h.scheduled_time)}
                          className="h-8 rounded-lg text-xs hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADHERENCE STATS */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {/* Compliance KPI Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Overall Compliance
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-primary">
                  {complianceStats.rate}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Goal: &gt;90% adherence</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Completed Dosage
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-emerald-500">
                  {complianceStats.completed}
                </span>
                <span className="text-xs text-muted-foreground">logs</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Fully recorded items</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex flex-col justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Events
              </span>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-extrabold text-zinc-600 dark:text-zinc-300">
                  {complianceStats.total}
                </span>
                <span className="text-xs text-muted-foreground">alerts</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Pending syncs checked</p>
            </div>
          </div>

          {/* Compliance Weekly Line Chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h3 className="font-display font-bold text-base mb-4 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Adherence Trend (Past 7 Days)
            </h3>

            {statsData.length > 0 && statsData.some(d => d.totalAlerts > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={statsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="compliance"
                    name="Compliance Rate (%)"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                No alert history logs in the last 7 days.
              </div>
            )}
          </div>
        </div>
      )}

      {/* dialog popup */}
      <ReminderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reminder={editingReminder}
      />
    </div>
  );
}
