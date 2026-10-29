import { useState, useEffect } from "react";
import { format, subDays, addDays } from "date-fns";
import { toast } from "sonner";
import { Syringe, Disc, Keyboard, Plus, Trash2, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
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
  initialDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  initialDate?: string;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showAfternoon, setShowAfternoon] = useState(false);
  const [entryDate, setEntryDate] = useState(initialDate || format(new Date(), "yyyy-MM-dd"));
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotKey>("morning");
  const [inputMode, setInputMode] = useState<"wheel" | "keypad">("wheel");

  const [doses, setDoses] = useState<Record<SlotKey, number>>({
    morning: 0,
    lunch: 0,
    afternoon: 0,
    evening: 0,
    night: 0,
  });

  useEffect(() => {
    if (open) {
      setEntryDate(initialDate || format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, initialDate]);

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
          setHasExistingRecord(true);
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
          setHasExistingRecord(false);
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
    const intVal = Number.isFinite(value) ? Math.round(value) : 0;
    setDoses((prev) => ({
      ...prev,
      [slot]: Math.max(0, Math.min(200, intVal)),
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
      <DialogContent className="w-[95vw] max-w-[420px] max-h-[96dvh] p-3 sm:p-4 rounded-3xl flex flex-col gap-2 overflow-hidden [@media(max-height:550px)]:overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-1.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Syringe className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm sm:text-base font-bold font-display text-foreground leading-tight">
                {hasExistingRecord ? "Update Insulin Doses" : "Insulin Schedule"}
              </DialogTitle>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight line-clamp-1">
                {hasExistingRecord
                  ? `Editing doses for ${format(new Date(entryDate + "T12:00:00"), "MMM d, yyyy")}`
                  : "Select slots and adjust doses with the wheel"}
              </p>
            </div>
          </div>

          {/* Wheel vs Keypad Toggle */}
          <button
            type="button"
            onClick={() => setInputMode((prev) => (prev === "wheel" ? "keypad" : "wheel"))}
            className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-2 py-1 rounded-xl transition-all border border-border/70 shrink-0"
            title={inputMode === "wheel" ? "Switch to manual keypad" : "Switch to circular wheel"}
          >
            {inputMode === "wheel" ? (
              <>
                <Keyboard className="h-3 w-3" />
                <span>Keypad</span>
              </>
            ) : (
              <>
                <Disc className="h-3 w-3 text-primary" />
                <span>Wheel</span>
              </>
            )}
          </button>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex-1 flex flex-col justify-between min-h-0 space-y-2">
          {/* Enhanced Accessible Date Selector */}
          <div className="bg-muted/40 p-2.5 sm:p-3 rounded-2xl border border-border/80 shadow-xs space-y-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="entry_date"
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Calendar className="h-4 w-4 text-primary" />
                <span>Select Date</span>
              </Label>
              <div className="flex items-center gap-1.5">
                {hasExistingRecord && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Existing Record (Edit)
                  </span>
                )}
                {entryDate !== format(new Date(), "yyyy-MM-dd") && (
                  <button
                    type="button"
                    onClick={() => setEntryDate(format(new Date(), "yyyy-MM-dd"))}
                    className="text-xs font-bold text-primary hover:bg-primary/10 px-2 py-0.5 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl border-border/80 bg-background hover:bg-muted active:scale-95 shadow-xs transition-all"
                onClick={() => {
                  const prev = subDays(new Date(entryDate + "T12:00:00"), 1);
                  setEntryDate(format(prev, "yyyy-MM-dd"));
                }}
                title="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <Input
                id="entry_date"
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-10 text-sm font-bold rounded-xl bg-background border-border/80 text-center shadow-xs cursor-pointer hover:border-primary/50 transition-colors flex-1"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl border-border/80 bg-background hover:bg-muted active:scale-95 shadow-xs transition-all disabled:opacity-25"
                disabled={entryDate >= format(new Date(), "yyyy-MM-dd")}
                onClick={() => {
                  const next = addDays(new Date(entryDate + "T12:00:00"), 1);
                  setEntryDate(format(next, "yyyy-MM-dd"));
                }}
                title="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {inputMode === "wheel" ? (
            /* ============================================================ */
            /* WHEEL MODE: Slot Pills + Circular Number Wheel (NO KEYBOARD) */
            /* ============================================================ */
            <div className="space-y-1.5 shrink-0">
              {/* Slot Selection Pills */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Select Dose Slot
                </span>
                {!showAfternoon && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAfternoon(true);
                      setActiveSlot("afternoon");
                    }}
                    className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    <span>Add afternoon</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1">
                {visibleSlots.map((slot) => {
                  const isActive = activeSlot === slot.id;
                  const doseVal = doses[slot.id] || 0;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setActiveSlot(slot.id)}
                      className={cn(
                        "flex flex-col items-center justify-center py-1 px-1 rounded-xl border transition-all select-none",
                        isActive
                          ? "bg-primary text-primary-foreground border-primary shadow-xs scale-[1.02]"
                          : "bg-muted/30 border-border/70 text-foreground hover:bg-muted/60 hover:border-primary/40",
                      )}
                    >
                      <span className="text-[10px] font-bold">{slot.label}</span>
                      <span
                        className={cn(
                          "text-xs font-black mt-0.5",
                          isActive ? "text-primary-foreground" : "text-primary",
                        )}
                      >
                        {doseVal}u
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Slot Header & Remove Afternoon if applicable */}
              <div className="flex items-center justify-between px-0.5 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-foreground capitalize">
                    {activeSlot} Dose:
                  </span>
                  <span className="text-[11px] font-black text-primary">
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
                    className="text-[10px] text-destructive hover:underline flex items-center gap-0.5"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Classic iOS Vertical Dose Wheel */}
              <div className="flex justify-center py-0.5">
                <InsulinDoseWheel
                  value={doses[activeSlot] || 0}
                  onChange={(val) => updateDose(activeSlot, val)}
                  min={0}
                  max={50}
                  height={200}
                  disabled={saving}
                />
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* KEYPAD MODE: Fallback Inputs                                */
            /* ============================================================ */
            <div className="space-y-2 py-1 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                {visibleSlots.map((slot) => (
                  <div key={slot.id} className="space-y-1">
                    <Label htmlFor={slot.id} className="capitalize flex items-center justify-between text-[11px]">
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
                      step="1"
                      value={doses[slot.id] || 0}
                      onChange={(e) => updateDose(slot.id, parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs rounded-xl"
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
                    className="text-xs gap-1 h-7 rounded-xl border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5 transition-all"
                  >
                    + Add afternoon dose
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Summary Card - Compact Bar */}
          <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-1.5 flex items-center justify-between shadow-xs shrink-0">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Schedule Preview
              </div>
              <div className="font-display text-base font-black tracking-wider text-primary leading-tight">
                {formatted}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                Total
              </div>
              <div className="font-display text-xs font-black text-foreground leading-tight">
                {total} <span className="text-[10px] font-medium text-muted-foreground">units</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row gap-2 pt-0.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl text-xs h-9 border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {saving ? "Saving..." : hasExistingRecord ? "Update Doses" : "Save Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
