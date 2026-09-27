import React, { useState, useEffect } from "react";
import { Droplet, Clock, X, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { cn } from "@/frontend/lib/utils";
import { InsulinDoseWheel } from "./InsulinDoseWheel";
import { InsulinSlotSelector } from "./InsulinSlotSelector";
import type { PendingDoseSlot, ScheduledSlotSummary } from "../types";
import { MAX_NOTES_LENGTH } from "../services/insulinValidationService";

interface PendingInsulinModalProps {
  open: boolean;
  currentSlot: PendingDoseSlot | null;
  allSlots: ScheduledSlotSummary[];
  totalPendingCount: number;
  currentPendingIndex: number;
  onClose: () => void;
  onSaveDose: (slot: PendingDoseSlot, units: number, notes?: string) => Promise<boolean>;
  onSelectSlot: (slot: PendingDoseSlot) => void;
}

export function PendingInsulinModal({
  open,
  currentSlot,
  allSlots,
  totalPendingCount,
  currentPendingIndex,
  onClose,
  onSaveDose,
  onSelectSlot,
}: PendingInsulinModalProps) {
  const [doseUnits, setDoseUnits] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"wheel" | "slot-selector">("wheel");

  // Reset dose & notes when active slot changes
  useEffect(() => {
    if (currentSlot) {
      setDoseUnits(0);
      setNotes("");
      setViewMode("wheel");
    }
  }, [currentSlot?.id]);

  if (!open || !currentSlot) {
    return null;
  }

  const isDoseValid = doseUnits > 0 && doseUnits <= 50;

  const handleSave = async () => {
    if (!isDoseValid || isSaving) return;
    setIsSaving(true);
    try {
      const success = await onSaveDose(currentSlot, doseUnits, notes);
      if (success) {
        // Reset for next dose if any
        setDoseUnits(0);
        setNotes("");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* 1. Dark Transparent Background Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!isSaving) onClose();
        }}
        aria-hidden="true"
      />

      {/* 2. Centered Responsive Modal with Rounded Corners */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-sm sm:max-w-md bg-card text-card-foreground border border-border/80 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] transition-all"
      >
        {/* 3. Modal Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            {/* Blue GlucoLab droplet icon */}
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              <Droplet className="h-5 w-5 fill-primary text-primary" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-title" className="font-display text-base sm:text-lg font-bold text-foreground">
                  Smart Insulin Dose
                </h2>
                {totalPendingCount > 1 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {currentPendingIndex + 1} of {totalPendingCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {viewMode === "slot-selector"
                  ? "Choose which pending slot to record"
                  : "Rotate the wheel to select your prescribed dose"}
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 pt-3 overflow-y-auto space-y-4">
          {viewMode === "slot-selector" ? (
            <InsulinSlotSelector
              slots={allSlots}
              selectedSlotId={currentSlot.id}
              onSelectSlot={(selected) => {
                onSelectSlot(selected);
                setViewMode("wheel");
              }}
              onBack={() => setViewMode("wheel")}
            />
          ) : (
            <>
              {/* 4. Selected Pending Slot Card */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      <AlertCircle className="h-3 w-3" />
                      Pending Dose
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode("slot-selector")}
                    className="h-7 text-xs font-semibold px-2.5 rounded-xl border-border/80 hover:bg-primary/5 hover:border-primary/40 text-primary"
                  >
                    Change Slot
                  </Button>
                </div>

                <div className="flex items-baseline justify-between pt-0.5">
                  <div>
                    <div className="text-sm font-bold text-foreground">
                      {currentSlot.displayDate} · {currentSlot.slotName}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{currentSlot.displayTime}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Medical Disclaimer Banner */}
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20 text-blue-900 dark:text-blue-100">
                <ShieldAlert className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground font-semibold">Medical Disclaimer:</strong> Always follow your healthcare provider&apos;s prescribed insulin regimen. GlucoLab never calculates or recommends insulin dosages.
                </p>
              </div>

              {/* 5. Circular Dose Wheel & 6. Quick Select Buttons */}
              <div className="py-1">
                <InsulinDoseWheel
                  value={doseUnits}
                  onChange={setDoseUnits}
                  min={0}
                  max={50}
                  disabled={isSaving}
                />
              </div>

              {/* 7. Optional Notes Input */}
              <div className="space-y-1">
                <div className="relative">
                  <Input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
                    placeholder="Add a note (optional)"
                    maxLength={MAX_NOTES_LENGTH}
                    disabled={isSaving}
                    className="text-xs h-9 rounded-xl pr-12 bg-background border-border/80 placeholder:text-muted-foreground/60"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/70 pointer-events-none">
                    {notes.length}/{MAX_NOTES_LENGTH}
                  </span>
                </div>
              </div>

              {/* 8. Primary Save Dose Button */}
              <Button
                type="button"
                onClick={handleSave}
                disabled={!isDoseValid || isSaving}
                className={cn(
                  "w-full h-11 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-md",
                  isDoseValid
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg"
                    : "opacity-50 cursor-not-allowed",
                )}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving Dose...</span>
                  </span>
                ) : (
                  <span>Save Dose ({doseUnits} {doseUnits === 1 ? "unit" : "units"})</span>
                )}
              </Button>

              {/* 9. Footer Note */}
              <div className="text-center pt-0.5">
                <p className="text-[11px] text-muted-foreground font-medium">
                  Logged for {currentSlot.displayTime} ({currentSlot.displayDate}) • 7-day lookback active
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
