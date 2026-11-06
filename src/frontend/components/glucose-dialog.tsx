import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/db/client";
import { healthService } from "@/backend/services/healthService";
import { idempotencyService } from "@/backend/services/idempotencyService";
import { useAuth } from "@/frontend/lib/auth-context";
import { messagingService } from "@/frontend/lib/messaging";
import { getSuggestedReadingType } from "@/frontend/lib/glucose-suggestions";
import {
  READING_TYPES,
  READING_LABELS,
  QUICK_FOOD_OPTIONS,
  type QuickFoodOptionId,
  type ReadingType,
  type GlucoseEntry,
} from "@/frontend/lib/types";
import { FoodContextSelector } from "@/frontend/components/food-context-selector";
import { getUserFriendlyError, getSuccessMessage, logDiagnostic } from "@/frontend/lib/user-messages";
import { getLocalDbService } from "@/db/client";
import { Capacitor } from "@capacitor/core";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/frontend/components/ui/select";

const schema = z.object({
  glucose: z.coerce.number().min(20, "Too low").max(800, "Too high"),
  reading_type: z.enum(READING_TYPES),
  date_time: z
    .string()
    .min(1, "Required")
    .refine((val) => {
      return new Date(val) <= new Date();
    }, "Future dates are not allowed"),
  food: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  insulin_all_day: z.string().max(500).optional(),
});
type FormData = z.output<typeof schema>;
type FormInput = z.input<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry?: GlucoseEntry | null;
  onSaved?: () => void;
}

