import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { getUserFriendlyError, getSuccessMessage, logDiagnostic } from "@/frontend/lib/user-messages";
import { Syringe, Disc, Keyboard, Plus, Trash2, Calendar, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { supabase, getLocalDbService } from "@/db/client";
import { healthService } from "@/backend/services/healthService";
import { idempotencyService } from "@/backend/services/idempotencyService";
import { useAuth } from "@/frontend/lib/auth-context";
import { useHealthData } from "@/frontend/providers/data-context";
import type { InsulinEntry } from "@/frontend/lib/types";
import {
  insulinService,
  validateDose,
  evaluateDailyStatus,
  type DailyStatus,
} from "@/features/insulin";
import { getLocalDateKey, addDaysLocal, subDaysLocal, formatLocalDate } from "@/frontend/lib/date-utils";
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
  entryId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  initialDate?: string;
  entryId?: string;
}) {
  const { user } = useAuth();
  const { insulin: cachedInsulinList, optimisticAddOrUpdateInsulin, rollbackOptimisticInsulin } = useHealthData();
  const dateCacheRef = useRef<Map<string, any>>(new Map());

  const [saving, setSaving] = useState(false);
  const [showAfternoon, setShowAfternoon] = useState(false);
  const [entryDate, setEntryDate] = useState(() => initialDate || getLocalDateKey());
  const [hasExistingRecord, setHasExistingRecord] = useState(false);
  const [existingRecordId, setExistingRecordId] = useState<string | null>(entryId || null);
  const [activeSlot, setActiveSlot] = useState<SlotKey>("morning");
  const [inputMode, setInputMode] = useState<"wheel" | "keypad">("wheel");
  const [collectionStatus, setCollectionStatus] = useState<DailyStatus>("EMPTY");
  const [revision, setRevision] = useState<number>(1);

  const isSubmittingRef = useRef(false);
  const stableCreateIdRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const modifiedSlotsRef = useRef<Set<SlotKey>>(new Set());

  const [doses, setDoses] = useState<Record<SlotKey, number | null>>({
    morning: null,
    lunch: null,
    afternoon: null,
    evening: null,
    night: null,
  });

  const todayKey = getLocalDateKey();

  const handleDateChange = (newDate: string) => {
    if (newDate === entryDate) return;
    setEntryDate(newDate);
    setExistingRecordId(null);
    setHasExistingRecord(false);
    setCollectionStatus("EMPTY");
    setRevision(1);
    stableCreateIdRef.current = null;
    idempotencyKeyRef.current = null;
    modifiedSlotsRef.current.clear();
  };

  useEffect(() => {
    if (open) {
      const initial = initialDate || getLocalDateKey();
      setEntryDate(initial);
      setExistingRecordId(entryId || null);
      setHasExistingRecord(Boolean(entryId));
      isSubmittingRef.current = false;
      stableCreateIdRef.current = null;
      idempotencyKeyRef.current = null;
      modifiedSlotsRef.current.clear();
    } else {
      isSubmittingRef.current = false;
      stableCreateIdRef.current = null;
      idempotencyKeyRef.current = null;
      setExistingRecordId(null);
      setHasExistingRecord(false);
      modifiedSlotsRef.current.clear();
    }
  }, [open, initialDate, entryId]);

  // Load existing data when opening or when entryDate changes
  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !open || !entryDate) return;

      const dateOnly = entryDate.split("T")[0];

      // 1. Check in-memory dialog cache for previously loaded/saved records
      if (dateCacheRef.current.has(dateOnly)) {
        const cached = dateCacheRef.current.get(dateOnly);
        if (cached && active) {
          setHasExistingRecord(true);
          if (cached.id) setExistingRecordId(cached.id);
          const rec = {
            morning: cached.morning ?? null,
            lunch: cached.lunch ?? null,
            afternoon: cached.afternoon ?? null,
            evening: cached.evening ?? null,
            night: cached.night ?? null,
          };
          setDoses(rec);
          setShowAfternoon(Boolean(rec.afternoon !== null && Number(rec.afternoon) > 0));
          setCollectionStatus(evaluateDailyStatus(rec, Boolean(rec.afternoon && Number(rec.afternoon) > 0)));
          return;
        }
      }

      // 2. Fast check in HealthDataContext (in-memory instant lookup, <1ms)
      const contextMatch = cachedInsulinList.find(
        (i) => i.entry_date?.split("T")[0] === dateOnly || (entryId && i.id === entryId)
      );
      if (contextMatch && active) {
        setHasExistingRecord(true);
        if (contextMatch.id) setExistingRecordId(contextMatch.id);
        const rec = {
          morning: contextMatch.morning ?? null,
          lunch: contextMatch.lunch ?? null,
          afternoon: contextMatch.afternoon ?? null,
          evening: contextMatch.evening ?? null,
          night: contextMatch.night ?? null,
        };
        dateCacheRef.current.set(dateOnly, { ...rec, id: contextMatch.id });
        setDoses(rec);
        setShowAfternoon(Boolean(rec.afternoon !== null && Number(rec.afternoon) > 0));
        setCollectionStatus(evaluateDailyStatus(rec, Boolean(rec.afternoon && Number(rec.afternoon) > 0)));
        return;
      }

      // 3. Authoritative query from insulinService (checks local SQLite first, then remote with timeout)
      try {
        const res = await insulinService.fetchDailyRecord(dateOnly);
        if (active) {
          if (res.data) {
            const data = res.data;
            const record = {
              id: data.id,
              morning: data.morning ?? null,
              lunch: data.lunch ?? null,
              afternoon: data.afternoon ?? null,
              evening: data.evening ?? null,
              night: data.night ?? null,
            };
            dateCacheRef.current.set(dateOnly, record);
            setHasExistingRecord(true);
            setExistingRecordId(data.id);
            setDoses(record);
            setShowAfternoon(Boolean(record.afternoon !== null && Number(record.afternoon) > 0));
            setCollectionStatus(evaluateDailyStatus(record, Boolean(record.afternoon && Number(record.afternoon) > 0)));
          } else {
            // New schedule for date
            setHasExistingRecord(false);
            setExistingRecordId(null);
            setDoses({
              morning: null,
              lunch: null,
              afternoon: null,
              evening: null,
              night: null,
            });
            setShowAfternoon(false);
            setCollectionStatus("EMPTY");
          }
        }
      } catch (err) {
        console.warn("[InsulinDialog] Error loading entry:", err);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [entryDate, entryId, user, open]);

  const updateDose = (slot: SlotKey, value: number | null) => {
    const norm = value === null ? null : (Number.isFinite(value) ? Math.max(0, Math.min(200, Math.round((value + Number.EPSILON) * 100) / 100)) : 0);
    modifiedSlotsRef.current.add(slot);
    setDoses((prev) => {
      const nextDoses = {
        ...prev,
        [slot]: norm,
      };
      const nextStatus = evaluateDailyStatus(
        nextDoses,
        showAfternoon || slot === "afternoon"
      );
      setCollectionStatus(nextStatus);
      return nextDoses;
    });
  };

  const rawTotal =
    (Number(doses.morning) || 0) +
    (Number(doses.lunch) || 0) +
    (showAfternoon ? Number(doses.afternoon) || 0 : 0) +
    (Number(doses.evening) || 0) +
    (Number(doses.night) || 0);
  const total = Math.round((rawTotal + Number.EPSILON) * 100) / 100;

  const formatted = showAfternoon
    ? `${doses.morning ?? "-"}-${doses.lunch ?? "-"}-${doses.afternoon ?? "-"}-${doses.evening ?? "-"}-${doses.night ?? "-"}`
    : `${doses.morning ?? "-"}-${doses.lunch ?? "-"}-${doses.evening ?? "-"}-${doses.night ?? "-"}`;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Concurrency double-click guard
    if (isSubmittingRef.current) {
      console.warn("[INSULIN_DIALOG] Duplicate submit blocked by submission guard.");
      return;
    }
    isSubmittingRef.current = true;

    const dateOnly = entryDate.split("T")[0];

    // 1. Capture original record state for rollback if background persistence fails
    const originalRecord =
      cachedInsulinList.find(
        (item) => item.id === existingRecordId || item.entry_date?.split("T")[0] === dateOnly,
      ) || null;

    if (modifiedSlotsRef.current.size === 0) {
      modifiedSlotsRef.current.add(activeSlot);
    }

    const isUuid = (val?: string | null) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    const validRecordId = isUuid(existingRecordId)
      ? existingRecordId!
      : isUuid(stableCreateIdRef.current)
      ? stableCreateIdRef.current!
      : typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : undefined;

    const targetRecordId = validRecordId || (existingRecordId || `uuid_${dateOnly}`);

    const optimisticRecord: InsulinEntry = {
      id: targetRecordId,
      user_id: user.id,
      entry_date: dateOnly,
      morning: doses.morning ?? 0,
      lunch: doses.lunch ?? 0,
      afternoon: showAfternoon ? (doses.afternoon ?? 0) : 0,
      evening: doses.evening ?? 0,
      night: doses.night ?? 0,
      notes: null,
      sync_status: "pending_sync",
    };

    // 2. Instant Optimistic UI Update (<16ms)
    optimisticAddOrUpdateInsulin(optimisticRecord);
    dateCacheRef.current.set(dateOnly, optimisticRecord);

    // 3. Immediately close modal and notify user
    toast.success(getSuccessMessage("insulin_saved"));
    onOpenChange(false);
    onSaved?.();

    // Reset component state cleanly for next opening
    setExistingRecordId(null);
    setHasExistingRecord(false);
    stableCreateIdRef.current = null;
    idempotencyKeyRef.current = null;
    modifiedSlotsRef.current.clear();
    isSubmittingRef.current = false;

    // 4. Asynchronous Background Persistence via authoritative InsulinService
    const targetIdentifier = isUuid(existingRecordId) ? existingRecordId! : dateOnly;
    const payload = {
      entry_date: dateOnly,
      morning: doses.morning ?? null,
      lunch: doses.lunch ?? null,
      afternoon: showAfternoon ? (doses.afternoon ?? null) : null,
      evening: doses.evening ?? null,
      night: doses.night ?? null,
      notes: null,
      ...(isUuid(existingRecordId) ? { id: existingRecordId! } : {}),
    };

    const savePromise = insulinService.updateDailyRecord(targetIdentifier, payload);

    savePromise
      .then((res) => {
        if (res.error || !res.data) throw new Error(res.error || "Save failed");
        const savedEntry: InsulinEntry = {
          id: res.data.id,
          user_id: res.data.user_id,
          entry_date: res.data.entry_date,
          morning: res.data.morning ?? 0,
          lunch: res.data.lunch ?? 0,
          afternoon: res.data.afternoon ?? 0,
          evening: res.data.evening ?? 0,
          night: res.data.night ?? 0,
          notes: res.data.notes,
        };
        optimisticAddOrUpdateInsulin(savedEntry);
        dateCacheRef.current.set(dateOnly, savedEntry);
      })
      .catch((err) => {
        console.error("[INSULIN_DIALOG] Failed to persist insulin doses:", err);
        rollbackOptimisticInsulin(originalRecord, dateOnly);
        logDiagnostic("insulin-dialog:background-save", err);
        toast.error(getUserFriendlyError(err, "insulin") || "Failed to persist insulin doses. Changes rolled back.");
      });
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
              <div className="flex items-center gap-1.5">
                <DialogTitle className="text-sm sm:text-base font-bold font-display text-foreground leading-tight">
                  {hasExistingRecord ? "Update Insulin Doses" : "Insulin Schedule"}
                </DialogTitle>
                {entryDate === todayKey && (
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none uppercase tracking-wide",
                      collectionStatus === "COMPLETE"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        : collectionStatus === "PARTIAL"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {collectionStatus} • R{revision}
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight line-clamp-1">
                {hasExistingRecord
                  ? `Editing doses for ${formatLocalDate(entryDate, "MMM d, yyyy")}`
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
                {entryDate !== todayKey && (
                  <button
                    type="button"
                    onClick={() => handleDateChange(todayKey)}
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
                  const prev = subDaysLocal(entryDate, 1);
                  handleDateChange(prev);
                }}
                title="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <Input
                id="entry_date"
                type="date"
                max={todayKey}
                value={entryDate}
                onChange={(e) => {
                  if (e.target.value) handleDateChange(e.target.value);
                }}
                className="h-10 text-sm font-bold rounded-xl bg-background border-border/80 text-center shadow-xs cursor-pointer hover:border-primary/50 transition-colors flex-1"
              />

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl border-border/80 bg-background hover:bg-muted active:scale-95 shadow-xs transition-all disabled:opacity-25"
                disabled={entryDate >= todayKey}
                onClick={() => {
                  const next = addDaysLocal(entryDate, 1);
                  handleDateChange(next);
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
                  const doseVal = doses[slot.id];

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
                        {doseVal !== null && doseVal !== undefined ? `${doseVal}u` : "--"}
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
                    {doses[activeSlot] !== null && doses[activeSlot] !== undefined
                      ? `${doses[activeSlot]} units`
                      : "Not recorded"}
                  </span>
                </div>

                {activeSlot === "afternoon" && showAfternoon && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAfternoon(false);
                      updateDose("afternoon", null);
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
                  key={activeSlot}
                  value={doses[activeSlot] ?? 0}
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
                            updateDose("afternoon", null);
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
                      inputMode="decimal"
                      min="0"
                      max="200"
                      step="0.1"
                      value={doses[slot.id] ?? ""}
                      placeholder="-- units"
                      onChange={(e) =>
                        updateDose(
                          slot.id,
                          e.target.value === "" ? null : parseFloat(e.target.value) || 0
                        )
                      }
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
              disabled={saving}
              className="flex-1 rounded-xl text-xs h-9 border-border/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hasExistingRecord ? (
                "Update Doses"
              ) : (
                "Save Schedule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
