import React, { useRef, useCallback } from "react";
import { Plus, Minus } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

export interface InsulinDoseWheelProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  size?: number;
  sensitivity?: number;
  disabled?: boolean;
}

const QUICK_SELECT_VALUES = [1, 2, 4, 6, 8, 10];

export function InsulinDoseWheel({
  value,
  onChange,
  min = 0,
  max = 50,
  size = 206,
  sensitivity = 0.65,
  disabled = false,
}: InsulinDoseWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const startValueRef = useRef<number>(0);
  const lastAngleRef = useRef<number>(0);
  const accumulatedAngleRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  // Responsive Wheel Geometry based on size
  const cx = size / 2;
  const cy = size / 2;
  const rTrack = Math.round(size * 0.385);
  const rTicks = Math.round(size * 0.335);
  const rNumbers = Math.round(size * 0.258);

  const triggerHaptic = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  }, []);

  // Convert current value (0-max) to angle in degrees (0-360, 0 at 12 o'clock)
  const angleDeg = (Math.max(min, Math.min(max, value)) / max) * 360;

  // Convert angle (0-360) to coordinates on wheel
  const getCoordinatesForAngle = (angle: number, r: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const thumbPos = getCoordinatesForAngle(angleDeg, rTrack);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);

    // Deadzone check: Center controls are reserved for +/- buttons and readout
    // Touches too close to center (< size * 0.22) or far outside (> size * 0.58) are ignored
    if (dist < size * 0.22 || dist > size * 0.58) {
      return;
    }

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    lastAngleRef.current = deg;
    startValueRef.current = value;
    accumulatedAngleRef.current = 0;

    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || disabled || !svgRef.current) return;
    const startPos = startPosRef.current;
    if (!startPos) return;

    const distMoved = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
    if (!hasMovedRef.current && distMoved < 6) {
      // Jitter tolerance threshold before initiating drag
      return;
    }
    hasMovedRef.current = true;

    const rect = svgRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);

    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;

    // Shortest angular distance between successive pointer moves
    let delta = deg - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngleRef.current = deg;

    // Calibrated sensitivity dampening:
    // With sensitivity ~0.65, each unit requires ~11° rotation instead of 7.2°,
    // providing precise, stable control without jumping or jitter.
    const sens = Math.max(0.1, Math.min(1.0, sensitivity));
    accumulatedAngleRef.current += delta * sens;

    const degPerUnit = 360 / max;
    const deltaUnits = Math.round(accumulatedAngleRef.current / degPerUnit);
    const nextVal = Math.max(min, Math.min(max, startValueRef.current + deltaUnits));

    // Clamp accumulated angle when hitting boundaries for instantaneous reverse response
    if (nextVal <= min) {
      accumulatedAngleRef.current = Math.max(
        accumulatedAngleRef.current,
        ((min - startValueRef.current) * degPerUnit) / sens,
      );
    } else if (nextVal >= max) {
      accumulatedAngleRef.current = Math.min(
        accumulatedAngleRef.current,
        ((max - startValueRef.current) * degPerUnit) / sens,
      );
    }

    if (nextVal !== value) {
      onChange(nextVal);
      triggerHaptic();
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}

    // Tap selection: if user tapped on a track/number without dragging
    if (!hasMovedRef.current && svgRef.current && !disabled) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);

      if (dist >= size * 0.22 && dist <= size * 0.58) {
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        const rawVal = Math.round((deg / 360) * max);
        const tapped = Math.max(min, Math.min(max, rawVal));
        if (tapped !== value) {
          onChange(tapped);
          triggerHaptic();
        }
      }
    }

    startPosRef.current = null;
  };

  // Generate SVG path for active progress arc
  const getArcPath = () => {
    if (value <= 0) return "";
    if (value >= max) {
      return `M ${cx} ${cy - rTrack} A ${rTrack} ${rTrack} 0 1 1 ${cx - 0.01} ${cy - rTrack}`;
    }
    const largeArc = angleDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy - rTrack} A ${rTrack} ${rTrack} 0 ${largeArc} 1 ${thumbPos.x} ${thumbPos.y}`;
  };

  // Stepper adjustments (+ / -)
  const adjustValue = (delta: number) => {
    if (disabled) return;
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) {
      onChange(next);
      triggerHaptic();
    }
  };

  // Numeric labels at multiples of 5 (omit 50 to prevent 0 and 50 overlap at 12 o'clock)
  const numberSteps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ touchAction: "none" }}
    >
      {/* Wheel with Outside Stepper Buttons (- and +) */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
        {/* External Minus Button */}
        <button
          type="button"
          onClick={() => adjustValue(-1)}
          disabled={value <= min || disabled}
          className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full flex items-center justify-center bg-muted/70 text-foreground hover:bg-muted hover:text-primary active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all border border-border/80 shadow-xs"
          aria-label="Decrease 1 unit"
          title="Decrease 1 unit"
        >
          <Minus className="h-4 w-4" />
        </button>

        {/* Interactive Circular Wheel */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: size, height: size, touchAction: "none" }}
        >
          <svg
            ref={svgRef}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="cursor-pointer select-none"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Subtle Outer Dial Background Glow */}
            <circle
              cx={cx}
              cy={cy}
              r={rTrack + 10}
              fill="none"
              className="stroke-primary/5 dark:stroke-primary/10"
              strokeWidth="20"
            />

            {/* Background Track */}
            <circle
              cx={cx}
              cy={cy}
              r={rTrack}
              fill="none"
              className="stroke-border/70 dark:stroke-zinc-800"
              strokeWidth="5.5"
            />

            {/* Radial Ticks */}
            {Array.from({ length: 51 }).map((_, i) => {
              const isMajor = i % 5 === 0;
              const tAngle = (i / max) * 360;
              const pOuter = getCoordinatesForAngle(tAngle, rTicks);
              const pInner = getCoordinatesForAngle(tAngle, rTicks - (isMajor ? 5 : 3));
              const isPassed = i <= value;

              return (
                <line
                  key={i}
                  x1={pOuter.x}
                  y1={pOuter.y}
                  x2={pInner.x}
                  y2={pInner.y}
                  className={cn(
                    "transition-colors duration-150",
                    isMajor
                      ? isPassed
                        ? "stroke-primary/80 stroke-[1.8px]"
                        : "stroke-muted-foreground/50 stroke-[1.4px]"
                      : isPassed
                      ? "stroke-primary/40 stroke-[1px]"
                      : "stroke-muted-foreground/25 stroke-[1px]",
                  )}
                />
              );
            })}

            {/* Digits Around the Wheel */}
            {numberSteps.map((step) => {
              const numAngle = (step / max) * 360;
              const pos = getCoordinatesForAngle(numAngle, rNumbers);
              const isSelected =
                step === 0 ? value === 0 || value === max : Math.abs(value - step) <= 1;
              const labelText = step === 0 && value === max ? max : step;

              return (
                <text
                  key={step}
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    "font-sans transition-all duration-150 select-none pointer-events-none",
                    isSelected
                      ? "fill-primary font-bold text-[11px] scale-110"
                      : "fill-muted-foreground/75 font-medium text-[9.5px]",
                  )}
                >
                  {labelText}
                </text>
              );
            })}

            {/* Active Progress Arc */}
            {value > 0 && (
              <path
                d={getArcPath()}
                fill="none"
                className="stroke-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]"
                strokeWidth="6"
                strokeLinecap="round"
              />
            )}

            {/* Draggable Indicator Thumb */}
            <circle
              cx={thumbPos.x}
              cy={thumbPos.y}
              r="9.5"
              fill="white"
              className="stroke-primary cursor-grab active:cursor-grabbing drop-shadow-md"
              strokeWidth="3"
            />
            <circle
              cx={thumbPos.x}
              cy={thumbPos.y}
              r="3.5"
              className="fill-primary"
            />
          </svg>

          {/* Center Display: Clean Readout Only */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
            <span className="font-display text-4xl sm:text-5xl font-black text-foreground tracking-tight leading-none">
              {value}
            </span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest mt-1">
              units
            </span>
          </div>
        </div>

        {/* External Plus Button */}
        <button
          type="button"
          onClick={() => adjustValue(1)}
          disabled={value >= max || disabled}
          className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full flex items-center justify-center bg-muted/70 text-foreground hover:bg-muted hover:text-primary active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-all border border-border/80 shadow-xs"
          aria-label="Increase 1 unit"
          title="Increase 1 unit"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Quick-Select Buttons */}
      <div className="w-full mt-1.5">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center mb-1">
          Quick Select
        </div>
        <div className="grid grid-cols-6 gap-1 w-full max-w-[260px] mx-auto">
          {QUICK_SELECT_VALUES.map((qVal) => {
            const isQuickActive = value === qVal;
            return (
              <button
                key={qVal}
                type="button"
                onClick={() => {
                  onChange(qVal);
                  triggerHaptic();
                }}
                disabled={disabled}
                className={cn(
                  "py-1 rounded-lg text-xs font-bold transition-all border",
                  isQuickActive
                    ? "bg-primary text-primary-foreground border-primary shadow-xs scale-102"
                    : "bg-muted/40 text-foreground border-border/70 hover:bg-muted hover:border-border",
                )}
              >
                {qVal}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