export function GlucoseDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isSuggested, setIsSuggested] = useState(false);
  const [foodOptions, setFoodOptions] = useState<QuickFoodOptionId[]>([]);
  const isSubmittingRef = useRef(false);
  const stableCreateIdRef = useRef<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const form = useForm<FormInput, unknown, FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      glucose: "" as unknown as number,
      reading_type: "BB",
      date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      food: "",
      notes: "",
      insulin_all_day: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (entry) {
        setIsSuggested(false);
        stableCreateIdRef.current = null;
        idempotencyKeyRef.current = null;
        // Pre-populate any existing quick food options matched in food field
        const existingOptions: QuickFoodOptionId[] = [];
        if (entry.food) {
          for (const opt of QUICK_FOOD_OPTIONS) {
            if (
              entry.food.includes(opt.label) ||
              entry.food.toLowerCase().includes(opt.id.replace(/_/g, " "))
            ) {
              existingOptions.push(opt.id);
            }
          }
        }
        setFoodOptions(existingOptions);

        form.reset({
          glucose: entry.glucose,
          reading_type: entry.reading_type,
          date_time: format(new Date(entry.date_time), "yyyy-MM-dd'T'HH:mm"),
          food: entry.food ?? "",
          notes: entry.notes ?? "",
          insulin_all_day: entry.symptoms ?? "",
        });
      } else {
        const suggestedType = getSuggestedReadingType(new Date());
        setIsSuggested(true);
        setFoodOptions([]);

        // Generate stable logical ID and idempotency key for new create operation
        if (!stableCreateIdRef.current) {
          stableCreateIdRef.current =
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `gluc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
        if (!idempotencyKeyRef.current && user) {
          idempotencyKeyRef.current = idempotencyService.generateKey(
            user.id,
            "glucose",
            stableCreateIdRef.current,
          );
        }

        form.reset({
          glucose: "" as unknown as number,
          reading_type: suggestedType,
          date_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          food: "",
          notes: "",
          insulin_all_day: "",
        });
      }
    } else {
      isSubmittingRef.current = false;
    }
  }, [open, entry, user]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;

    // Concurrency double-click guard: synchronously prevent duplicate execution
    if (isSubmittingRef.current) {
      console.warn("[GLUCOSE_DIALOG] Duplicate submit blocked by submission guard.");
      return;
    }
    isSubmittingRef.current = true;
    setSaving(true);

    try {
      // Build food string combining quick chips and custom food text
      let foodString = data.food ? data.food.trim() : "";
      const selectedCategoryLabels = foodOptions
        .map((id) => QUICK_FOOD_OPTIONS.find((o) => o.id === id)?.label)
        .filter(Boolean) as string[];

      if (selectedCategoryLabels.length > 0) {
        const categoriesJoined = selectedCategoryLabels.join("; ");
        foodString = foodString ? `${categoriesJoined} · ${foodString}` : categoriesJoined;
      }

      let savedRecord: any = null;

      if (entry) {
        // Strict UPDATE: Must have existing ID, never falls back to insert
        const res = await healthService.updateGlucoseEntry(entry.id, {
          glucose: data.glucose,
          reading_type: data.reading_type,
          date_time: new Date(data.date_time).toISOString(),
          food: foodString || null,
          notes: data.notes || null,
          symptoms: data.insulin_all_day || null,
        });
        savedRecord = res.data;
      } else {
        // Strict CREATE with Idempotency
        const createId =
          stableCreateIdRef.current ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `gluc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

        const idemKey =
          idempotencyKeyRef.current ||
          idempotencyService.generateKey(user.id, "glucose", createId);

        const res = await healthService.createGlucoseEntry(
          {
            id: createId,
            glucose: data.glucose,
            reading_type: data.reading_type,
            date_time: new Date(data.date_time).toISOString(),
            food: foodString || null,
            notes: data.notes || null,
            symptoms: data.insulin_all_day || null,
          },
          idemKey,
        );
        savedRecord = res.data;

        // Reset create tokens upon verified success
        stableCreateIdRef.current = null;
        idempotencyKeyRef.current = null;
      }

      const activeRecordId = savedRecord?.id || entry?.id;

      // Link food context record into food_entries if food categories were logged
      const hasFoodItems = foodOptions.some((id) => id !== "no_unusual_food");
      if (hasFoodItems && selectedCategoryLabels.length > 0) {
        const isUncertain = foodOptions.includes("not_sure");
        const foodPayload = {
          user_id: user.id,
          food_categories: selectedCategoryLabels,
          portion_category: "unspecified",
          meal_period: data.reading_type,
          date_time: new Date(data.date_time).toISOString(),
          notes: data.food || null,
          is_uncertain: isUncertain,
          glucose_entry_id: activeRecordId || null,
        };

        try {
          if (entry) {
            await supabase
              .from("food_entries")
              .delete()
              .eq("glucose_entry_id", entry.id)
              .eq("user_id", user.id);
          }
          await supabase.from("food_entries").insert(foodPayload);

          if (Capacitor.isNativePlatform()) {
            const localDb = await getLocalDbService();
            await localDb.cacheFood([
              {
                id: "food_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
                ...foodPayload,
                sync_status: "synced",
              },
            ]);
          }
        } catch (err) {
          console.warn("[GLUCOSE_DIALOG] Failed to sync food entry:", err);
        }
      } else if (foodOptions.includes("no_unusual_food") && entry) {
        try {
          await supabase
            .from("food_entries")
            .delete()
            .eq("glucose_entry_id", entry.id)
            .eq("user_id", user.id);
        } catch {}
      }

      const isUpdate = Boolean(entry);
      const typeLabel = READING_LABELS[data.reading_type] || data.reading_type;

      // If it's a new reading, send SMS alert if phone is present
      if (!isUpdate) {
        try {
          const p = await healthService.getProfile();
          if (p.data?.phone) {
            await messagingService.sendGlucoseAlert(p.data.phone, {
              glucose: data.glucose,
              type: data.reading_type,
              date: format(new Date(data.date_time), "MMM d, HH:mm"),
              notes: data.notes || null,
            });
          }
        } catch (err) {
          console.error("[GLUCOSE_DIALOG] Error fetching profile for alert:", err);
        }
      }

      if (data.glucose < 70) {
        toast.error(`🚨 LOW SUGAR WARNING: ${data.glucose} mg/dL`, {
          description: "Reading is LOW! Please consume 15g of fast-acting sugar immediately.",
          duration: 15000,
        });
      } else if (data.glucose > 180) {
        toast.warning(`⚠️ HIGH SUGAR ALERT: ${data.glucose} mg/dL`, {
          description: "Reading exceeds target range (180 mg/dL). Consider checking insulin or drinking water.",
          duration: 15000,
        });
      } else {
        toast.success(getSuccessMessage(isUpdate ? "glucose_updated" : "glucose_saved"));
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      logDiagnostic("glucose-dialog", e);
      toast.error(getUserFriendlyError(e, "glucose"));
      // Form data is preserved in form state so user does not lose input
    } finally {
      setSaving(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {entry ? "Edit Glucose Reading" : "Add Glucose Reading"}
          </DialogTitle>
          {entry && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Editing reading from {format(new Date(entry.date_time), "MMM d, yyyy · HH:mm")}
            </p>
          )}
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="glucose">Glucose (mg/dL)</Label>
              <Input
                id="glucose"
                type="number"
                inputMode="numeric"
                step="1"
                {...form.register("glucose")}
              />
              {form.formState.errors.glucose && (
                <p className="text-xs text-destructive">{form.formState.errors.glucose.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Reading type</Label>
                {isSuggested && !entry && (
                  <span className="text-[10px] text-primary font-medium tracking-tight bg-primary/10 px-2 py-0.5 rounded-full animate-fade-in flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Suggested
                  </span>
                )}
              </div>
              <Select
                value={form.watch("reading_type")}
                onValueChange={(v) => {
                  form.setValue("reading_type", v as ReadingType);
                  setIsSuggested(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {READING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} — {READING_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isSuggested && !entry && (
                <p className="text-[11px] text-muted-foreground/80 leading-tight">
                  Suggested based on current time
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="date_time">Date & time</Label>
              <button
                type="button"
                onClick={() => form.setValue("date_time", format(new Date(), "yyyy-MM-dd'T'HH:mm"))}
                className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Set to Now
              </button>
            </div>
            <Input
              id="date_time"
              type="datetime-local"
              max={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              {...form.register("date_time")}
            />
            {form.formState.errors.date_time && (
              <p className="text-xs text-destructive">{form.formState.errors.date_time.message}</p>
            )}
          </div>

          <FoodContextSelector selected={foodOptions} onChange={setFoodOptions} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="food">Additional food notes</Label>
              <Input id="food" placeholder="e.g. Oatmeal, fruit" {...form.register("food")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insulin_all_day">All-day Insulin</Label>
              <Input
                id="insulin_all_day"
                placeholder="e.g. 20u Lantus"
                {...form.register("insulin_all_day")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : entry ? (
                "Update reading"
              ) : (
                "Save reading"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
