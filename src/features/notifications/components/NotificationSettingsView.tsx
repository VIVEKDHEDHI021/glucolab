import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ArrowLeft,
  Moon,
  Activity,
  BellRing,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { useAuth } from "@/frontend/lib/auth-context";
import { notificationService } from "../services/notificationService";
import { notificationHealth } from "../services/notificationHealth";
import { getDefaultNotificationSettings } from "../constants";
import type { PatientNotificationSettings, NotificationHealthStatus } from "../types";
import { CategoryCards } from "./CategoryCards";
import { QuietHoursModal } from "./QuietHoursModal";
import { HealthDiagnosticsModal } from "./HealthDiagnosticsModal";
import { PermissionRationaleModal } from "./PermissionRationaleModal";
import { toast } from "sonner";

export function NotificationSettingsView() {
  const { user } = useAuth();
  const userId = user?.id || "anonymous";

  const [settings, setSettings] = useState<PatientNotificationSettings>(
    getDefaultNotificationSettings(userId)
  );
  const [health, setHealth] = useState<NotificationHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [quietHoursOpen, setQuietHoursOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const loaded = await notificationService.getSettings(userId);
        setSettings(loaded);
        const healthStatus = await notificationHealth.checkHealth(loaded);
        setHealth(healthStatus);
      } catch (e) {
        console.warn("Error loading notification settings:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handleSettingsChange = async (updated: PatientNotificationSettings) => {
    setSettings(updated);
    setSaving(true);
    try {
      await notificationService.updateSettings(userId, updated);
      toast.success("Notification schedules updated and reconciled.");
      const healthStatus = await notificationHealth.checkHealth(updated);
      setHealth(healthStatus);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update notification settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      await notificationService.sendTestNotification("glucose");
      toast.success("Test notification dispatched! Check your notification drawer and banner.");
      const healthStatus = await notificationHealth.checkHealth(settings);
      setHealth(healthStatus);
    } catch (e: any) {
      toast.error(e?.message || "Failed to trigger test notification.");
    } finally {
      setTesting(false);
    }
  };

  const handleRequestPermission = async () => {
    setRationaleOpen(false);
    try {
      const granted = await notificationHealth.requestPermissions();
      if (granted) {
        toast.success("Notification permission granted!");
        await notificationService.updateSettings(userId, settings);
      } else {
        toast.error("Notification permission denied. Please allow notifications in Android Settings.");
      }
      const healthStatus = await notificationHealth.checkHealth(settings);
      setHealth(healthStatus);
    } catch (e) {
      toast.error("Error requesting permission.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/settings">
            <button className="h-10 w-10 rounded-2xl bg-muted/60 hover:bg-muted border border-border/80 flex items-center justify-center text-foreground transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" /> Notification Center
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure health reminders, quiet hours, and drawer actions
            </p>
          </div>
        </div>

        {health?.permissionGranted ? (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Alarms Active</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setRationaleOpen(true)}
            className="rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Enable Alerts
          </Button>
        )}
      </div>

      {/* Permission Warning Banner if Denied */}
      {health && !health.permissionGranted && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-4.5 flex items-start gap-3.5 shadow-soft animate-scale-in">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                System Notifications Blocked
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                GlucoLab needs notification permission to send your scheduled blood glucose, insulin, and nutrition reminders.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setRationaleOpen(true)}
              className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
            >
              Grant Permission Now
            </Button>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Bar */}
      <div className="grid grid-cols-3 gap-2.5">
        <Button
          variant="outline"
          onClick={handleTestNotification}
          disabled={testing}
          className="rounded-2xl p-3 h-auto flex flex-col items-center justify-center gap-1.5 border-border/80 hover:bg-muted/60 text-center"
        >
          <BellRing className={`h-4 w-4 text-primary ${testing ? "animate-bounce" : ""}`} />
          <span className="text-[11px] font-bold">
            {testing ? "Testing..." : "Send Test Alert"}
          </span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setQuietHoursOpen(true)}
          className="rounded-2xl p-3 h-auto flex flex-col items-center justify-center gap-1.5 border-border/80 hover:bg-muted/60 text-center"
        >
          <Moon className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-bold">Quiet Hours</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => setDiagnosticsOpen(true)}
          className="rounded-2xl p-3 h-auto flex flex-col items-center justify-center gap-1.5 border-border/80 hover:bg-muted/60 text-center"
        >
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-bold">Diagnostics</span>
        </Button>
      </div>

      {/* Category List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Notification Categories
          </h2>
          {saving && (
            <span className="text-[10px] font-bold text-primary animate-pulse">
              Reconciling schedules...
            </span>
          )}
        </div>

        <CategoryCards settings={settings} onChange={handleSettingsChange} />
      </div>

      {/* Offline and Security Note */}
      <div className="bg-muted/30 border border-border/60 rounded-3xl p-4 flex items-center gap-3 text-xs text-muted-foreground">
        <Smartphone className="h-5 w-5 text-primary shrink-0" />
        <p className="leading-relaxed">
          All reminders are scheduled directly in your Android system's native AlarmManager. Reminders deliver reliably offline without relying on background internet connections.
        </p>
      </div>

      {/* Modals */}
      <QuietHoursModal
        open={quietHoursOpen}
        onClose={() => setQuietHoursOpen(false)}
        quietHours={settings.quietHours}
        snooze={settings.snooze}
        onSave={(quietHours, snooze) => {
          handleSettingsChange({
            ...settings,
            quietHours,
            snooze,
          });
        }}
      />

      <HealthDiagnosticsModal
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        settings={settings}
      />

      <PermissionRationaleModal
        open={rationaleOpen}
        onConfirm={handleRequestPermission}
        onCancel={() => setRationaleOpen(false)}
      />
    </div>
  );
}
