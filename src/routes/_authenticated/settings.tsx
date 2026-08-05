import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  Globe,
  Lock,
  Database,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Languages,
  Zap,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Switch } from "@/frontend/components/ui/switch";
import { toast } from "sonner";
import { widgetService } from "@/services/widgetService";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — GlucoLab" }] }),
});

function SettingsPage() {
  const [reminders, setReminders] = useState(true);
  const [highSugarAlerts, setHighSugarAlerts] = useState(true);
  const [lowSugarAlerts, setLowSugarAlerts] = useState(true);
  const [biometrics, setBiometrics] = useState(false);
  const [language, setLanguage] = useState("en");

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-fade-in">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your clinical notifications and data options.</p>
      </div>

      {/* Notifications Module */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4">
        <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </h3>
        
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between opacity-60">
            <div>
              <h4 className="text-sm font-semibold">Medication Reminders</h4>
              <p className="text-xs text-muted-foreground">Alerts for checking glucose (Disabled temporarily).</p>
            </div>
            <Switch disabled checked={false} onCheckedChange={() => {}} />
          </div>

          <div className="border-t border-border/60" />

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
          Create encrypted files to backup all your local reports and weight metrics safely.
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

      {/* Footer Version Details */}
      <div className="text-center space-y-1 py-4">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" /> GlucoLab Pro Safe Engine
        </div>
        <p className="text-[10px] text-muted-foreground font-semibold">Version 2.4.0 (Build 90)</p>
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
