import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Syringe, Disc, Keyboard, Plus, Trash2 } from "lucide-react";
import { supabase, getLocalDbService } from "@/db/client";
import { useAuth } from "@/frontend/lib/auth-context";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import { InsulinDoseWheel } from "@/features/pending-insulin";
import { cn } from "@/frontend/lib/utils";

type SlotKey = "morning" | "lunch" | "afternoon" | "evening" | "night";

export function InsulinDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showAfternoon, setShowAfternoon] = useState(false);
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeSlot, setActiveSlot] = useState<SlotKey>("morning");
  const [inputMode, setInputMode] = useState<"wheel" | "keypad">("wheel");

  const [doses, setDoses] = useState<Record<SlotKey, number>>({
    morning: 0,
    lunch: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  });

  // Load existing data when opening or when entryDate changes
  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !open || !entryDate) return;
      const { data } = await supabase
        .from("insulin_entries")
        .select("morning, lunch, afternoon, evening, night")
        .eq("user_id", user.id)
        .eq("entry_date", entryDate)
        .maybeSingle();

      if (active) {
        if (data) {
          setDoses({
            morning: Number(data.morning) || 0,
            lunch: Number(data.lunch) || 0,
            afternoon: Number(data.afternoon) || 0,
            evening: Number(data.evening) || 0,
            night: Number(data.night) || 0,
          });
          if (data.afternoon && Number(data.afternoon) > 0) {
            setShowAfternoon(true);
          } else {
            setShowAfternoon(false);
          }
        } else {
          setDoses({
            morning: 0,
            lunch: 0,
            afternoon: 0,
            evening: 0,
            night: 0,
          });
          setShowAfternoon(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [entryDate, user, open]);

  const updateDose = (slot: SlotKey, value: number) => {
    setDoses((prev) => ({
      ...prev,
      [slot]: Math.max(0, Math.min(200, value)),
    }));
  };

  const total =
    (doses.morning || 0) +
    (doses.lunch || 0) +
    (showAfternoon ? doses.afternoon || 0 : 0) +
    (doses.evening || 0) +
    (doses.night || 0);

  const formatted = showAfternoon
    ? `${doses.morning || 0}-${doses.lunch || 0}-${doses.afternoon || 0}-${doses.evening || 0}-${doses.night || 0}`
    : `${doses.morning || 0}-${doses.lunch || 0}-${doses.evening || 0}-${doses.night || 0}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      entry_date: entryDate,
      morning: doses.morning || 0,
      lunch: doses.lunch || 0,
      afternoon: showAfternoon ? doses.afternoon || 0 : 0,
      evening: doses.evening || 0,
      night: doses.night || 0,
    };

    try {
      const { error } = await supabase
        .from("insulin_entries")
        .upsert(payload, { onConflict: "user_id,entry_date" });
      if (error) throw error;

      // Update local SQLite cache
      try {
        const localDb = await getLocalDbService();
        await localDb.cacheInsulin([payload]);
      } catch {}

      toast.success("Insulin schedule saved");

      const displayFormat = showAfternoon
        ? `${payload.morning}-${payload.lunch}-${payload.afternoon}-${payload.evening}-${payload.night}`
        : `${payload.morning}-${payload.lunch}-${payload.evening}-${payload.night}`;

      // Trigger realtime health data refresh across app
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("health-data-updated"));
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to save insulin entries");
    } finally {
      setSaving(false);
    }
  };

  const visibleSlots: { id: SlotKey; label: string }[] = [
    { id: "morning", label: "Morning" },
    { id: "lunch", label: "Lunch" },
    ...(showAfternoon ? [{ id: "afternoon" as SlotKey, label: "Afternoon" }] : []),
    { id: "evening", label: "Evening" },
    { id: "night", label: "Night" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md p-4 sm:p-6 rounded-3xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Syringe className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-display text-foreground">
                Insulin Schedule
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Select slots and adjust doses with the wheel</p>
            </div>
          </div>

          {/* Wheel vs Keypad Toggle */}
          <button
            type="button"
            onClick={() => setInputMode((prev) => (prev === "wheel" ? "keypad" : "wheel"))}
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-xl transition-all border border-border/70"
            title={inputMode === "wheel" ? "Switch to manual keypad" : "Switch to circular wheel"}
          >
            {inputMode === "wheel" ? (
              <>
                <Keyboard className="h-3.5 w-3.5" />
                <span>Keypad</span>
              </>
            ) : (
              <>
                <Disc className="h-3.5 w-3.5 text-primary" />
                <span>Wheel</span>
              </>
            )}
          </button>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          {/* Date Selector */}
          <div className="space-y-1">
            <Label htmlFor="entry_date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Date
            </Label>
            <Input
              id="entry_date"
              type="date"
              max={format(new Date(), "yyyy-MM-dd")}
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="h-9 text-xs rounded-xl bg-muted/40 border-border/80"
            />
          </div>

          {inputMode === "wheel" ? (
            /* ============================================================ */
            /* WHEEL MODE: Slot Pills + Circular Number Wheel (NO KEYBOARD) */
            /* ============================================================ */
            <div className="space-y-3">
              {/* Slot Selection Pills */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Dose Slot
                  </span>
                  {!showAfternoon && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAfternoon(true);
                        setActiveSlot("afternoon");
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add afternoon</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                  {visibleSlots.map((slot) => {
                    const isActive = activeSlot === slot.id;
                    const doseVal = doses[slot.id] || 0;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setActiveSlot(slot.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-2xl border transition-all select-none",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm scale-102"
                            : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/60 hover:border-primary/40",
                        )}
                      >
                        <span className="text-[11px] font-bold">{slot.label}</span>
                        <span
                          className={cn(
                            "text-xs font-extrabold mt-0.5",
                            isActive ? "text-primary-foreground" : "text-primary",
                          )}
                        >
                          {doseVal}u
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Slot Header & Remove Afternoon if applicable */}
              <div className="flex items-center justify-between px-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground capitalize">
                    {activeSlot} Dose:
                  </span>
                  <span className="text-xs font-extrabold text-primary">
                    {doses[activeSlot]} units
                  </span>
                </div>
                {activeSlot === "afternoon" && showAfternoon && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAfternoon(false);
                      updateDose("afternoon", 0);
                      setActiveSlot("morning");
                    }}
                    className="text-[11px] text-destructive hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Circular Dose Wheel */}
              <div className="py-1">
                <InsulinDoseWheel
                  value={doses[activeSlot] || 0}
                  onChange={(val) => updateDose(activeSlot, val)}
                  min={0}
                  max={50}
                  disabled={saving}
                />
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* KEYPAD MODE: Fallback Inputs                                */
            /* ============================================================ */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {visibleSlots.map((slot) => (
                  <div key={slot.id} className="space-y-1.5">
                    <Label htmlFor={slot.id} className="capitalize flex items-center justify-between text-xs">
                      <span>{slot.label} (units)</span>
                      {slot.id === "afternoon" && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAfternoon(false);
                            updateDose("afternoon", 0);
                          }}
                          className="text-[10px] text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </Label>
                    <Input
                      id={slot.id}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="200"
                      step="0.5"
                      value={doses[slot.id] || 0}
                      onChange={(e) => updateDose(slot.id, parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                ))}
              </div>

              {!showAfternoon && (
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAfternoon(true)}
                    className="text-xs gap-1 h-8 rounded-xl border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5 transition-all"
                  >
                    + Add afternoon dose
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Summary Card */}
          <div className="rounded-2xl border border-border/80 bg-muted/40 p-3.5 text-center shadow-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Schedule Preview
            </div>
            <div className="mt-1 font-display text-2xl font-black tracking-wider text-primary">
              {formatted}
            </div>
            <div className="mt-1 text-xs text-muted-foreground font-medium">
              Total: <span className="font-bold text-foreground">{total} units</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-10 border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl text-xs font-bold h-10 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            >
              {saving ? "Saving..." : "Save Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
