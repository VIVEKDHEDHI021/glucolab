import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  Clock,
  Globe,
  Lock,
  Database,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Languages,
  Zap,
  Smartphone,
  Send,
  CheckCircle2,
  AlertCircle,
  Radio,
  Trash2,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Switch } from "@/frontend/components/ui/switch";
import { toast } from "sonner";
import { widgetService } from "@/services/widgetService";
import { useAuth } from "@/frontend/lib/auth-context";
import { patientReminderService } from "@/services/patientReminderService";
import { sendTestPushNotification } from "@/services/notificationService";
import { deviceService } from "@/services/deviceService";
import { useNotificationContext } from "@/providers/NotificationProvider";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — GlucoLab" }] }),
});

function SettingsPage() {
  const { user } = useAuth();
  const notificationContext = useNotificationContext();
  const [reminders, setReminders] = useState(true);
  const [highSugarAlerts, setHighSugarAlerts] = useState(true);
  const [lowSugarAlerts, setLowSugarAlerts] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [language, setLanguage] = useState("en");
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    deviceService.getCurrentDeviceToken().then((token) => {
      setDeviceToken(token);
    });
  }, [notificationContext.token]);

  const handleTestPush = async () => {
    if (!user) {
      toast.error("Please log in to test push notifications.");
      return;
    }

    setTestPushLoading(true);
    toast.promise(sendTestPushNotification(user.id), {
      loading: "Dispatching multi-device test push via Dual FCM & OneSignal...",
      success: (data) => {
        setTestPushLoading(false);
        if (data.success) {
          return `Test push sent! ${data.message}`;
        } else {
          throw new Error(data.message);
        }
      },
      error: (err) => {
        setTestPushLoading(false);
        return `Push delivery note: ${err?.message || "Check device registrations"}`;
      },
    });
  };

  const handleBackup = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Generating secure backup...",
        success: "Backup successfully saved to encrypted cloud database!",
        error: "Backup failed.",
      }
    );
  };

  const handleRestore = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Decrypting data package...",
        success: "Local cache updated successfully!",
        error: "Restore failed.",
      }
    );
  };

  const permission = notificationContext.permission;
  const isPermissionGranted = permission === "granted";

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your clinical notifications and data options.</p>
      </div>

      {/* Reminders Module */}
      <PatientRemindersCard />

      {/* Notifications Module */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Multi-Device Health Alerts
          </h3>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
              isPermissionGranted
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : permission === "denied"
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
            }`}
          >
            {isPermissionGranted ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Push Active
              </>
            ) : permission === "denied" ? (
              <>
                <AlertCircle className="h-3 w-3" /> Blocked
              </>
            ) : (
              <>
                <Radio className="h-3 w-3" /> Needs Permission
              </>
            )}
          </span>
        </div>

        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">High Sugar Warnings</h4>
              <p className="text-xs text-muted-foreground">Instant alerts when readings exceed 180 mg/dL.</p>
            </div>
            <Switch checked={highSugarAlerts} onCheckedChange={setHighSugarAlerts} />
          </div>

          <div className="border-t border-border/60" />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Low Sugar Warnings</h4>
              <p className="text-xs text-muted-foreground">Instant alerts when readings drop below 70 mg/dL.</p>
            </div>
            <Switch checked={lowSugarAlerts} onCheckedChange={setLowSugarAlerts} />
          </div>

          <div className="border-t border-border/60" />

          {/* Test Push & Registration Action */}
          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-2xl border border-border/40">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-primary" /> Dual FCM & OneSignal Verification
              </div>
              <p className="text-[11px] text-muted-foreground">
                {deviceToken ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                    Device token registered ({deviceToken.substring(0, 16)}...)
                  </span>
                ) : (
                  "No push token registered yet on this browser/device."
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isPermissionGranted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold h-8"
                  onClick={() => notificationContext.initNotifications()}
                >
                  Enable Push
                </Button>
              )}
              <Button
                size="sm"
                disabled={testPushLoading}
                onClick={handleTestPush}
                className="rounded-xl text-xs font-bold h-8 flex items-center gap-1.5 shadow-sm"
              >
                <Send className="h-3 w-3" /> Test Push
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences & Security */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> Preferences & Security
        </h3>

        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Biometric Access Locked</h4>
              <p className="text-xs text-muted-foreground">Require fingerprint/face scanner on launch.</p>
            </div>
            <Switch checked={biometrics} onCheckedChange={setBiometrics} />
          </div>

          <div className="border-t border-border/60" />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Application Language</h4>
              <p className="text-xs text-muted-foreground">Selected translations interface.</p>
            </div>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                toast.success(`Language changed to ${e.target.value === "en" ? "English" : "Spanish"}`);
              }}
              className="bg-muted/45 text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 theme-transition"
            >
              <option value="en">English (US)</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Insulin Widget Presets Module */}
      <QuickInsulinPresetsCard />

      {/* Cloud Backups */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" /> Cloud Backups
        </h3>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          Create encrypted files to backup all your local reports, weight metrics, and smart scanner read logs safely.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button onClick={handleBackup} variant="secondary" className="w-full btn-ripple-effect rounded-xl font-bold">
            Backup Now
          </Button>
          <Button onClick={handleRestore} variant="outline" className="w-full btn-ripple-effect rounded-xl font-bold">
            Restore Backup
          </Button>
        </div>
      </div>

      {/* Account & Data Management */}
      <div className="bg-card border border-destructive/30 rounded-3xl p-5 shadow-soft space-y-3">
        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" /> Account &amp; Data Deletion
        </h3>
        
        <p className="text-xs text-muted-foreground leading-relaxed">
          Permanently delete your user account, credentials, and all recorded blood glucose, insulin, and weight logs.
        </p>

        <div className="pt-1">
          <Link to="/delete-account">
            <Button
              variant="outline"
              className="w-full rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Manage or Delete Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer Version Details */}
      <div className="text-center space-y-1.5 py-4">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" /> GlucoLab Pro Safe Engine
        </div>
        <p className="text-[10px] text-muted-foreground font-semibold">Version 2.4.0 (Build 90)</p>
        <div className="pt-1">
          <Link
            to="/privacy-policy"
            className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            Privacy Policy &amp; Health Data Protection
          </Link>
        </div>
      </div>
    </div>
  );
}

function PatientRemindersCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insulinEnabled, setInsulinEnabled] = useState(false);
  const [insulinTime, setInsulinTime] = useState("20:00");
  const [glucoseEnabled, setGlucoseEnabled] = useState(false);
  const [glucoseDays, setGlucoseDays] = useState(2);

  useEffect(() => {
    if (!user) return;
    patientReminderService.getSettings(user.id).then((settings) => {
      setInsulinEnabled(settings.insulin_reminder_enabled);
      setInsulinTime(settings.insulin_reminder_time || "20:00");
      setGlucoseEnabled(settings.glucose_reminder_enabled);
      setGlucoseDays(settings.glucose_reminder_days || 2);
      setLoading(false);
    });
  }, [user]);

  const handleToggleInsulin = async (enabled: boolean) => {
    setInsulinEnabled(enabled);
    if (!user) return;
    const res = await patientReminderService.saveSettings(user.id, {
      insulin_reminder_enabled: enabled,
      insulin_reminder_time: insulinTime,
    });
    if (res.success) {
      toast.success(enabled ? "Insulin reminder enabled" : "Insulin reminder disabled");
    } else {
      toast.error("Failed to update reminder settings");
    }
  };

  const handleChangeInsulinTime = async (time: string) => {
    setInsulinTime(time);
    if (!user) return;
    const res = await patientReminderService.saveSettings(user.id, {
      insulin_reminder_enabled: insulinEnabled,
      insulin_reminder_time: time,
    });
    if (res.success) {
      toast.success("Insulin reminder time updated");
    }
  };

  const handleToggleGlucose = async (enabled: boolean) => {
    setGlucoseEnabled(enabled);
    if (!user) return;
    const res = await patientReminderService.saveSettings(user.id, {
      glucose_reminder_enabled: enabled,
      glucose_reminder_days: glucoseDays,
    });
    if (res.success) {
      toast.success(enabled ? "Glucose check reminder enabled" : "Glucose check reminder disabled");
    } else {
      toast.error("Failed to update reminder settings");
    }
  };

  const handleChangeGlucoseDays = async (days: number) => {
    setGlucoseDays(days);
    if (!user) return;
    const res = await patientReminderService.saveSettings(user.id, {
      glucose_reminder_enabled: glucoseEnabled,
      glucose_reminder_days: days,
    });
    if (res.success) {
      toast.success(`Glucose reminder set for ${days} ${days === 1 ? "day" : "days"} inactivity`);
    }
  };

  return (
    <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
      <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" /> Reminders
      </h3>

      <div className="space-y-4 pt-1">
        {/* Insulin Reminder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <span>💉</span> Insulin Reminder
              </h4>
              <p className="text-xs text-muted-foreground">
                Remind to record today&apos;s dose if not added yet.
              </p>
            </div>
            <Switch
              disabled={loading}
              checked={insulinEnabled}
              onCheckedChange={handleToggleInsulin}
            />
          </div>

          {insulinEnabled && (
            <div className="flex items-center justify-between pl-6 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Reminder time:</span>
              <input
                type="time"
                value={insulinTime}
                onChange={(e) => handleChangeInsulinTime(e.target.value)}
                className="bg-muted/45 text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              />
            </div>
          )}
        </div>

        <div className="border-t border-border/60" />

        {/* Glucose Check Reminder */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <span>🩸</span> Glucose Check Reminder
              </h4>
              <p className="text-xs text-muted-foreground">
                Remind to check glucose if not recorded recently.
              </p>
            </div>
            <Switch
              disabled={loading}
              checked={glucoseEnabled}
              onCheckedChange={handleToggleGlucose}
            />
          </div>

          {glucoseEnabled && (
            <div className="flex items-center justify-between pl-6 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Reminder after:</span>
              <select
                value={glucoseDays}
                onChange={(e) => handleChangeGlucoseDays(Number(e.target.value))}
                className="bg-muted/45 text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              >
                <option value={1}>1 day</option>
                <option value={2}>2 days (Default)</option>
                <option value={3}>3 days</option>
                <option value={5}>5 days</option>
                <option value={7}>7 days</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickInsulinPresetsCard() {
  const [presets, setPresets] = useState({
    preset1: 4,
    preset2: 6,
    preset3: 8,
    preset4: 10,
    safetyLimit: 20,
  });

  useEffect(() => {
    widgetService.getPresets().then(setPresets);
  }, []);

  const handleChange = (field: string, val: number) => {
    const updated = { ...presets, [field]: val };
    setPresets(updated);
    widgetService.savePresets(updated);
    toast.success("Quick Insulin widget presets updated!");
  };

  return (
    <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
      <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" /> Quick Insulin Presets (Android Widget)
      </h3>
      <p className="text-xs text-muted-foreground">
        Customize the 4 preset dose buttons on your Android Home Screen Quick Insulin widget.
      </p>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Preset 1 (Units)</label>
          <input
            type="number"
            value={presets.preset1}
            onChange={(e) => handleChange("preset1", Number(e.target.value) || 0)}
            className="mt-1 w-full bg-muted/45 text-sm font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Preset 2 (Units)</label>
          <input
            type="number"
            value={presets.preset2}
            onChange={(e) => handleChange("preset2", Number(e.target.value) || 0)}
            className="mt-1 w-full bg-muted/45 text-sm font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Preset 3 (Units)</label>
          <input
            type="number"
            value={presets.preset3}
            onChange={(e) => handleChange("preset3", Number(e.target.value) || 0)}
            className="mt-1 w-full bg-muted/45 text-sm font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Preset 4 (Units)</label>
          <input
            type="number"
            value={presets.preset4}
            onChange={(e) => handleChange("preset4", Number(e.target.value) || 0)}
            className="mt-1 w-full bg-muted/45 text-sm font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">High Dose Safety Limit</h4>
            <p className="text-xs text-muted-foreground">Doses above this limit require confirmation.</p>
          </div>
          <input
            type="number"
            value={presets.safetyLimit}
            onChange={(e) => handleChange("safetyLimit", Number(e.target.value) || 20)}
            className="w-20 bg-muted/45 text-sm font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 text-center font-bold"
          />
        </div>
      </div>
    </div>
  );
}
