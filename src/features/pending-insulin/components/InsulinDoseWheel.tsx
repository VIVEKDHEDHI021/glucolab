import React, { useRef, useState, useEffect, useCallback } from "react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { ChevronUp, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { Button } from "@/frontend/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/frontend/components/ui/dialog";

export interface InsulinDoseWheelProps {
  /** Controlled value (whole-number integer) */
  value?: number;
  /** Callback fired when the wheel selects a new integer */
  onChange?: (val: number) => void;

  /** Initial value when used in uncontrolled / modal mode */
  initialValue?: number;

  /** Minimum selectable integer (default: 0) */
  min?: number;
  minValue?: number;

  /** Maximum selectable integer (default: 50) */
  max?: number;
  maxValue?: number;

  /** Whether the wheel is disabled */
  disabled?: boolean;

  /** Modal mode: controls visibility if used as a standalone dialog */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Callback when user confirms selection */
  onConfirm?: (val: number) => void;

  /** Callback when user cancels/dismisses */
  onCancel?: () => void;

  /** Title displayed in modal or header (default: "Select Insulin Dose") */
  title?: string;

  /** Description/subtitle text (default: "Select the number of insulin units you recorded.") */
  description?: string;

  /** Label for units (default: "Units") */
  unitLabel?: string;

  /** Singular unit label (default: "Unit") */
  unitSingular?: string;

  /** Custom text for confirm button (e.g. "Confirm 5 Units") */
  confirmButtonText?: string;

  /** Whether to render confirm button in inline mode */
  showConfirmButton?: boolean;

  /** Whether to show quick-select preset chips (default: true) */
  showQuickPills?: boolean;

  /** Custom quick preset integers */
  quickPresets?: number[];

  /** Additional container CSS classes */
  className?: string;

  /** Height of the wheel container in pixels (default: 220) */
  size?: number;
  height?: number;

  /** Legacy prop for backward compatibility */
  sensitivity?: number;
}

const ITEM_HEIGHT = 44; // standard touch-target row height
const VISIBLE_ITEMS = 5;
const DEFAULT_HEIGHT = 220; // 5 * 44px
const DEFAULT_QUICK_PRESETS = [0, 2, 4, 6, 8, 10, 12, 16, 20];

