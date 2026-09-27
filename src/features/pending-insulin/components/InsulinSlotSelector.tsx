import React from "react";
import { ArrowLeft, Check, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import type { ScheduledSlotSummary, PendingDoseSlot } from "../types";

interface InsulinSlotSelectorProps {
  slots: ScheduledSlotSummary[];
  selectedSlotId: string;
  onSelectSlot: (slot: PendingDoseSlot) => void;
  onBack: () => void;
}

export function InsulinSlotSelector({
  slots,
  selectedSlotId,
  onSelectSlot,
  onBack,
}: InsulinSlotSelectorProps) {
  // Group slots by date for organized display
  const groupedSlots = React.useMemo(() => {
    const groups: { [dateStr: string]: { displayDate: string; items: ScheduledSlotSummary[] } } = {};
    for (const slot of slots) {
      if (!groups[slot.date]) {
        groups[slot.date] = {
          displayDate: slot.displayDate,
          items: [],
        };
      }
      groups[slot.date].items.push(slot);
    }
    return Object.values(groups);
  }, [slots]);

  return (
    <div className="flex flex-col h-full max-h-[380px] space-y-3">
      {/* Selector Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <span className="text-sm font-bold text-foreground font-display">Select Insulin Slot</span>
        <div className="w-10" />
      </div>

      {/* Slots List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {groupedSlots.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No scheduled insulin slots found.
          </div>
        ) : (
          groupedSlots.map((group) => (
            <div key={group.displayDate} className="space-y-1.5">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                {group.displayDate}
              </div>

              <div className="space-y-1.5">
                {group.items.map((slot) => {
                  const isSelected = slot.id === selectedSlotId;
                  const isPending = slot.status === "pending";
                  const isUpcoming = slot.status === "upcoming";
                  const isCompleted = slot.status === "completed";

                  return (
                    <div
                      key={slot.id}
                      onClick={() => {
                        if (isPending) {
                          onSelectSlot(slot);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-2xl border transition-all select-none",
                        isPending
                          ? isSelected
                            ? "border-primary bg-primary/5 shadow-xs cursor-pointer"
                            : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                          : isCompleted
                          ? "border-border/40 bg-muted/20 opacity-75 cursor-not-allowed"
                          : "border-border/30 bg-muted/10 opacity-60 cursor-not-allowed",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center text-sm font-semibold",
                            isPending
                              ? isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary"
                              : isCompleted
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <span>{slot.slotName}</span>
                            <span className="text-muted-foreground font-normal">• {slot.displayTime}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {group.displayDate}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                            <AlertCircle className="h-3 w-3" />
                            Pending
                          </span>
                        ) : isUpcoming ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                            <Clock className="h-3 w-3" />
                            Upcoming
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Logged {slot.recordedUnits ? `(${slot.recordedUnits}u)` : ""}
                          </span>
                        )}

                        {isSelected && isPending && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white ml-1">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
