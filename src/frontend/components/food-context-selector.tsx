import { QUICK_FOOD_OPTIONS, type QuickFoodOptionId } from "@/frontend/lib/types";
import { cn } from "@/frontend/lib/utils";
import { Check, Utensils, Coffee, Cake, PartyPopper, Store, Ban, HelpCircle } from "lucide-react";

interface FoodContextSelectorProps {
  selected: QuickFoodOptionId[];
  onChange: (selected: QuickFoodOptionId[]) => void;
}

const OPTION_ICONS: Record<QuickFoodOptionId, React.ComponentType<{ className?: string }>> = {
  sweets_mithai: Cake,
  sugary_drinks: Coffee,
  large_carb_meal: Utensils,
  festival_meal: PartyPopper,
  fast_food: Store,
  no_unusual_food: Ban,
  not_sure: HelpCircle,
};

export function FoodContextSelector({ selected, onChange }: FoodContextSelectorProps) {
  const toggleOption = (id: QuickFoodOptionId) => {
    const isExclusive = id === "no_unusual_food" || id === "not_sure";

    if (isExclusive) {
      // If toggling an exclusive option that is already selected, unselect it
      if (selected.includes(id)) {
        onChange([]);
      } else {
        // Otherwise, replace everything with this exclusive option
        onChange([id]);
      }
    } else {
      // Normal food item
      if (selected.includes(id)) {
        onChange(selected.filter((item) => item !== id));
      } else {
        // Add food item, filtering out any exclusive options ("no_unusual_food" and "not_sure")
        const filtered = selected.filter((item) => item !== "no_unusual_food" && item !== "not_sure");
        onChange([...filtered, id]);
      }
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-3.5 sm:p-4">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Utensils className="h-3.5 w-3.5 text-primary" />
            Food details (Optional)
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Did you have any of these foods or drinks recently?
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        {QUICK_FOOD_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const Icon = OPTION_ICONS[opt.id];
          const isExclusive = opt.id === "no_unusual_food" || opt.id === "not_sure";

          return (
            <button
              type="button"
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              aria-pressed={isSelected}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                "min-h-[44px]", // Accessible touch target
                isSelected
                  ? isExclusive
                    ? "border-muted-foreground/40 bg-muted/80 text-foreground font-semibold shadow-xs"
                    : "border-primary/60 bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors",
                  isSelected
                    ? isExclusive
                      ? "bg-muted-foreground/20 text-foreground"
                      : "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground group-hover:text-foreground"
                )}
              >
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="flex-1 leading-snug line-clamp-2">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
