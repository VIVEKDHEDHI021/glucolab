import React, { useMemo } from "react";
import { format, subDays, startOfMonth, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import { Calendar, ArrowRight, Sparkles, RotateCcw } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

export interface CoolDateRangePickerProps {
  from: string; // "yyyy-MM-dd"
  to: string; // "yyyy-MM-dd"
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  className?: string;
  maxDate?: string;
}

export function CoolDateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  maxDate,
}: CoolDateRangePickerProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const effectiveMax = maxDate || todayStr;

  // Compute active preset
  const activePreset = useMemo(() => {
    if (!from && !to) return "all";
    if (from === todayStr && to === todayStr) return "today";
    if (from === format(subDays(today, 6), "yyyy-MM-dd") && to === todayStr) return "7d";
    if (from === format(subDays(today, 13), "yyyy-MM-dd") && to === todayStr) return "14d";
    if (from === format(subDays(today, 29), "yyyy-MM-dd") && to === todayStr) return "30d";
    if (from === format(startOfMonth(today), "yyyy-MM-dd") && to === todayStr) return "month";
    return "custom";
  }, [from, to, today, todayStr]);

  const selectPreset = (preset: "all" | "today" | "7d" | "14d" | "30d" | "month") => {
    if (preset === "all") {
      onFromChange("");
      onToChange("");
    } else if (preset === "today") {
      onFromChange(todayStr);
      onToChange(todayStr);
    } else if (preset === "7d") {
      onFromChange(format(subDays(today, 6), "yyyy-MM-dd"));
      onToChange(todayStr);
    } else if (preset === "14d") {
      onFromChange(format(subDays(today, 13), "yyyy-MM-dd"));
      onToChange(todayStr);
    } else if (preset === "30d") {
      onFromChange(format(subDays(today, 29), "yyyy-MM-dd"));
      onToChange(todayStr);
    } else if (preset === "month") {
      onFromChange(format(startOfMonth(today), "yyyy-MM-dd"));
      onToChange(todayStr);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFromChange("");
    onToChange("");
  };

  // Human-readable labels for dates
  const formatDisplayDate = (dateStr: string, placeholder: string) => {
    if (!dateStr) return { primary: placeholder, secondary: null, isSet: false };
    try {
      const parsed = parseISO(dateStr);
      if (!isValid(parsed)) return { primary: placeholder, secondary: null, isSet: false };
      
      const isCurrentDay = dateStr === todayStr;
      const isYesterday = dateStr === format(subDays(today, 1), "yyyy-MM-dd");

      let secondary = format(parsed, "yyyy");
      let primary = format(parsed, "MMM d");

      if (isCurrentDay) {
        primary = "Today";
        secondary = format(parsed, "MMM d");
      } else if (isYesterday) {
        primary = "Yesterday";
        secondary = format(parsed, "MMM d");
      }

      return { primary, secondary, isSet: true, dayOfWeek: format(parsed, "EEE") };
    } catch {
      return { primary: placeholder, secondary: null, isSet: false };
    }
  };

  const fromInfo = formatDisplayDate(from, "Start date");
  const toInfo = formatDisplayDate(to, "End date");

  // Difference in days if both set
  const daysDiff = useMemo(() => {
    if (!from || !to) return null;
    try {
      const d1 = parseISO(from);
      const d2 = parseISO(to);
      if (isValid(d1) && isValid(d2)) {
        const diff = differenceInCalendarDays(d2, d1) + 1;
        return diff > 0 ? diff : null;
      }
    } catch {
      return null;
    }
    return null;
  }, [from, to]);

  const hasFilter = Boolean(from || to);

  const presets = [
    { id: "all", label: "All" },
    { id: "today", label: "Today" },
    { id: "7d", label: "7 Days" },
    { id: "14d", label: "14 Days" },
    { id: "30d", label: "30 Days" },
    { id: "month", label: "This Month" },
  ] as const;

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* 1. Quick Presets Scrollable Pill Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mr-1 shrink-0">
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
          <span>Quick:</span>
        </div>
        {presets.map((p) => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 select-none active:scale-95",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 font-bold ring-1 ring-primary/40"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
              )}
            >
              {p.label}
            </button>
          );
        })}

        {hasFilter && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 transition-all select-none ml-auto"
            title="Reset date filter"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* 2. Sleek Dual-Segmented Date Capsule */}
      <div className="relative flex items-center justify-between gap-1.5 rounded-2xl border border-border/80 bg-card/80 p-1.5 shadow-soft backdrop-blur-sm transition-all hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20">
        {/* FROM Date Segment */}
        <div className="group relative flex-1 min-w-0 rounded-xl bg-background/60 p-2.5 border border-border/40 hover:bg-background/90 transition-all cursor-pointer">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                fromInfo.isSet
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  FROM
                </span>
                {fromInfo.dayOfWeek && (
                  <span className="text-[10px] font-semibold text-primary/80">
                    · {fromInfo.dayOfWeek}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={cn(
                    "text-xs font-bold truncate",
                    fromInfo.isSet ? "text-foreground" : "text-muted-foreground font-normal"
                  )}
                >
                  {fromInfo.primary}
                </span>
                {fromInfo.secondary && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {fromInfo.secondary}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Native Date Input Overlay */}
          <input
            type="date"
            value={from}
            max={to || effectiveMax}
            onChange={(e) => onFromChange(e.target.value)}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10"
            aria-label="Filter from date"
          />
        </div>

        {/* Center Divider / Day Indicator */}
        <div className="shrink-0 flex flex-col items-center justify-center px-1">
          {daysDiff !== null ? (
            <div className="flex flex-col items-center">
              <span className="flex h-6 px-1.5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-tight border border-primary/20 shadow-xs">
                {daysDiff} {daysDiff === 1 ? "day" : "days"}
              </span>
            </div>
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground border border-border/40">
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          )}
        </div>

        {/* TO Date Segment */}
        <div className="group relative flex-1 min-w-0 rounded-xl bg-background/60 p-2.5 border border-border/40 hover:bg-background/90 transition-all cursor-pointer">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                toInfo.isSet
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                  TO
                </span>
                {toInfo.dayOfWeek && (
                  <span className="text-[10px] font-semibold text-primary/80">
                    · {toInfo.dayOfWeek}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span
                  className={cn(
                    "text-xs font-bold truncate",
                    toInfo.isSet ? "text-foreground" : "text-muted-foreground font-normal"
                  )}
                >
                  {toInfo.primary}
                </span>
                {toInfo.secondary && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {toInfo.secondary}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Native Date Input Overlay */}
          <input
            type="date"
            value={to}
            min={from}
            max={effectiveMax}
            onChange={(e) => onToChange(e.target.value)}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-10"
            aria-label="Filter to date"
          />
        </div>
      </div>
    </div>
  );
}
