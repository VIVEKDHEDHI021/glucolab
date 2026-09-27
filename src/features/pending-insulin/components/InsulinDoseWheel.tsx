import React, { useRef, useState, useCallback, useEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

interface InsulinDoseWheelProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

const QUICK_SELECT_VALUES = [1, 2, 4, 6, 8, 10];

export function InsulinDoseWheel({
  value,
  onChange,
  min = 0,
  max = 50,
  disabled = false,
}: InsulinDoseWheelProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef(0);

  // Wheel center & radius constants
  const size = 270;
  const cx = size / 2;
  const cy = size / 2;
  const rTrack = 102;
  const rTicks = 90;
  const rNumbers = 72;

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

  // Handle pointer calculation
  const handlePointerCalc = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current || disabled) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);

      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      // Seam protection: if crossing between near 0 and near 360
      const prevAngle = lastAngleRef.current;
      if (prevAngle < 45 && deg > 315) {
        deg = 0;
      } else if (prevAngle > 315 && deg < 45) {
        deg = 360;
      }
      lastAngleRef.current = deg;

      const rawVal = Math.round((deg / 360) * max);
      const clamped = Math.max(min, Math.min(max, rawVal));

      if (clamped !== value) {
        onChange(clamped);
        triggerHaptic();
      }
    },
    [disabled, max, min, onChange, triggerHaptic, value],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return;
    isDraggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    handlePointerCalc(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current || disabled) return;
    handlePointerCalc(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Generate SVG path for active progress arc
  const getArcPath = () => {
    if (value <= 0) return "";
    if (value >= max) {
      // Full circle
      return `M ${cx} ${cy - rTrack} A ${rTrack} ${rTrack} 0 1 1 ${cx - 0.01} ${cy - rTrack}`;
    }
    const largeArc = angleDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy - rTrack} A ${rTrack} ${rTrack} 0 ${largeArc} 1 ${thumbPos.x} ${thumbPos.y}`;
  };

  // Stepper adjustments
  const adjustValue = (delta: number) => {
    if (disabled) return;
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) {
      onChange(next);
      triggerHaptic();
    }
  };

  // Numeric labels at multiples of 5
  const numberSteps = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

  return (
    <div className="flex flex-col items-center select-none touch-none">
      {/* Interactive Circular Wheel */}
      <div className="relative w-[270px] h-[270px] flex items-center justify-center">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="cursor-pointer"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* Subtle Outer Dial Background Glow */}
          <circle
            cx={cx}
            cy={cy}
            r={rTrack + 16}
            fill="none"
            className="stroke-primary/5 dark:stroke-primary/10"
            strokeWidth="32"
          />

          {/* Background Track */}
          <circle
            cx={cx}
            cy={cy}
            r={rTrack}
            fill="none"
            className="stroke-border/70 dark:stroke-zinc-800"
            strokeWidth="7"
          />

          {/* Radial Ticks */}
          {Array.from({ length: 51 }).map((_, i) => {
            const isMajor = i % 5 === 0;
            const tAngle = (i / max) * 360;
            const pOuter = getCoordinatesForAngle(tAngle, rTicks);
            const pInner = getCoordinatesForAngle(tAngle, rTicks - (isMajor ? 7 : 4));
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
                      ? "stroke-primary/80 stroke-[2px]"
                      : "stroke-muted-foreground/50 stroke-[1.5px]"
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
            const isSelected = Math.abs(value - step) <= 1;

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
                    ? "fill-primary font-bold text-[13px] scale-110"
                    : "fill-muted-foreground/75 font-medium text-[11px]",
                )}
              >
                {step}
              </text>
            );
          })}

          {/* Active Progress Arc */}
          {value > 0 && (
            <path
              d={getArcPath()}
              fill="none"
              className="stroke-primary drop-shadow-[0_0_8px_rgba(59,130,246,0.35)]"
              strokeWidth="7.5"
              strokeLinecap="round"
            />
          )}

          {/* Draggable Indicator Thumb */}
          <circle
            cx={thumbPos.x}
            cy={thumbPos.y}
            r="12"
            fill="white"
            className="stroke-primary cursor-grab active:cursor-grabbing drop-shadow-md"
            strokeWidth="3.5"
          />
          <circle
            cx={thumbPos.x}
            cy={thumbPos.y}
            r="4"
            className="fill-primary"
          />
        </svg>

        {/* Center Display: Readout & Fine-Tuning */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => adjustValue(-1)}
              disabled={value <= min || disabled}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
              aria-label="Decrease 1 unit"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <div className="flex flex-col items-center min-w-[80px]">
              <span className="font-display text-5xl font-black text-foreground tracking-tight leading-none">
                {value}
              </span>
              <span className="text-[11px] font-semibold text-primary uppercase tracking-widest mt-1">
                units
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustValue(1)}
              disabled={value >= max || disabled}
              className="h-8 w-8 rounded-full flex items-center justify-center bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all"
              aria-label="Increase 1 unit"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick-Select Buttons */}
      <div className="w-full mt-3">
        <div className="text-[11px] font-medium text-muted-foreground text-center mb-1.5">
          Quick Select
        </div>
        <div className="grid grid-cols-6 gap-1.5 w-full max-w-[280px]">
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
                  "py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs border",
                  isQuickActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
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
