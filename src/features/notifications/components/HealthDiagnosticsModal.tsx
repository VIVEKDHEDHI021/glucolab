import { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BellRing,
  Clock,
  Layers,
  BatteryCharging,
  Settings,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { notificationHealth } from "../services/notificationHealth";
import { notificationService } from "../services/notificationService";
import type { NotificationHealthStatus, PatientNotificationSettings } from "../types";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: PatientNotificationSettings;
}

export function HealthDiagnosticsModal({ open, onClose, settings }: Props) {
  const [health, setHealth] = useState<NotificationHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const status = await notificationHealth.checkHealth(settings);
      setHealth(status);
    } catch (e) {
      console.warn("Error running health check:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadHealth();
    }
  }, [open, settings]);

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      await notificationService.sendTestNotification("glucose");
      toast.success("Test notification dispatched! Check your notification drawer and banner.");
      // Refresh pending count after a brief interval
      setTimeout(loadHealth, 1500);
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger test notification.");
    } finally {
      setTesting(false);
    }
  };

  const handleOpenExactSettings = async () => {
    try {
      await notificationHealth.openExactAlarmSettings();
      toast.info("Opening Android Alarms & Reminders settings...");
    } catch (e) {
      toast.error("Could not open settings on this device.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Notification Health</h2>
              <p className="text-xs text-muted-foreground">Native scheduler &amp; permission diagnostics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-7 w-7 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Running system diagnostics...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Permission */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Permission</span>
                  {health?.permissionGranted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>
                <p className="text-sm font-bold">
                  {health?.permissionGranted ? "Granted" : "Blocked"}
                </p>
              </div>

              {/* Exact Alarms */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Exact Timing</span>
                  {health?.exactAlarmGranted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <p className="text-sm font-bold">
                  {health?.exactAlarmGranted ? "Enabled" : "Inexact"}
                </p>
              </div>

              {/* Channels */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Android Channels</span>
                  {health?.channelsConfigured ? (
                    <Layers className="h-4 w-4 text-primary" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                </div>
                <p className="text-sm font-bold">6 Active</p>
              </div>

              {/* Pending Alarms */}
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Pending Alarms</span>
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold">{health?.pendingNotificationsCount ?? 0} Scheduled</p>
              </div>
            </div>

            {/* Inexact Alarm Action Banner */}
            {!health?.exactAlarmGranted && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Exact alarm permission is disabled. Alarms may be batched by Android power saver.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleOpenExactSettings}
                    className="rounded-xl text-xs font-bold gap-1.5 border-amber-500/40"
                  >
                    <Settings className="h-3.5 w-3.5" /> Open Exact Alarm Settings
                  </Button>
                </div>
              </div>
            )}

            {/* Battery / Background Guidance */}
            <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <BatteryCharging className="h-4 w-4 text-primary" />
                <span>Battery &amp; Doze Mode Protection</span>
              </div>
              <p className="leading-relaxed">
                GlucoLab schedules native alarms with Android's <code className="text-primary font-mono text-[11px]">allowWhileIdle</code> flag, ensuring critical glucose and medication reminders fire even when the screen is locked and in Doze standby.
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground/80">
                If your device manufacturer uses aggressive battery optimization (e.g. Samsung OneUI, Xiaomi MIUI), verify that GlucoLab is set to "Unrestricted" battery in Android App Settings.
              </p>
            </div>

            {/* Errors / Warnings */}
            {health?.errors && health.errors.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">System Notices</h4>
                {health.errors.map((err, i) => (
                  <div key={i} className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl p-2.5">
                    {err}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <Button
            variant="outline"
            onClick={loadHealth}
            disabled={loading}
            className="w-full rounded-xl text-xs font-bold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            onClick={handleTestNotification}
            disabled={testing}
            className="w-full rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm"
          >
            <BellRing className="h-3.5 w-3.5" />
            {testing ? "Sending..." : "Test Heads-Up Alert"}
          </Button>
        </div>
      </div>
    </div>
  );
}
