import React, { useState } from "react";
import {
  Droplet,
  Pill,
  Utensils,
  GlassWater,
  FileBarChart2,
  Plus,
  Trash2,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Switch } from "@/frontend/components/ui/switch";
import { Button } from "@/frontend/components/ui/button";
import type {
  PatientNotificationSettings,
  GlucoseSlotConfig,
  MedicationSlotConfig,
  MealSlotConfig,
  ReadingSlotType,
} from "../types";

const WEEKDAYS = [
  { day: 1, label: "S" },
  { day: 2, label: "M" },
  { day: 3, label: "T" },
  { day: 4, label: "W" },
  { day: 5, label: "T" },
  { day: 6, label: "F" },
  { day: 7, label: "S" },
];

const READING_TYPES_OPTIONS: { type: ReadingSlotType; label: string }[] = [
  { type: "BB", label: "Before Breakfast" },
  { type: "AB", label: "After Breakfast" },
  { type: "BL", label: "Before Lunch" },
  { type: "AL", label: "After Lunch" },
  { type: "BD", label: "Before Dinner" },
  { type: "AD", label: "After Dinner" },
  { type: "BT", label: "Bedtime" },
  { type: "Fasting", label: "Fasting" },
];

interface Props {
  settings: PatientNotificationSettings;
  onChange: (updated: PatientNotificationSettings) => void;
}

