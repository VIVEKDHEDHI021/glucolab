import { Bell, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PermissionRationaleModal({ open, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scale-in">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
          <Bell className="h-6 w-6 animate-bounce" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="font-display text-xl font-bold text-foreground">
            Enable Health Reminders
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            GlucoLab needs notification permission to send your scheduled health reminders and notification actions.
          </p>
        </div>

        <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Timely blood glucose and insulin schedule prompts</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Interactive "Taken" and "Log Reading" drawer actions</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Respects your sleep schedule and quiet hours</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full rounded-xl font-semibold text-muted-foreground"
          >
            Not Now
          </Button>
          <Button
            onClick={onConfirm}
            className="w-full rounded-xl font-bold bg-primary text-primary-foreground shadow-md"
          >
            Allow Reminders
          </Button>
        </div>
      </div>
    </div>
  );
}
