import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Pencil, Trash2, Search, Droplet, Syringe, Utensils, MessageSquare, Clock, Scale, X } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError, getSuccessMessage, logDiagnostic } from "@/frontend/lib/user-messages";
import { supabase } from "@/db/client";
import { healthService } from "@/backend/services/healthService";
import { useAuth } from "@/frontend/lib/auth-context";
import { useHealthData } from "@/frontend/providers/data-context";
import { Capacitor } from "@capacitor/core";
import { Input } from "@/frontend/components/ui/input";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { GlucoseDialog } from "@/frontend/components/glucose-dialog";
import { InsulinDialog } from "@/frontend/components/insulin-dialog";
import { WeightDialog } from "@/frontend/components/weight-dialog";
import { FoodDialog } from "@/frontend/components/food-dialog";
import {
  READING_LABELS,
  PORTION_LABELS,
  glucoseStatus,
  type GlucoseEntry,
  type InsulinEntry,
  type WeightEntry,
  type FoodEntry,
} from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { CoolDateRangePicker } from "@/frontend/components/CoolDateRangePicker";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  head: () => ({ meta: [{ title: "History — GlucoLab" }] }),
});

function HistoryPage() {
  const { user } = useAuth();
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const { glucose, insulin, weight, food, refreshData, optimisticDeleteGlucose, optimisticDeleteInsulin } = useHealthData();
  const [activeTab, setActiveTab] = useState<"glucose" | "insulin" | "weight" | "food">("glucose");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editing, setEditing] = useState<GlucoseEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [editingInsulinDate, setEditingInsulinDate] = useState<string | null>(null);
  const [editingInsulinId, setEditingInsulinId] = useState<string | null>(null);
  const [insulinOpen, setInsulinOpen] = useState(false);
  const [editingWeight, setEditingWeight] = useState<WeightEntry | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodEntry | null>(null);
  const [foodOpen, setFoodOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const handleFromChange = (val: string) => {
    if (val > todayStr) {
      setFrom(todayStr);
    } else {
      setFrom(val);
    }
  };

  const handleToChange = (val: string) => {
    if (val > todayStr) {
      setTo(todayStr);
    } else {
      setTo(val);
    }
  };

  const load = async () => {
    if (!user) return;
    await refreshData(true);
  };

  useEffect(() => {
    load();
    const handleUpdate = (e?: any) => {
      if (e?.detail?.entity === "insulin") {
        console.log("[HISTORY] Targeted insulin update detected, avoiding full refresh");
        return;
      }
      load();
    };
    window.addEventListener("health-data-updated", handleUpdate);
    return () => window.removeEventListener("health-data-updated", handleUpdate);
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, from, to, activeTab]);

  const entriesList = glucose;
  const insulinEntries = insulin;
  const weightEntries = weight;

  const filteredByDate = useMemo(() => {
    return entriesList.filter((e) => {
      const entryTime = new Date(e.date_time);
      if (from) {
        const fromDate = new Date(from);
        if (entryTime < fromDate) return false;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59`);
        if (entryTime > toDate) return false;
      }
      return true;
    });
  }, [entriesList, from, to]);

  const filtered = filteredByDate.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (e.notes ?? "").toLowerCase().includes(s) ||
      (e.food ?? "").toLowerCase().includes(s) ||
      (e.symptoms ?? "").toLowerCase().includes(s) ||
      e.reading_type.toLowerCase().includes(s)
    );
  });

  const filteredInsulin = useMemo(() => {
    let result = insulinEntries;
    if (from) {
      result = result.filter((i) => i.entry_date >= from);
    }
    if (to) {
      result = result.filter((i) => i.entry_date <= to);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          (i.notes ?? "").toLowerCase().includes(s) ||
          i.entry_date.includes(s)
      );
    }
    return result;
  }, [insulinEntries, from, to, search]);

  const filteredWeight = useMemo(() => {
    let result = weightEntries;
    if (from) {
      result = result.filter((w) => w.entry_date >= from);
    }
    if (to) {
      result = result.filter((w) => w.entry_date <= to);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((w) => (w.notes ?? "").toLowerCase().includes(s));
    }
    return result;
  }, [weightEntries, from, to, search]);

  const filteredFood = useMemo(() => {
    let result = food;
    if (from) {
      result = result.filter((f) => f.date_time.slice(0, 10) >= from);
    }
    if (to) {
      result = result.filter((f) => f.date_time.slice(0, 10) <= to);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (f) =>
          (f.notes ?? "").toLowerCase().includes(s) ||
          f.meal_period.toLowerCase().includes(s) ||
          (f.food_categories || []).some((c) => c.toLowerCase().includes(s))
      );
    }
    return result;
  }, [food, from, to, search]);

  const currentFilteredList =
    activeTab === "glucose"
      ? filtered
      : activeTab === "insulin"
      ? filteredInsulin
      : activeTab === "weight"
      ? filteredWeight
      : filteredFood;
  const totalPages = Math.ceil(currentFilteredList.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, currentFilteredList.length);
  const paginated = currentFilteredList.slice(startIndex, endIndex);

  const handleDelete = async (id: string) => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error(getUserFriendlyError("not authenticated", "glucose"));
      return;
    }
    if (!confirm("Are you sure you want to delete this glucose reading?")) return;
    // Optimistic UI deletion
    optimisticDeleteGlucose(id);
    try {
      const { error } = await healthService.deleteGlucoseEntry(id);
      if (error) throw error;
      toast.success(getSuccessMessage("glucose_deleted"));
      load();
    } catch (error: any) {
      logDiagnostic("history:delete-glucose", error);
      toast.error(getUserFriendlyError(error, "glucose"));
      load(); // Roll back / reconcile on error
    }
  };

  const handleDeleteInsulin = async (id: string) => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error(getUserFriendlyError("not authenticated", "insulin"));
      return;
    }
    if (!confirm("Are you sure you want to delete this insulin entry?")) return;
    // Optimistic UI deletion
    optimisticDeleteInsulin(id);
    try {
      const { error } = await healthService.deleteInsulinEntry(id);
      if (error) throw error;
      toast.success(getSuccessMessage("insulin_deleted"));
      load();
    } catch (error: any) {
      logDiagnostic("history:delete-insulin", error);
      toast.error(getUserFriendlyError(error, "insulin"));
      load(); // Roll back / reconcile on error
    }
  };

  const handleDeleteFood = async (id: string) => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error(getUserFriendlyError("not authenticated", "food"));
      return;
    }
    if (!confirm("Are you sure you want to delete this food log?")) return;
    const { error } = await supabase
      .from("food_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);
    if (error) {
      logDiagnostic("history:delete-food", error);
      toast.error(getUserFriendlyError(error, "food"));
      return;
    }
    healthService.invalidateServerCache("food");
    toast.success(getSuccessMessage("food_deleted"));
    load();
  };

  const handleDeleteWeight = async (id: string) => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    if (!currentUser) {
      toast.error(getUserFriendlyError("not authenticated", "weight"));
      return;
    }
    if (!confirm("Are you sure you want to delete this weight entry?")) return;
    const { error } = await supabase
      .from("weight_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);
    if (error) {
      logDiagnostic("history:delete-weight", error);
      toast.error(getUserFriendlyError(error, "weight"));
      return;
    }
    healthService.invalidateServerCache("weight");
    toast.success(getSuccessMessage("weight_deleted"));
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "glucose"
              ? "All your glucose readings."
              : activeTab === "food"
              ? "All your logged foods, meals, and special food context."
              : activeTab === "insulin"
              ? "All your logged insulin doses and schedules."
              : "All your logged weights."}
          </p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "glucose" | "insulin" | "weight" | "food")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-4 sm:w-[440px] rounded-xl">
            <TabsTrigger value="glucose" className="text-xs font-semibold rounded-lg">Glucose</TabsTrigger>
            <TabsTrigger value="food" className="text-xs font-semibold rounded-lg">Food</TabsTrigger>
            <TabsTrigger value="insulin" className="text-xs font-semibold rounded-lg">Insulin</TabsTrigger>
            <TabsTrigger value="weight" className="text-xs font-semibold rounded-lg">Weight</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3">
        {/* Sleek Search Bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
          <Input
            placeholder={
              activeTab === "glucose"
                ? "Search notes, food, meal type..."
                : activeTab === "food"
                ? "Search foods, meals, notes..."
                : activeTab === "insulin"
                ? "Search notes, date..."
                : "Search notes..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-9 rounded-xl border-border/80 bg-card/60 shadow-xs focus-visible:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Cool, Attractive Date Range Picker */}
        <CoolDateRangePicker
          from={from}
          to={to}
          onFromChange={handleFromChange}
          onToChange={handleToChange}
          maxDate={todayStr}
        />

        {/* Active Filter Summary Strip */}
        {(search || from || to) && (
          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground pt-0.5">
            <span>
              Showing <strong className="text-foreground">{currentFilteredList.length}</strong> {activeTab} {currentFilteredList.length === 1 ? "entry" : "entries"}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFrom("");
                setTo("");
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        {currentFilteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            {activeTab === "glucose" ? (
              <Droplet className="h-8 w-8" />
            ) : activeTab === "food" ? (
              <Utensils className="h-8 w-8" />
            ) : activeTab === "insulin" ? (
              <Syringe className="h-8 w-8" />
            ) : (
              <Scale className="h-8 w-8" />
            )}
            <p className="text-sm">No entries match your filters.</p>
          </div>
        ) : (
          <>
            {activeTab === "glucose" ? (
              <ul className="divide-y divide-border">
                {(paginated as GlucoseEntry[]).map((e) => {
                  const st = glucoseStatus(Number(e.glucose), e.reading_type);
                  const entryDateStr = format(new Date(e.date_time), "yyyy-MM-dd");
                  const dayInsulin = insulinEntries.find((i) => i.entry_date === entryDateStr);

                  return (
                    <li key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/30 transition-all duration-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={cn(
                            "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-display font-bold shadow-sm border transition-transform duration-200 hover:scale-105",
                            st === "high" && "bg-destructive/10 text-destructive border-destructive/20",
                            st === "low" && "bg-warning/10 text-warning border-warning/20",
                            st === "normal" && "bg-success/10 text-success border-success/20",
                          )}
                        >
                          <div className="text-base leading-none">{Math.round(Number(e.glucose))}</div>
                          <div className="text-[10px] font-semibold opacity-80 mt-0.5">mg/dL</div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              className={cn(
                                "text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 border",
                                st === "high" && "bg-destructive/5 text-destructive border-destructive/10",
                                st === "low" && "bg-warning/5 text-warning border-warning/10",
                                st === "normal" && "bg-success/5 text-success border-success/10",
                              )}
                              variant="outline"
                            >
                              {e.reading_type}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">
                              {READING_LABELS[e.reading_type]}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full capitalize",
                                st === "high" && "bg-destructive/10 text-destructive",
                                st === "low" && "bg-warning/10 text-warning",
                                st === "normal" && "bg-success/10 text-success",
                              )}
                            >
                              {st}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(new Date(e.date_time), "EEEE, MMM d, yyyy · HH:mm")}</span>
                          </div>

                          <div className="space-y-1 mt-1">
                            {e.food && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Utensils className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                                <span className="font-medium text-foreground truncate">
                                  Food: <span className="text-muted-foreground font-normal">{e.food}</span>
                                </span>
                              </div>
                            )}

                            {dayInsulin ? (
                              <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1.5 px-2.5 rounded-xl border border-border/50 w-fit">
                                <Syringe className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-[11px] font-medium text-muted-foreground">Daily Insulin:</span>
                                <div className="flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold" title="Morning">M: {dayInsulin.morning}u</span>
                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold" title="Lunch">L: {dayInsulin.lunch}u</span>
                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold" title="Evening">E: {dayInsulin.evening}u</span>
                                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold" title="Night">N: {dayInsulin.night}u</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-border/80 ml-1">
                                  Total: {Number(dayInsulin.morning) + Number(dayInsulin.lunch) + Number(dayInsulin.evening) + Number(dayInsulin.night)}u
                                </Badge>
                              </div>
                            ) : e.symptoms ? (
                              <div className="flex flex-wrap items-center gap-2 bg-muted/40 p-1.5 px-2.5 rounded-xl border border-border/50 w-fit">
                                <Syringe className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-[11px] font-medium text-muted-foreground">Daily Insulin:</span>
                                <span className="text-[11px] font-semibold text-foreground">{e.symptoms}</span>
                              </div>
                            ) : null}

                            {e.notes && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/80" />
                                <p className="italic font-normal text-muted-foreground leading-relaxed break-words line-clamp-2" title={e.notes}>
                                  &ldquo;{e.notes}&rdquo;
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(e);
                            setOpen(true);
                          }}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(e.id)}
                          aria-label="Delete"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : activeTab === "food" ? (
              <ul className="divide-y divide-border">
                {(paginated as FoodEntry[]).map((f) => {
                  const portionLabel = PORTION_LABELS[f.portion_category] || f.portion_category;
                  return (
                    <li
                      key={f.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/30 transition-all duration-200"
                    >
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                          <Utensils className="h-5 w-5" />
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              {f.meal_period}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                              {portionLabel}
                            </span>
                            {f.is_uncertain && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                Approximate
                              </span>
                            )}
                          </div>

                          {/* Category Badges */}
                          {f.food_categories && f.food_categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {f.food_categories.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(new Date(f.date_time), "HH:mm · EEEE, MMM d, yyyy")}</span>
                          </div>

                          {f.notes && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/80" />
                              <p className="italic font-normal text-muted-foreground leading-relaxed break-words line-clamp-2">
                                &ldquo;{f.notes}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingFood(f);
                            setFoodOpen(true);
                          }}
                          aria-label="Edit food log"
                          title="Edit food log"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFood(f.id)}
                          aria-label="Delete food log"
                          title="Delete entry"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : activeTab === "insulin" ? (
              <ul className="divide-y divide-border">
                {(paginated as InsulinEntry[]).map((ins) => {
                  const m = Number(ins.morning) || 0;
                  const l = Number(ins.lunch) || 0;
                  const a = Number(ins.afternoon) || 0;
                  const e = Number(ins.evening) || 0;
                  const n = Number(ins.night) || 0;
                  const total = m + l + a + e + n;

                  return (
                    <li key={ins.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/30 transition-all duration-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-display font-bold shadow-sm border border-primary/20 bg-primary/10 text-primary transition-transform duration-200 hover:scale-105">
                          <div className="text-base leading-none">{total}</div>
                          <div className="text-[10px] font-semibold opacity-80 mt-0.5">units</div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              Daily Insulin Schedule
                            </span>
                            <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/30 bg-primary/5">
                              {a > 0 ? `${m}-${l}-${a}-${e}-${n}` : `${m}-${l}-${e}-${n}`}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(new Date(ins.entry_date + "T12:00:00"), "EEEE, MMM d, yyyy")}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                              M: <strong className="text-primary">{m}u</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                              L: <strong className="text-primary">{l}u</strong>
                            </span>
                            {a > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                                A: <strong className="text-primary">{a}u</strong>
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                              E: <strong className="text-primary">{e}u</strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                              N: <strong className="text-primary">{n}u</strong>
                            </span>
                          </div>

                          {ins.notes && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/80" />
                              <p className="italic font-normal text-muted-foreground leading-relaxed break-words line-clamp-2">
                                &ldquo;{ins.notes}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingInsulinDate(ins.entry_date);
                            setEditingInsulinId(ins.id);
                            setInsulinOpen(true);
                          }}
                          aria-label="Edit insulin"
                          title="Edit dose"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInsulin(ins.id)}
                          aria-label="Delete insulin"
                          title="Delete entry"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="divide-y divide-border">
                {(paginated as WeightEntry[]).map((w) => {
                  return (
                    <li key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-muted/30 transition-all duration-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-display font-bold shadow-sm border border-primary/20 bg-primary/10 text-primary transition-transform duration-200 hover:scale-105">
                          <div className="text-base leading-none">{Number(w.weight_kg).toFixed(1)}</div>
                          <div className="text-[10px] font-semibold opacity-80 mt-0.5">kg</div>
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              Weight Reading
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(new Date(w.entry_date + "T12:00:00"), "EEEE, MMM d, yyyy")}</span>
                          </div>

                          {w.notes && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/80" />
                              <p className="italic font-normal text-muted-foreground leading-relaxed break-words line-clamp-2">
                                &ldquo;{w.notes}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingWeight(w);
                            setWeightOpen(true);
                          }}
                          aria-label="Edit weight"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteWeight(w.id)}
                          aria-label="Delete weight"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 border-t border-border bg-card/50">
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{startIndex + 1}</span> to{" "}
                  <span className="font-semibold text-foreground">{endIndex}</span> of{" "}
                  <span className="font-semibold text-foreground">{currentFilteredList.length}</span> entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                      if (totalPages > 5 && Math.abs(page - currentPage) > 1 && page !== 1 && page !== totalPages) {
                        if (page === 2 || page === totalPages - 1) {
                          return <span key={page} className="text-muted-foreground text-xs px-1">...</span>;
                        }
                        return null;
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          className={cn("h-8 w-8 p-0 text-xs", currentPage === page ? "gradient-primary text-primary-foreground font-semibold" : "")}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <GlucoseDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        entry={editing}
        onSaved={load}
      />

      <InsulinDialog
        open={insulinOpen}
        onOpenChange={(o) => {
          setInsulinOpen(o);
          if (!o) {
            setEditingInsulinDate(null);
            setEditingInsulinId(null);
          }
        }}
        initialDate={editingInsulinDate || undefined}
        entryId={editingInsulinId || undefined}
        onSaved={() => {}}
      />

      <WeightDialog
        open={weightOpen}
        onOpenChange={(o) => {
          setWeightOpen(o);
          if (!o) setEditingWeight(null);
        }}
        entry={editingWeight}
        onSaved={load}
      />

      <FoodDialog
        open={foodOpen}
        onOpenChange={(o) => {
          setFoodOpen(o);
          if (!o) setEditingFood(null);
        }}
        entry={editingFood}
        onSaved={load}
      />
    </div>
  );
}