export function CategoryCards({ settings, onChange }: Props) {
  const [expandedCat, setExpandedCat] = useState<string | null>("glucose");

  const toggleExpand = (cat: string) => {
    setExpandedCat((prev) => (prev === cat ? null : cat));
  };

  // Toggle weekday for a slot
  const toggleWeekday = (currentWeekdays: number[], day: number): number[] => {
    if (currentWeekdays.includes(day)) {
      if (currentWeekdays.length === 1) return currentWeekdays; // Keep at least 1 day
      return currentWeekdays.filter((d) => d !== day);
    }
    return [...currentWeekdays, day].sort((a, b) => a - b);
  };

  // 1. Glucose Handlers
  const handleGlucoseMasterToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      glucose: { ...settings.glucose, enabled },
    });
  };

  const handleUpdateGlucoseSlot = (index: number, partial: Partial<GlucoseSlotConfig>) => {
    const newSlots = [...settings.glucose.slots];
    newSlots[index] = { ...newSlots[index], ...partial };
    onChange({
      ...settings,
      glucose: { ...settings.glucose, slots: newSlots },
    });
  };

  const handleAddGlucoseSlot = () => {
    const newSlot: GlucoseSlotConfig = {
      id: `custom_${Date.now()}`,
      label: "Custom Reminder",
      time: "16:00",
      enabled: true,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      readingType: "AB",
    };
    onChange({
      ...settings,
      glucose: {
        ...settings.glucose,
        slots: [...settings.glucose.slots, newSlot],
      },
    });
  };

  const handleRemoveGlucoseSlot = (index: number) => {
    const newSlots = settings.glucose.slots.filter((_, i) => i !== index);
    onChange({
      ...settings,
      glucose: { ...settings.glucose, slots: newSlots },
    });
  };

  // 2. Medication Handlers
  const handleMedicationMasterToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      medication: { ...settings.medication, enabled },
    });
  };

  const handleUpdateMedicationSlot = (index: number, partial: Partial<MedicationSlotConfig>) => {
    const newSlots = [...settings.medication.slots];
    newSlots[index] = { ...newSlots[index], ...partial };
    onChange({
      ...settings,
      medication: { ...settings.medication, slots: newSlots },
    });
  };

  // 3. Meal Handlers
  const handleMealMasterToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      meals: { ...settings.meals, enabled },
    });
  };

  const handleUpdateMealSlot = (index: number, partial: Partial<MealSlotConfig>) => {
    const newSlots = [...settings.meals.slots];
    newSlots[index] = { ...newSlots[index], ...partial };
    onChange({
      ...settings,
      meals: { ...settings.meals, slots: newSlots },
    });
  };

  // 4. Hydration Handlers
  const handleHydrationMasterToggle = (enabled: boolean) => {
    onChange({
      ...settings,
      hydration: { ...settings.hydration, enabled },
    });
  };

  // 5. Summary Handlers
  const handleDailySummaryToggle = (dailyEnabled: boolean) => {
    onChange({
      ...settings,
      summaries: { ...settings.summaries, dailyEnabled },
    });
  };

  const handleWeeklySummaryToggle = (weeklyEnabled: boolean) => {
    onChange({
      ...settings,
      summaries: { ...settings.summaries, weeklyEnabled },
    });
  };

  return (
    <div className="space-y-4">
      {/* CATEGORY 1: Blood Glucose Reminders */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-3 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => toggleExpand("glucose")}
          >
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <Droplet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Blood Glucose Reminders
                </h3>
                {settings.glucose.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Configurable fasting, meal-based &amp; bedtime measurement alerts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <Switch
              checked={settings.glucose.enabled}
              onCheckedChange={handleGlucoseMasterToggle}
            />
            <button
              onClick={() => toggleExpand("glucose")}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {expandedCat === "glucose" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expandedCat === "glucose" && (
          <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
            <div className="space-y-2.5">
              {settings.glucose.slots.map((slot, index) => (
                <div
                  key={slot.id || index}
                  className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={slot.label}
                        onChange={(e) => handleUpdateGlucoseSlot(index, { label: e.target.value })}
                        className="text-xs font-bold bg-transparent border-b border-dashed border-border/80 focus:outline-none focus:border-primary"
                      />
                      <select
                        value={slot.readingType}
                        onChange={(e) =>
                          handleUpdateGlucoseSlot(index, { readingType: e.target.value as ReadingSlotType })
                        }
                        className="text-[11px] font-semibold bg-muted/60 px-2 py-1 rounded-lg border border-border/60 focus:outline-none"
                      >
                        {READING_TYPES_OPTIONS.map((opt) => (
                          <option key={opt.type} value={opt.type}>
                            {opt.label} ({opt.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => handleUpdateGlucoseSlot(index, { time: e.target.value })}
                        className="bg-background border border-border/80 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                      <Switch
                        checked={slot.enabled}
                        onCheckedChange={(checked) => handleUpdateGlucoseSlot(index, { enabled: checked })}
                      />
                      {settings.glucose.slots.length > 1 && (
                        <button
                          onClick={() => handleRemoveGlucoseSlot(index)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Weekday Chips */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground mr-1">Repeat:</span>
                    {WEEKDAYS.map((wd) => {
                      const isSelected = slot.weekdays?.includes(wd.day);
                      return (
                        <button
                          key={wd.day}
                          type="button"
                          onClick={() =>
                            handleUpdateGlucoseSlot(index, {
                              weekdays: toggleWeekday(slot.weekdays || [1, 2, 3, 4, 5, 6, 7], wd.day),
                            })
                          }
                          className={`h-6 w-6 rounded-md text-[10px] font-bold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {wd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddGlucoseSlot}
              className="w-full rounded-xl text-xs font-bold gap-1.5 border-dashed"
            >
              <Plus className="h-3.5 w-3.5" /> Add Glucose Reminder Time
            </Button>
          </div>
        )}
      </div>

      {/* CATEGORY 2: Medication & Insulin Reminders */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-3 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => toggleExpand("medication")}
          >
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Medication &amp; Insulin Reminders
                </h3>
                {settings.medication.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Clinical dose schedules with drawer "Taken" confirmations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <Switch
              checked={settings.medication.enabled}
              onCheckedChange={handleMedicationMasterToggle}
            />
            <button
              onClick={() => toggleExpand("medication")}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {expandedCat === "medication" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expandedCat === "medication" && (
          <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
            <p className="text-xs text-muted-foreground leading-relaxed bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
              Synchronized with your Clinical Insulin Schedule. Tapping <strong>"Taken"</strong> from notifications records your dose safely with duplicate-submission protection.
            </p>

            <div className="space-y-2.5">
              {settings.medication.slots.map((slot, index) => (
                <div
                  key={slot.id || index}
                  className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold">{slot.label}</h4>
                      <p className="text-[11px] text-muted-foreground capitalize">{slot.id} Slot</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => handleUpdateMedicationSlot(index, { time: e.target.value })}
                        className="bg-background border border-border/80 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                      <Switch
                        checked={slot.enabled}
                        onCheckedChange={(checked) => handleUpdateMedicationSlot(index, { enabled: checked })}
                      />
                    </div>
                  </div>

                  {/* Weekday Chips */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground mr-1">Repeat:</span>
                    {WEEKDAYS.map((wd) => {
                      const isSelected = slot.weekdays?.includes(wd.day);
                      return (
                        <button
                          key={wd.day}
                          type="button"
                          onClick={() =>
                            handleUpdateMedicationSlot(index, {
                              weekdays: toggleWeekday(slot.weekdays || [1, 2, 3, 4, 5, 6, 7], wd.day),
                            })
                          }
                          className={`h-6 w-6 rounded-md text-[10px] font-bold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {wd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY 3: Meal & Nutrition Reminders */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-3 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => toggleExpand("meals")}
          >
            <div className="h-10 w-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Meal &amp; Nutrition Reminders
                </h3>
                {settings.meals.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Mealtime prompts that open directly into glucose/meal logging
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <Switch
              checked={settings.meals.enabled}
              onCheckedChange={handleMealMasterToggle}
            />
            <button
              onClick={() => toggleExpand("meals")}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {expandedCat === "meals" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expandedCat === "meals" && (
          <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
            <div className="space-y-2.5">
              {settings.meals.slots.map((slot, index) => (
                <div
                  key={slot.id || index}
                  className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold">{slot.label}</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.time}
                        onChange={(e) => handleUpdateMealSlot(index, { time: e.target.value })}
                        className="bg-background border border-border/80 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                      <Switch
                        checked={slot.enabled}
                        onCheckedChange={(checked) => handleUpdateMealSlot(index, { enabled: checked })}
                      />
                    </div>
                  </div>

                  {/* Weekday Chips */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-muted-foreground mr-1">Repeat:</span>
                    {WEEKDAYS.map((wd) => {
                      const isSelected = slot.weekdays?.includes(wd.day);
                      return (
                        <button
                          key={wd.day}
                          type="button"
                          onClick={() =>
                            handleUpdateMealSlot(index, {
                              weekdays: toggleWeekday(slot.weekdays || [1, 2, 3, 4, 5, 6, 7], wd.day),
                            })
                          }
                          className={`h-6 w-6 rounded-md text-[10px] font-bold transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {wd.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY 4: Hydration Reminders */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-3 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => toggleExpand("hydration")}
          >
            <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
              <GlassWater className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Hydration Reminders
                </h3>
                {settings.hydration.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Periodic daytime water prompts with frequency limits
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <Switch
              checked={settings.hydration.enabled}
              onCheckedChange={handleHydrationMasterToggle}
            />
            <button
              onClick={() => toggleExpand("hydration")}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {expandedCat === "hydration" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expandedCat === "hydration" && (
          <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Start Time
                </label>
                <input
                  type="time"
                  value={settings.hydration.startTime || "08:00"}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      hydration: { ...settings.hydration, startTime: e.target.value },
                    })
                  }
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" /> End Time
                </label>
                <input
                  type="time"
                  value={settings.hydration.endTime || "20:00"}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      hydration: { ...settings.hydration, endTime: e.target.value },
                    })
                  }
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs font-bold"
                />
              </div>
            </div>

            {/* Interval Selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase">
                Reminder Interval
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[60, 90, 120, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...settings,
                        hydration: { ...settings.hydration, intervalMinutes: mins },
                      })
                    }
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      (settings.hydration.intervalMinutes || 120) === mins
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    {mins / 60}h
                  </button>
                ))}
              </div>
            </div>

            {/* Daily limit */}
            <div className="flex items-center justify-between bg-muted/30 border border-border/60 rounded-xl p-3">
              <div>
                <span className="text-xs font-bold">Daily Notification Cap</span>
                <p className="text-[11px] text-muted-foreground">Maximum hydration prompts per day</p>
              </div>
              <select
                value={settings.hydration.dailyLimit || 6}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    hydration: { ...settings.hydration, dailyLimit: Number(e.target.value) },
                  })
                }
                className="bg-background text-xs font-bold px-2.5 py-1 rounded-lg border border-border focus:outline-none"
              >
                {[4, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} alerts
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY 5: Daily & Weekly Summaries */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-3 transition-all duration-200">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => toggleExpand("summaries")}
          >
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-foreground">
                  Daily &amp; Weekly Summaries
                </h3>
                {(settings.summaries.dailyEnabled || settings.summaries.weeklyEnabled) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Health tracking completeness and average glucose reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-2">
            <button
              onClick={() => toggleExpand("summaries")}
              className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
            >
              {expandedCat === "summaries" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expandedCat === "summaries" && (
          <div className="pt-3 border-t border-border/60 space-y-3 animate-fade-in">
            {/* Daily Summary */}
            <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold">Daily Health Summary</h4>
                  <p className="text-[11px] text-muted-foreground">Evening review of today's readings and doses</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={settings.summaries.dailyTime || "21:00"}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        summaries: { ...settings.summaries, dailyTime: e.target.value },
                      })
                    }
                    className="bg-background border border-border/80 rounded-lg px-2 py-1 text-xs font-bold"
                  />
                  <Switch
                    checked={settings.summaries.dailyEnabled}
                    onCheckedChange={handleDailySummaryToggle}
                  />
                </div>
              </div>
            </div>

            {/* Weekly Summary */}
            <div className="bg-muted/30 border border-border/60 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold">Weekly Management Review</h4>
                  <p className="text-[11px] text-muted-foreground">7-day tracking completeness and trend insights</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={settings.summaries.weeklyTime || "18:00"}
                    onChange={(e) =>
                      onChange({
                        ...settings,
                        summaries: { ...settings.summaries, weeklyTime: e.target.value },
                      })
                    }
                    className="bg-background border border-border/80 rounded-lg px-2 py-1 text-xs font-bold"
                  />
                  <Switch
                    checked={settings.summaries.weeklyEnabled}
                    onCheckedChange={handleWeeklySummaryToggle}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
