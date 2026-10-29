import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Utensils,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/db/client";
import { useAuth } from "@/frontend/lib/auth-context";
import { useHealthData } from "@/frontend/providers/data-context";
import { Capacitor } from "@capacitor/core";
import {
  READING_TYPES,
  READING_LABELS,
  type GlucoseEntry,
  type InsulinEntry,
  type WeightEntry,
  type FoodEntry,
} from "@/frontend/lib/types";
import {
  calculatePeriodStats,
  calculatePairedMealDeltas,
  analyzeFoodGlucoseCorrelations,
  generatePatientInsights,
} from "@/frontend/lib/food-glucose-analysis";
import { cn } from "@/frontend/lib/utils";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — GlucoLab" }] }),
});

function ReportsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const {
    glucose: globalGlucose,
    insulin: globalInsulin,
    weight: globalWeight,
    food: globalFood,
    refreshData,
  } = useHealthData();

  useEffect(() => {
    refreshData(false);
  }, [user]);

  const glucoseList = globalGlucose;
  const insulinList = globalInsulin;
  const weightList = globalWeight;
  const foodList = globalFood;

  const glucose = useMemo(() => {
    const sinceIso = subDays(new Date(), days).toISOString();
    return glucoseList
      .filter((g) => g.date_time >= sinceIso)
      .sort((a, b) => a.date_time.localeCompare(b.date_time));
  }, [glucoseList, days]);

  const food = useMemo(() => {
    const sinceIso = subDays(new Date(), days).toISOString();
    return (foodList || [])
      .filter((f) => f.date_time >= sinceIso)
      .sort((a, b) => a.date_time.localeCompare(b.date_time));
  }, [foodList, days]);

  const insulin = useMemo(() => {
    const sinceDate = format(subDays(new Date(), days), "yyyy-MM-dd");
    return insulinList
      .filter((i) => i.entry_date >= sinceDate)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [insulinList, days]);

  const weight = useMemo(() => {
    const sinceDate = format(subDays(new Date(), days), "yyyy-MM-dd");
    return weightList
      .filter((w) => w.entry_date >= sinceDate)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  }, [weightList, days]);

  const stats = useMemo(() => {
    if (!glucose.length) return null;
    const values = glucose.map((g) => Number(g.glucose));
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const high = glucose.reduce((p, c) => (Number(c.glucose) > Number(p.glucose) ? c : p));
    const low = glucose.reduce((p, c) => (Number(c.glucose) < Number(p.glucose) ? c : p));
    return { avg, high, low, count: glucose.length };
  }, [glucose]);

  const dailyAvg = useMemo(() => {
    const map = new Map<string, number[]>();
    glucose.forEach((g) => {
      const d = format(new Date(g.date_time), "MM/dd");
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(Number(g.glucose));
    });
    return Array.from(map.entries()).map(([date, vals]) => ({
      date,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));
  }, [glucose]);

  const slotAvg = useMemo(() => {
    return READING_TYPES.map((t) => {
      const vals = glucose.filter((g) => g.reading_type === t).map((g) => Number(g.glucose));
      return {
        type: t,
        avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
        count: vals.length,
      };
    }).filter((s) => s.count > 0);
  }, [glucose]);

  const insulinTrend = insulin.map((i) => ({
    date: format(new Date(i.entry_date), "MM/dd"),
    total: Number(i.morning) + Number(i.lunch) + (Number(i.afternoon) || 0) + Number(i.evening) + Number(i.night),
  }));

  const weightTrend = weight.map((w) => ({
    date: format(new Date(w.entry_date), "MM/dd"),
    kg: Number(w.weight_kg),
  }));

  // Analytical metrics for period-based statistics and correlations
  const periodStats = useMemo(() => calculatePeriodStats(glucose), [glucose]);
  const pairedDeltas = useMemo(() => calculatePairedMealDeltas(glucose), [glucose]);
  const foodCorrelations = useMemo(() => analyzeFoodGlucoseCorrelations(food, glucose), [food, glucose]);
  const patientInsights = useMemo(() => {
    return generatePatientInsights({
      periodStats,
      pairedDeltas,
      foodCorrelations,
      insulinEntries: insulin,
      glucoseReadings: glucose,
    });
  }, [periodStats, pairedDeltas, foodCorrelations, insulin, glucose]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Insights from your last {days} days.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI
          label="Average"
          value={stats ? `${stats.avg}` : "—"}
          unit="mg/dL"
          icon={<Activity className="h-4 w-4" />}
        />
        <KPI
          label="Highest"
          value={stats ? `${Math.round(Number(stats.high.glucose))}` : "—"}
          unit="mg/dL"
          sub={stats && format(new Date(stats.high.date_time), "MMM d HH:mm")}
          icon={<TrendingUp className="h-4 w-4 text-destructive" />}
        />
        <KPI
          label="Lowest"
          value={stats ? `${Math.round(Number(stats.low.glucose))}` : "—"}
          unit="mg/dL"
          sub={stats && format(new Date(stats.low.date_time), "MMM d HH:mm")}
          icon={<TrendingDown className="h-4 w-4 text-warning" />}
        />
        <KPI
          label="Readings"
          value={stats ? `${stats.count}` : "0"}
          unit="logs"
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* 1. Personalized Pattern Insights & Clinical Safety Alerts */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Personalized Pattern Insights</h2>
            <p className="text-xs text-muted-foreground">
              Observation-based patterns identified across your last {days} days of data
            </p>
          </div>
        </div>

        {patientInsights.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {patientInsights.map((insight) => (
              <div
                key={insight.id}
                className={cn(
                  "rounded-xl border p-3.5 text-xs space-y-1.5 transition-colors",
                  insight.severity === "alert"
                    ? "border-destructive/30 bg-destructive/5 text-foreground"
                    : insight.severity === "warning"
                    ? "border-amber-500/30 bg-amber-500/5 text-foreground"
                    : "border-border/60 bg-background/50 text-foreground"
                )}
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    {insight.severity === "alert" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span>{insight.title}</span>
                  </div>
                  {insight.supportingObservations > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {insight.supportingObservations} observation{insight.supportingObservations > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">{insight.message}</p>
                {insight.safetyNote && (
                  <p className="text-[10px] text-muted-foreground/80 font-medium italic pt-0.5">
                    Note: {insight.safetyNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            Continue logging food and glucose readings to establish pattern insights.
          </div>
        )}

        {/* Safety Disclaimer Banner */}
        <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground/80" />
          <span>
            <strong>Safety Notice:</strong> These insights reflect historical correlations and observational data, not proof of causation or clinical treatment advice. Do not adjust prescribed insulin dosages without clinician consultation.
          </span>
        </div>
      </div>

      {/* 2. Feature E — Period-Based Glucose Analysis */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold">Period-Based Glucose Analysis</h2>
          <p className="text-xs text-muted-foreground">
            Target ranges: 70–130 mg/dL for fasting/pre-meal; 70–180 mg/dL for post-meal and bedtime.
          </p>
        </div>

        {/* Pre vs Post Meal Delta Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pairedDeltas.map((delta) => (
            <div
              key={delta.meal}
              className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-1"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span>{delta.meal} Difference</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {delta.prePeriod} → {delta.postPeriod}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-0.5">
                <span
                  className={cn(
                    "font-display text-xl font-bold",
                    delta.averageDelta > 50
                      ? "text-amber-600 dark:text-amber-400"
                      : delta.averageDelta > 0
                      ? "text-foreground"
                      : "text-primary"
                  )}
                >
                  {delta.pairCount > 0
                    ? `${delta.averageDelta > 0 ? "+" : ""}${Math.round(delta.averageDelta)}`
                    : "—"}
                </span>
                <span className="text-[11px] text-muted-foreground">mg/dL avg rise</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {delta.pairCount > 0
                  ? `Across ${delta.pairCount} comparable paired day${delta.pairCount > 1 ? "s" : ""}`
                  : "No paired readings on identical days"}
              </p>
            </div>
          ))}
        </div>

        {/* Detailed Period Statistics Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 font-semibold">Period</th>
                <th className="pb-2 font-semibold">Readings</th>
                <th className="pb-2 font-semibold">Average (Mean)</th>
                <th className="pb-2 font-semibold">Median</th>
                <th className="pb-2 font-semibold">Min – Max</th>
                <th className="pb-2 font-semibold">Variability (SD / CV)</th>
                <th className="pb-2 font-semibold">% In Target</th>
                <th className="pb-2 font-semibold">High / Low</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {periodStats.map((p) => (
                <tr key={p.period} className="hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 font-semibold text-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5 mr-1.5 text-[10px] font-mono">
                      {p.period}
                    </span>
                    {p.label}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.count > 0 ? p.count : "—"}
                  </td>
                  <td className="py-2.5 font-medium text-foreground">
                    {p.count > 0 ? `${p.mean} mg/dL` : "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.count > 0 ? `${p.median} mg/dL` : "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.count > 0 ? `${p.min} – ${p.max}` : "—"}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.count > 0 ? `±${p.standardDeviation} (${p.coefficientOfVariation}%)` : "—"}
                  </td>
                  <td className="py-2.5">
                    {p.count > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          p.inRangePercent >= 70
                            ? "bg-success/15 text-success"
                            : p.inRangePercent >= 50
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-destructive/15 text-destructive"
                        )}
                      >
                        {p.inRangePercent}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {p.count > 0 ? (
                      <span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{p.highCount} high</span>
                        {" / "}
                        <span className="text-destructive font-medium">{p.lowCount} low</span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Feature D — Special Food & Glucose Association Analysis */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Utensils className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Food & Glucose Associations</h2>
            <p className="text-xs text-muted-foreground">
              Glucose readings taken within 1 to 4 hours following recorded food categories
            </p>
          </div>
        </div>

        {foodCorrelations.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {foodCorrelations.map((foodItem) => (
              <div
                key={foodItem.category}
                className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-xs text-foreground leading-tight">
                    {foodItem.category}
                  </span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {foodItem.observationCount} record{foodItem.observationCount > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Avg Post-Meal
                    </div>
                    <div className="font-display text-lg font-bold text-foreground">
                      {foodItem.averagePostGlucose} <span className="text-xs font-normal text-muted-foreground">mg/dL</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      Elevated Rate
                    </div>
                    <div
                      className={cn(
                        "font-display text-lg font-bold",
                        foodItem.elevatedRate >= 50
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-success"
                      )}
                    >
                      {foodItem.elevatedRate}%
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground/80 leading-snug">
                  {foodItem.timeRangeDescription}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            No food logs recorded within the selected {days}-day period. Use the Special Food action or glucose entry dialog to record meals.
          </div>
        )}
      </div>

      <ChartCard title="Daily glucose average">
        {dailyAvg.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyAvg} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Average by time slot">
        {slotAvg.length > 0 ? (
          <ResponsiveContainer width="100%" height={240} minWidth={100} minHeight={200}>
            <BarChart data={slotAvg} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="avg" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Insulin total per day">
          {insulinTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={200}>
              <BarChart data={insulinTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="total" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Weight trend">
          {weightTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={200}>
              <LineChart data={weightTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  unit,
  sub,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  sub?: string | false | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold sm:text-3xl">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <h2 className="mb-4 font-display text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );
}
