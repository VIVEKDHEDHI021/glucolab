import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/frontend/lib/auth-context";
import { pendingDoseService } from "../services/pendingDoseService";
import { PendingInsulinModal } from "./PendingInsulinModal";
import type { PendingDoseSlot, ScheduledSlotSummary } from "../types";

const SESSION_DISMISSED_KEY = "glucolab_pending_insulin_dismissed_session";

export function PendingInsulinManager() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingSlots, setPendingSlots] = useState<PendingDoseSlot[]>([]);
  const [allSlots, setAllSlots] = useState<ScheduledSlotSummary[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const checkPendingDoses = useCallback(
    async (forceOpen: boolean = false) => {
      if (!user) {
        setOpen(false);
        setPendingSlots([]);
        return;
      }

      try {
        const [pending, all] = await Promise.all([
          pendingDoseService.getPendingDoses(user.id),
          pendingDoseService.getAllScheduledSlotsForWindow(user.id),
        ]);

        setPendingSlots(pending);
        setAllSlots(all);

        if (pending.length > 0) {
          setCurrentIndex(0);

          // Check if user dismissed during this session
          const isDismissedThisSession =
            typeof window !== "undefined" &&
            window.sessionStorage.getItem(`${SESSION_DISMISSED_KEY}_${user.id}`) === "true";

          if (forceOpen || !isDismissedThisSession) {
            setOpen(true);
          }
        } else {
          setOpen(false);
        }
      } catch (err) {
        console.warn("[PendingInsulinManager] Error evaluating pending doses:", err);
      }
    },
    [user],
  );

  // Initial check on app startup when user is authenticated
  useEffect(() => {
    checkPendingDoses(false);

    const handleManualOpen = () => {
      checkPendingDoses(true);
    };

    const handleHealthUpdated = () => {
      // Re-evaluate pending status quietly in background
      checkPendingDoses(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkPendingDoses(false);
      }
    };

    // Periodic check every 60s for midnight crossings or new pending slots
    const intervalId = setInterval(() => {
      checkPendingDoses(false);
    }, 60000);

    window.addEventListener("open-pending-insulin-modal", handleManualOpen);
    window.addEventListener("health-data-updated", handleHealthUpdated);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("open-pending-insulin-modal", handleManualOpen);
      window.removeEventListener("health-data-updated", handleHealthUpdated);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkPendingDoses]);

  // Handle Save Dose
  const handleSaveDose = async (slot: PendingDoseSlot, units: number, notes?: string): Promise<boolean> => {
    if (!user) return false;

    const res = await pendingDoseService.saveDose(user.id, slot, units, notes);
    if (!res.success) {
      toast.error(res.error || "Failed to save insulin dose.");
      return false;
    }

    toast.success(`Logged ${units} ${units === 1 ? "unit" : "units"} for ${slot.slotName} (${slot.displayDate})`);

    // Re-check remaining pending doses
    try {
      const [freshPending, freshAll] = await Promise.all([
        pendingDoseService.getPendingDoses(user.id),
        pendingDoseService.getAllScheduledSlotsForWindow(user.id),
      ]);

      setAllSlots(freshAll);
      setPendingSlots(freshPending);

      if (freshPending.length > 0) {
        // Advance automatically to the next oldest pending slot
        setCurrentIndex(0);
        const next = freshPending[0];
        toast.info(`Next up: ${next.slotName} (${next.displayDate})`);
      } else {
        // All completed!
        setOpen(false);
        toast.success("All scheduled insulin doses are logged! 🎉");
      }
      return true;
    } catch {
      setOpen(false);
      return true;
    }
  };

  // Handle Close / Skip
  const handleClose = () => {
    if (user && typeof window !== "undefined") {
      // Do not repeatedly show during this session
      window.sessionStorage.setItem(`${SESSION_DISMISSED_KEY}_${user.id}`, "true");
    }
    setOpen(false);
  };

  // Handle Slot Selection from switcher
  const handleSelectSlot = (selected: PendingDoseSlot) => {
    const idx = pendingSlots.findIndex((s) => s.id === selected.id);
    if (idx !== -1) {
      setCurrentIndex(idx);
    } else {
      // Slot was not in currently loaded pending array, prepend it
      setPendingSlots((prev) => [selected, ...prev]);
      setCurrentIndex(0);
    }
  };

  const currentSlot = pendingSlots[currentIndex] || null;

  return (
    <PendingInsulinModal
      open={open}
      currentSlot={currentSlot}
      allSlots={allSlots}
      totalPendingCount={pendingSlots.length}
      currentPendingIndex={currentIndex}
      onClose={handleClose}
      onSaveDose={handleSaveDose}
      onSelectSlot={handleSelectSlot}
    />
  );
}
