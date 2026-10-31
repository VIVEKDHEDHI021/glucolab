import React, { useRef, useEffect, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

interface AgeWheelSelectorProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

const ITEM_HEIGHT = 44; // px per row
const VISIBLE_COUNT = 5; // 5 visible rows (center is selected)

export function AgeWheelSelector({
  value,
  onChange,
  min = 1,
  max = 120,
  className,
}: AgeWheelSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<any>(null);
  const lastHapticValueRef = useRef<number>(value);
  const [directInputOpen, setDirectInputOpen] = useState(false);

  const safeValue = Math.min(Math.max(value || 30, min), max);

  const triggerHaptic = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {}
    }
  }, []);

  // Sync scroll position with current value
  useEffect(() => {
    if (isScrollingRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const targetTop = (safeValue - min) * ITEM_HEIGHT;
    if (Math.abs(container.scrollTop - targetTop) > 2) {
      container.scrollTop = targetTop;
    }
  }, [safeValue, min]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    const scrollTop = container.scrollTop;
    const computedIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const computedValue = Math.min(Math.max(min + computedIndex, min), max);

    if (computedValue !== lastHapticValueRef.current) {
      lastHapticValueRef.current = computedValue;
      triggerHaptic();
      onChange(computedValue);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      const snapTop = (computedValue - min) * ITEM_HEIGHT;
      if (container && Math.abs(container.scrollTop - snapTop) > 1) {
        container.scrollTo({ top: snapTop, behavior: "smooth" });
      }
    }, 120);
  }, [min, max, onChange, triggerHaptic]);

  const increment = () => {
    if (safeValue < max) {
      const next = safeValue + 1;
      onChange(next);
      triggerHaptic();
    }
  };

  const decrement = () => {
    if (safeValue > min) {
      const next = safeValue - 1;
      onChange(next);
      triggerHaptic();
    }
  };

  const ages = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className={cn("flex flex-col items-center select-none", className)}>
      <div className="relative w-full max-w-[280px] bg-card border border-border/80 rounded-3xl p-3 shadow-sm flex flex-col items-center">
        {/* Quick Stepper Up */}
        <button
          type="button"
          onClick={decrement}
          disabled={safeValue <= min}
          aria-label="Decrease age"
          className="h-8 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-30 transition-transform cursor-pointer"
        >
          <ChevronUp className="h-5 w-5" />
        </button>

        {/* Wheel Viewport */}
        <div className="relative w-full h-[220px] overflow-hidden my-1">
          {/* Top Fade Gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-card via-card/80 to-transparent z-10" />

          {/* Bottom Fade Gradient */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent z-10" />

          {/* Center Selection Indicator */}
          <div
            className="pointer-events-none absolute inset-x-3 rounded-2xl bg-primary/10 border-2 border-primary/30 z-0 transition-all"
            style={{
              top: `${(VISIBLE_COUNT - 1) / 2 * ITEM_HEIGHT}px`,
              height: `${ITEM_HEIGHT}px`,
            }}
          />

          {/* Scrollable Number List */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="w-full h-full overflow-y-scroll scrollbar-none snap-y snap-mandatory relative z-5"
            style={{
              scrollSnapType: "y mandatory",
              paddingTop: `${((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT}px`,
              paddingBottom: `${((VISIBLE_COUNT - 1) / 2) * ITEM_HEIGHT}px`,
            }}
          >
            {ages.map((age) => {
              const isSelected = age === safeValue;
              const diff = Math.abs(age - safeValue);
              return (
                <div
                  key={age}
                  onClick={() => {
                    onChange(age);
                    triggerHaptic();
                  }}
                  className={cn(
                    "flex items-center justify-center font-display transition-all cursor-pointer snap-center",
                    isSelected
                      ? "text-2xl font-extrabold text-primary scale-110"
                      : diff === 1
                      ? "text-lg font-medium text-foreground/60"
                      : "text-sm text-muted-foreground/40 scale-90"
                  )}
                  style={{ height: `${ITEM_HEIGHT}px` }}
                >
                  <span>{age}</span>
                  {isSelected && (
                    <span className="text-xs font-semibold text-primary/80 ml-2">years</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Stepper Down */}
        <button
          type="button"
          onClick={increment}
          disabled={safeValue >= max}
          aria-label="Increase age"
          className="h-8 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 disabled:opacity-30 transition-transform cursor-pointer"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Manual Input Toggle for accessibility */}
      <div className="mt-2 text-center">
        {directInputOpen ? (
          <div className="flex items-center justify-center gap-2 mt-1">
            <input
              type="number"
              min={min}
              max={max}
              value={safeValue}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) onChange(Math.min(Math.max(val, min), max));
              }}
              className="w-20 text-center font-bold text-lg rounded-xl border border-primary px-2 py-1 bg-background text-foreground"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setDirectInputOpen(false)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDirectInputOpen(true)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            Or type age directly ({safeValue} years)
          </button>
        )}
      </div>
    </div>
  );
}
