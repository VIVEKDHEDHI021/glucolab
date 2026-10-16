import { useState } from "react";
import { Moon, Clock, X, BellOff, Timer } from "lucide-react";
import { Switch } from "@/frontend/components/ui/switch";
import { Button } from "@/frontend/components/ui/button";
import type { QuietHoursConfig, SnoozeConfig } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  quietHours: QuietHoursConfig;
  snooze: SnoozeConfig;
  onSave: (quietHours: QuietHoursConfig, snooze: SnoozeConfig) => void;
}

export function QuietHoursModal({ open, onClose, quietHours, snooze, onSave }: Props) {
  const [enabled, setEnabled] = useState(quietHours.enabled);
  const [startTime, setStartTime] = useState(quietHours.startTime || "22:30");
  const [endTime, setEndTime] = useState(quietHours.endTime || "07:00");
  const [snoozeMinutes, setSnoozeMinutes] = useState(snooze.defaultDurationMinutes || 15);

  if (!open) return null;

  const handleSave = () => {
    onSave(
      {
        enabled,
        startTime,
        endTime,
      },
      {
        defaultDurationMinutes: snoozeMinutes,
      }
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold">Quiet Hours &amp; Snooze</h2>
              <p className="text-xs text-muted-foreground">Sleep protection and reminder delays</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quiet Hours Toggle */}
        <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <BellOff className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-bold">Enable Quiet Hours</h4>
              </div>
              <p className="text-xs text-muted-foreground">Silence non-critical alerts during rest.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <div className="pt-2 border-t border-border/50 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Bedtime (Start)
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Wake Up (End)
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </div>

        {/* Snooze Settings */}
        <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 space-y-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold">Default Snooze Duration</h4>
            </div>
            <p className="text-xs text-muted-foreground">Delay time when tapping "Remind Later".</p>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[10, 15, 30].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setSnoozeMinutes(mins)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  snoozeMinutes === mins
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
              >
                {mins} Mins
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="w-full rounded-xl text-xs font-bold bg-primary text-primary-foreground"
          >
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}
