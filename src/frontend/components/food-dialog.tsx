import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Utensils,
  Clock,
  Sparkles,
  Trash2,
  Check,
  Calendar,
  AlertCircle,
  HelpCircle,
  History,
} from "lucide-react";
import { supabase, getLocalDbService } from "@/db/client";
import { useAuth } from "@/frontend/lib/auth-context";
import { useHealthData } from "@/frontend/providers/data-context";
import {
  FOOD_CATEGORIES,
  PORTION_LABELS,
  MEAL_PERIODS,
  type FoodCategory,
  type PortionCategory,
  type MealPeriod,
  type FoodEntry,
} from "@/frontend/lib/types";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import { cn } from "@/frontend/lib/utils";
import { Capacitor } from "@capacitor/core";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: FoodEntry | null;
  onSaved?: () => void;
}

export function FoodDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const { user } = useAuth();
  const { food: allFoodEntries } = useHealthData();
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [portion, setPortion] = useState<PortionCategory>("regular");
  const [mealPeriod, setMealPeriod] = useState<MealPeriod>("Lunch");
  const [dateTime, setDateTime] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [notes, setNotes] = useState<string>("");
  const [isUncertain, setIsUncertain] = useState<boolean>(false);

  // Derive frequently and recently used categories for one-tap reuse
  const frequentCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of allFoodEntries) {
      for (const cat of f.food_categories || []) {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3).map(([cat]) => cat);
    return top.length > 0 ? top : ["Rice and roti-based meals", "Sweets and mithai", "Sugary drinks and sweetened tea"];
  }, [allFoodEntries]);

  // Today's food timeline
  const todayStr = dateTime.slice(0, 10);
  const todayFood = useMemo(() => {
    return allFoodEntries.filter((f) => f.date_time.slice(0, 10) === todayStr);
  }, [allFoodEntries, todayStr]);

  // Guess meal period from current time when opening a new entry
  useEffect(() => {
    if (open) {
      if (entry) {
        setSelectedCategories(entry.food_categories || []);
        setPortion(entry.portion_category || "regular");
        setMealPeriod(entry.meal_period || "Lunch");
        setDateTime(format(new Date(entry.date_time), "yyyy-MM-dd'T'HH:mm"));
        setNotes(entry.notes || "");
        setIsUncertain(Boolean(entry.is_uncertain));
      } else {
        const now = new Date();
        const hour = now.getHours();
        let defaultPeriod: MealPeriod = "Lunch";
        if (hour >= 5 && hour < 11) defaultPeriod = "Breakfast";
        else if (hour >= 11 && hour < 15) defaultPeriod = "Lunch";
        else if (hour >= 15 && hour < 18) defaultPeriod = "Evening snack";
        else if (hour >= 18 && hour < 22) defaultPeriod = "Dinner";
        else defaultPeriod = "Morning snack";

        setSelectedCategories([]);
        setPortion("regular");
        setMealPeriod(defaultPeriod);
        setDateTime(format(now, "yyyy-MM-dd'T'HH:mm"));
        setNotes("");
        setIsUncertain(false);
      }
    }
  }, [open, entry]);

  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedCategories.length === 0 && !notes.trim()) {
      toast.error("Please select at least one food category or add a note.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        food_categories: selectedCategories.length > 0 ? selectedCategories : ["Other food"],
        portion_category: portion,
        meal_period: mealPeriod,
        date_time: new Date(dateTime).toISOString(),
        notes: notes.trim() || null,
        is_uncertain: isUncertain,
      };

      const res = entry
        ? await supabase
            .from("food_entries")
            .update(payload)
            .eq("id", entry.id)
            .eq("user_id", user.id)
        : await supabase.from("food_entries").insert(payload);

      if (res.error) throw res.error;

      // Also cache to local SQLite if native mobile
      if (Capacitor.isNativePlatform()) {
        const localDb = await getLocalDbService();
        await localDb.cacheFood([
          {
            id: entry ? entry.id : "food_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
            ...payload,
            sync_status: "synced",
          },
        ]);
      }

      window.dispatchEvent(new Event("health-data-updated"));
      toast.success(entry ? "Food log updated" : "Food logged successfully");
      onOpenChange(false);
      onSaved?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save food log");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !entry) return;
    if (!confirm("Are you sure you want to delete this food log?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("food_entries")
        .delete()
        .eq("id", entry.id)
        .eq("user_id", user.id);
      if (error) throw error;

      if (Capacitor.isNativePlatform()) {
        const localDb = await getLocalDbService();
        await localDb.deleteFood(entry.id);
      }

      window.dispatchEvent(new Event("health-data-updated"));
      toast.success("Food log deleted");
      onOpenChange(false);
      onSaved?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete food log");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {entry ? "Edit Food Log" : "Log Food & Meals"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quick, no-fuss food recording without counting calories or grams.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          {/* Recent / Frequently Logged Quick Picks */}
          {!entry && frequentCategories.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                <span>Frequent choices</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {frequentCategories.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer flex items-center gap-1",
                        isSelected
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border/80 bg-card hover:bg-muted/70 text-foreground"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Food Categories */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Food Categories (Select all that apply)</Label>
              {selectedCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCategories([])}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FOOD_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "flex min-h-[44px] items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition cursor-pointer select-none",
                      isSelected
                        ? "border-primary/60 bg-primary/10 text-primary font-semibold shadow-xs"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-transparent"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="leading-tight line-clamp-2">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portion Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Estimated Portion</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["small", "regular", "large"] as PortionCategory[]).map((p) => {
                const isSelected = portion === p;
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPortion(p)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-xs font-medium transition cursor-pointer min-h-[44px]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <span className="capitalize">{p}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      {p === "small" ? "Light snack / bite" : p === "regular" ? "Standard plate" : "Generous / festive"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Meal Period & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Meal Period</Label>
              <select
                value={mealPeriod}
                onChange={(e) => setMealPeriod(e.target.value as MealPeriod)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[40px]"
              >
                {MEAL_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="food_date_time" className="text-xs font-semibold">
                  Timestamp
                </Label>
                <button
                  type="button"
                  onClick={() => setDateTime(format(new Date(), "yyyy-MM-dd'T'HH:mm"))}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                >
                  Now
                </button>
              </div>
              <Input
                id="food_date_time"
                type="datetime-local"
                max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="min-h-[40px]"
              />
            </div>
          </div>

          {/* Notes & Uncertainty Toggle */}
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="food_notes" className="text-xs font-semibold">
                Additional Notes (Optional)
              </Label>
              <Input
                id="food_notes"
                placeholder="e.g. 2 samosas, sugar in chai, wedding buffet"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={() => setIsUncertain(!isUncertain)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition cursor-pointer w-full text-left",
                isUncertain
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                  : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
              )}
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>Mark as approximate or uncertain food details</span>
            </button>
          </div>

          {/* Daily Food Timeline Preview */}
          {todayFood.length > 0 && !entry && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Today's Recorded Meals ({todayFood.length})
                </span>
                <span className="text-[11px] text-muted-foreground/80 font-normal">
                  {format(new Date(dateTime), "MMM d")}
                </span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                {todayFood.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg bg-card/80 border border-border/40 p-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-foreground">
                        {item.meal_period}:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {item.food_categories?.join(", ")}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {format(new Date(item.date_time), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between gap-2 pt-2">
            {entry ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving}
                className="gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : entry ? "Update food" : "Save food log"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