export function InsulinDoseWheel({
  value,
  onChange,
  initialValue,
  min,
  minValue,
  max,
  maxValue,
  disabled = false,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  title = "Select Insulin Dose",
  description = "Select the number of insulin units you recorded.",
  unitLabel = "Units",
  unitSingular = "Unit",
  confirmButtonText,
  showConfirmButton = false,
  showQuickPills = true,
  quickPresets = DEFAULT_QUICK_PRESETS,
  className,
  size,
  height,
}: InsulinDoseWheelProps) {
  // Resolve effective bounds (strictly integer)
  const effectiveMin = Math.max(0, Math.round(minValue ?? min ?? 0));
  const effectiveMax = Math.max(effectiveMin, Math.round(maxValue ?? max ?? 50));
  const effectiveHeight = height ?? (size && size > 100 ? size : DEFAULT_HEIGHT);
  const spacerHeight = Math.max(0, Math.round((effectiveHeight - ITEM_HEIGHT) / 2));

  // Determine initial selected integer
  const resolveInitial = useCallback((): number => {
    const candidate = value ?? initialValue ?? effectiveMin;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(effectiveMin, Math.min(effectiveMax, Math.round(candidate)));
    }
    return effectiveMin;
  }, [value, initialValue, effectiveMin, effectiveMax]);

  const [selectedVal, setSelectedVal] = useState<number>(resolveInitial);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScrollRef = useRef(false);
  const isInitialMountRef = useRef(true);
  const scrollDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHapticValRef = useRef<number>(selectedVal);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Build array of valid consecutive whole-number integers
  const items = React.useMemo(() => {
    const list: number[] = [];
    for (let i = effectiveMin; i <= effectiveMax; i++) {
      list.push(i);
    }
    return list;
  }, [effectiveMin, effectiveMax]);

  const triggerHaptic = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  }, []);

  // Programmatic scroll helper
  const scrollToValue = useCallback(
    (targetVal: number, smooth = true) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const clamped = Math.max(effectiveMin, Math.min(effectiveMax, Math.round(targetVal)));
      const targetScroll = (clamped - effectiveMin) * ITEM_HEIGHT;

      isProgrammaticScrollRef.current = true;
      if (smooth) {
        container.scrollTo({ top: targetScroll, behavior: "smooth" });
      } else {
        container.scrollTop = targetScroll;
      }

      // Clear programmatic flag shortly after
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, smooth ? 400 : 30);
    },
    [effectiveMin, effectiveMax],
  );

  // Sync with external controlled value
  useEffect(() => {
    if (value !== undefined && Number.isFinite(value)) {
      const clamped = Math.max(effectiveMin, Math.min(effectiveMax, Math.round(value)));
      if (clamped !== selectedVal) {
        setSelectedVal(clamped);
        scrollToValue(clamped, false); // Instant scroll when syncing from parent to avoid scroll event corruption
      }
    }
  }, [value, effectiveMin, effectiveMax, selectedVal, scrollToValue]);

  // Initial mount scroll
  useEffect(() => {
    const initial = resolveInitial();
    setSelectedVal(initial);
    // Instant scroll on mount to avoid visual animation jump
    const timer = setTimeout(() => {
      scrollToValue(initial, false);
      isInitialMountRef.current = false;
    }, 10);
    return () => clearTimeout(timer);
  }, [resolveInitial, scrollToValue]);

  // Handle scroll events with snapping & bounds checks
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedVal = Math.max(effectiveMin, Math.min(effectiveMax, effectiveMin + rawIndex));

    if (clampedVal !== selectedVal) {
      setSelectedVal(clampedVal);
      if (!isProgrammaticScrollRef.current) {
        onChangeRef.current?.(clampedVal);
        if (lastHapticValRef.current !== clampedVal) {
          lastHapticValRef.current = clampedVal;
          triggerHaptic();
        }
      }
    }

    // Debounced check to finalize clean snap on scroll end
    if (scrollDebounceTimerRef.current) {
      clearTimeout(scrollDebounceTimerRef.current);
    }
    scrollDebounceTimerRef.current = setTimeout(() => {
      if (!isProgrammaticScrollRef.current && container) {
        const finalTop = (clampedVal - effectiveMin) * ITEM_HEIGHT;
        if (Math.abs(container.scrollTop - finalTop) > 1) {
          container.scrollTo({ top: finalTop, behavior: "smooth" });
        }
      }
    }, 120);
  }, [effectiveMin, effectiveMax, selectedVal, triggerHaptic]);

  // Handle direct item click
  const handleItemClick = useCallback(
    (itemVal: number) => {
      if (disabled) return;
      setSelectedVal(itemVal);
      onChangeRef.current?.(itemVal);
      scrollToValue(itemVal, true);
      triggerHaptic();
    },
    [disabled, scrollToValue, triggerHaptic],
  );

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let nextVal = selectedVal;

    switch (e.key) {
      case "ArrowUp":
      case "ArrowLeft":
        nextVal = Math.max(effectiveMin, selectedVal - 1);
        e.preventDefault();
        break;
      case "ArrowDown":
      case "ArrowRight":
        nextVal = Math.min(effectiveMax, selectedVal + 1);
        e.preventDefault();
        break;
      case "PageUp":
        nextVal = Math.max(effectiveMin, selectedVal - 5);
        e.preventDefault();
        break;
      case "PageDown":
        nextVal = Math.min(effectiveMax, selectedVal + 5);
        e.preventDefault();
        break;
      case "Home":
        nextVal = effectiveMin;
        e.preventDefault();
        break;
      case "End":
        nextVal = effectiveMax;
        e.preventDefault();
        break;
      case "Enter":
      case " ":
        if (onConfirm) {
          onConfirm(selectedVal);
          e.preventDefault();
        }
        return;
      default:
        return;
    }

    if (nextVal !== selectedVal) {
      handleItemClick(nextVal);
    }
  };

  // Confirmation & Cancel handlers
  const handleConfirm = () => {
    onConfirm?.(selectedVal);
    onOpenChange?.(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange?.(false);
  };

  // Render the core vertical wheel component
  const renderWheelCore = () => (
    <div
      className={cn(
        "relative w-full max-w-[280px] mx-auto bg-card rounded-2xl border border-border/70 p-2 shadow-xs select-none flex flex-col items-center",
        className,
      )}
    >
      {/* Top subtle nudge control */}
      <button
        type="button"
        onClick={() => handleItemClick(Math.max(effectiveMin, selectedVal - 1))}
        disabled={disabled || selectedVal <= effectiveMin}
        className="w-full py-0.5 flex items-center justify-center text-muted-foreground/60 hover:text-primary active:scale-90 disabled:opacity-20 transition-all cursor-pointer"
        aria-label="Decrease dose by 1 unit"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Main Wheel Viewport */}
      <div className="relative w-full overflow-hidden" style={{ height: effectiveHeight }}>
        {/* iOS Selection Lens: Center highlighted bar with subtle primary tint */}
        <div
          className="absolute inset-x-2 rounded-xl bg-primary/10 dark:bg-primary/20 border-y border-primary/25 pointer-events-none flex items-center justify-between px-3 transition-colors z-0"
          style={{
            top: spacerHeight,
            height: ITEM_HEIGHT,
          }}
          aria-hidden="true"
        >
          <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider">
            Dose
          </span>
          <span className="text-xs font-black text-primary tracking-wide uppercase">
            {selectedVal === 1 ? unitSingular : unitLabel}
          </span>
        </div>

        {/* Top iOS Cylindrical Fade Mask */}
        <div
          className="absolute inset-x-0 top-0 pointer-events-none z-10 bg-gradient-to-b from-card via-card/75 to-transparent"
          style={{ height: spacerHeight }}
          aria-hidden="true"
        />

        {/* Bottom iOS Cylindrical Fade Mask */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none z-10 bg-gradient-to-t from-card via-card/75 to-transparent"
          style={{ height: spacerHeight }}
          aria-hidden="true"
        />

        {/* Scrollable Container with Native CSS Snap */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
          role="spinbutton"
          aria-label="Insulin dose in units"
          aria-valuenow={selectedVal}
          aria-valuemin={effectiveMin}
          aria-valuemax={effectiveMax}
          aria-valuetext={`${selectedVal} ${selectedVal === 1 ? unitSingular : unitLabel}`}
          className={cn(
            "relative w-full h-full overflow-y-auto snap-y snap-mandatory overscroll-contain select-none focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl",
            disabled && "opacity-50 pointer-events-none",
          )}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-y",
          }}
        >
          {/* Top Spacer allowing item 0 to align in exact center */}
          <div style={{ height: spacerHeight }} aria-hidden="true" />

          {/* Number Items (Integers only) */}
          {items.map((num) => {
            const dist = Math.abs(num - selectedVal);
            const isSelected = num === selectedVal;

            return (
              <div
                key={num}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleItemClick(num)}
                className={cn(
                  "h-[44px] flex items-center justify-center snap-center cursor-pointer select-none transition-all duration-150 z-5",
                  isSelected
                    ? "text-3xl sm:text-4xl font-extrabold text-foreground scale-110 drop-shadow-xs"
                    : dist === 1
                      ? "text-xl sm:text-2xl font-bold text-muted-foreground/75 scale-95"
                      : dist === 2
                        ? "text-base sm:text-lg font-medium text-muted-foreground/45 scale-85"
                        : "text-sm font-normal text-muted-foreground/20 scale-75",
                )}
              >
                <span className="tabular-nums leading-none tracking-tight">
                  {num}
                </span>
              </div>
            );
          })}

          {/* Bottom Spacer allowing max item to align in exact center */}
          <div style={{ height: spacerHeight }} aria-hidden="true" />
        </div>
      </div>

      {/* Bottom subtle nudge control */}
      <button
        type="button"
        onClick={() => handleItemClick(Math.min(effectiveMax, selectedVal + 1))}
        disabled={disabled || selectedVal >= effectiveMax}
        className="w-full py-0.5 flex items-center justify-center text-muted-foreground/60 hover:text-primary active:scale-90 disabled:opacity-20 transition-all cursor-pointer"
        aria-label="Increase dose by 1 unit"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* Quick Select Preset Pills */}
      {showQuickPills && (
        <div className="w-full pt-1.5 border-t border-border/50 mt-1">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              Quick Select
            </span>
            <span className="text-[10px] font-bold text-primary tabular-nums">
              {selectedVal} {selectedVal === 1 ? unitSingular : unitLabel}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {quickPresets
              .filter((p) => p >= effectiveMin && p <= effectiveMax)
              .map((preset) => {
                const isActive = selectedVal === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleItemClick(preset)}
                    disabled={disabled}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all border select-none active:scale-95",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary shadow-xs scale-105"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border-border/70",
                    )}
                  >
                    {preset}u
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Optional Inline Confirmation Button */}
      {(showConfirmButton || onConfirm) && open === undefined && (
        <div className="w-full pt-3">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={disabled}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            <span>
              {confirmButtonText ||
                `Confirm ${selectedVal} ${selectedVal === 1 ? unitSingular : unitLabel}`}
            </span>
          </Button>
        </div>
      )}
    </div>
  );

  // If used as a standalone modal dialog
  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[92vw] max-w-[360px] p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden flex flex-col gap-3">
          {/* Drag Handle for Bottom Sheet / Modal Affordance */}
          <div
            className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto -mt-1 mb-1"
            aria-hidden="true"
          />

          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-base sm:text-lg font-bold font-display text-foreground text-center">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground text-center">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Vertical Number Wheel */}
          <div className="py-1">{renderWheelCore()}</div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={disabled}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:bg-primary/90 active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>
                {confirmButtonText ||
                  `Confirm ${selectedVal} ${selectedVal === 1 ? unitSingular : unitLabel}`}
              </span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={disabled}
              className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground active:scale-98 transition-all"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Inline mode
  return renderWheelCore();
}
