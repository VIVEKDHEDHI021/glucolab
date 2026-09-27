import type { DoseValidationResult, PendingDoseSlot } from "../types";

export const MAX_SAFE_INSULIN_UNITS = 200;
export const MAX_WHEEL_UNITS = 50;
export const MAX_NOTES_LENGTH = 100;

export const insulinValidationService = {
  /**
   * Validate dose amount
   */
  validateUnits(units: number | undefined | null): DoseValidationResult {
    if (units === undefined || units === null || isNaN(units)) {
      return { isValid: false, error: "Please enter a valid insulin dose amount." };
    }

    if (units <= 0) {
      return { isValid: false, error: "Insulin dose must be greater than 0 units." };
    }

    if (units > MAX_SAFE_INSULIN_UNITS) {
      return {
        isValid: false,
        error: `Insulin dose cannot exceed safe limit of ${MAX_SAFE_INSULIN_UNITS} units.`,
      };
    }

    return { isValid: true };
  },

  /**
   * Validate optional note
   */
  validateNotes(notes?: string | null): DoseValidationResult {
    if (!notes) return { isValid: true };

    if (notes.length > MAX_NOTES_LENGTH) {
      return {
        isValid: false,
        error: `Notes cannot exceed ${MAX_NOTES_LENGTH} characters (currently ${notes.length}).`,
      };
    }

    return { isValid: true };
  },

  /**
   * Validate slot is not in future (with clock skew tolerance)
   */
  validateSlotNotFuture(slot: PendingDoseSlot, now: Date = new Date()): DoseValidationResult {
    if (!slot) return { isValid: true };
    try {
      const dateObj =
        slot.scheduledDateTime instanceof Date
          ? slot.scheduledDateTime
          : slot.scheduledDateTime
          ? new Date(slot.scheduledDateTime)
          : null;

      if (dateObj && !isNaN(dateObj.getTime())) {
        // Allow a 5-minute clock skew tolerance
        if (dateObj.getTime() > now.getTime() + 5 * 60 * 1000) {
          return {
            isValid: false,
            error: `Cannot record dose for future scheduled slot (${slot.displayTime || slot.time}).`,
          };
        }
      }
    } catch {
      // In case of any date parsing discrepancy, proceed safely
    }

    return { isValid: true };
  },

  /**
   * Validate full save payload
   */
  validateSavePayload(
    units: number,
    slot: PendingDoseSlot,
    notes?: string,
    now: Date = new Date(),
  ): DoseValidationResult {
    const unitsCheck = this.validateUnits(units);
    if (!unitsCheck.isValid) return unitsCheck;

    const notesCheck = this.validateNotes(notes);
    if (!notesCheck.isValid) return notesCheck;

    const slotCheck = this.validateSlotNotFuture(slot, now);
    if (!slotCheck.isValid) return slotCheck;

    return { isValid: true };
  },
};
