import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Switch } from "@/frontend/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import type { Reminder, ReminderCategory, ScheduleType, ScheduleData, ReminderData } from "../types";
import { useReminders } from "../providers/ReminderProvider";
import { reminderService } from "../services/reminderService";
import { useAuth } from "@/frontend/lib/auth-context";
import { toast } from "sonner";
import { Plus, Trash, Clock, AlertCircle } from "lucide-react";

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder?: Reminder | null; // If provided, we are in Edit Mode
}

const CATEGORIES: { value: ReminderCategory; label: string; icon: string }[] = [
  { value: "insulin", label: "💉 Insulin Reminder", icon: "💉" },
  { value: "medication", label: "💊 Oral Medication", icon: "💊" },
  { value: "glucose", label: "🩸 Glucose Check", icon: "🩸" },
  { value: "water", label: "💧 Water Hydration", icon: "💧" },
  { value: "meal", label: "🥗 Meal Reminder", icon: "🥗" },
  { value: "exercise", label: "🏃 Workout / Exercise", icon: "🏃" },
  { value: "sleep", label: "😴 Sleep / Bedtime", icon: "😴" },
  { value: "appointment", label: "📅 Doctor Appointment", icon: "📅" },
  { value: "lab_test", label: "🔬 Lab Test Checkup", icon: "🔬" },
  { value: "supply", label: "📦 Supply Inventory", icon: "📦" },
];

const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Every Day" },
  { value: "weekly", label: "Weekly" },
  { value: "custom_days", label: "Specific Weekdays" },
  { value: "interval", label: "Repeating Interval" },
  { value: "one_time", label: "One-time Alert" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const SOUNDS = [
  { value: "default", label: "Default Notification Tone" },
  { value: "chimes", label: "Soft Chimes Accent" },
  { value: "alert", label: "Urgent Medical Alert" },
];

export function ReminderDialog({ open, onOpenChange, reminder }: ReminderDialogProps) {
  const { user } = useAuth();
  const { refreshReminders, triggerScheduler } = useReminders();

  // Basic Details
  const [category, setCategory] = useState<ReminderCategory>("medication");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [sound, setSound] = useState("default");
  const [vibrate, setVibrate] = useState(true);

  // Scheduling Details
  const [scheduleType, setScheduleType] = useState<ScheduleType>("daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [newTime, setNewTime] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalMinutes, setIntervalMinutes] = useState(120);
  const [intervalStart, setIntervalStart] = useState("08:00");
  const [intervalEnd, setIntervalEnd] = useState("22:00");
  const [oneTimeDate, setOneTimeDate] = useState("");

  // Category specific details
  const [dosage, setDosage] = useState("");
  const [unit, setUnit] = useState("units");
  const [medName, setMedName] = useState("");
  const [mealType, setMealType] = useState<any>("any");
  const [exerciseType, setExerciseType] = useState("");
  const [waterMl, setWaterMl] = useState(250);
  const [doctorName, setDoctorName] = useState("");
  const [location, setLocation] = useState("");
  const [supplyThreshold, setSupplyThreshold] = useState(10);
  const [supplyQuantity, setSupplyQuantity] = useState(50);
  const [supplyItemName, setSupplyItemName] = useState("");

  // Populate form if editing
  useEffect(() => {
    if (reminder) {
      setCategory(reminder.category);
      setTitle(reminder.title);
      setDescription(reminder.description || "");
      setIsEnabled(reminder.is_enabled);
      setSound(reminder.sound);
      setVibrate(reminder.vibrate);
      setScheduleType(reminder.schedule_type);

      const sData = reminder.schedule_data;
      setTimes(sData.times || ["08:00"]);
      setSelectedDays(sData.days || []);
      setIntervalMinutes(sData.intervalMinutes || 120);
      setIntervalStart(sData.intervalStart || "08:00");
      setIntervalEnd(sData.intervalEnd || "22:00");
      setOneTimeDate(sData.date || "");

      const rData = reminder.reminder_data;
      setDosage(rData.dosage || "");
      setUnit(rData.unit || "units");
      setMedName(rData.medicine_name || "");
      setMealType(rData.meal_type || "any");
      setExerciseType(rData.exercise_type || "");
      setWaterMl(rData.target_water_ml || 250);
      setDoctorName(rData.doctor_name || "");
      setLocation(rData.location || "");
      setSupplyThreshold(rData.threshold_quantity || 10);
      setSupplyQuantity(rData.current_quantity || 50);
      setSupplyItemName(rData.item_name || "");
    } else {
      // Default reset
      setCategory("medication");
      setTitle("");
      setDescription("");
      setIsEnabled(true);
      setSound("default");
      setVibrate(true);
      setScheduleType("daily");
      setTimes(["08:00"]);
      setSelectedDays([]);
      setIntervalMinutes(120);
      setIntervalStart("08:00");
      setIntervalEnd("22:00");
      setOneTimeDate("");
      setDosage("");
      setUnit("units");
      setMedName("");
      setMealType("any");
      setExerciseType("");
      setWaterMl(250);
      setDoctorName("");
      setLocation("");
      setSupplyThreshold(10);
      setSupplyQuantity(50);
      setSupplyItemName("");
    }
  }, [reminder, open]);

  // Adjust defaults based on category choice
  const handleCategoryChange = (val: ReminderCategory) => {
    setCategory(val);
    if (!reminder) {
      if (val === "insulin") {
        setTitle("Morning Insulin");
        setUnit("units");
        setDosage("10");
        setTimes(["08:00"]);
      } else if (val === "medication") {
        setTitle("Oral Medication");
        setUnit("mg");
        setDosage("500");
        setTimes(["08:00"]);
      } else if (val === "glucose") {
        setTitle("Fasting Glucose Check");
        setTimes(["07:30"]);
        setMealType("fasting");
      } else if (val === "water") {
        setTitle("Hydration Alert");
        setScheduleType("interval");
        setIntervalMinutes(120);
      } else if (val === "exercise") {
        setTitle("Daily Walk / Workout");
        setTimes(["18:00"]);
      } else if (val === "appointment") {
        setTitle("Endocrinologist Visit");
        setScheduleType("one_time");
      }
    }
  };

  const handleAddTime = () => {
    if (newTime && !times.includes(newTime)) {
      setTimes([...times, newTime].sort());
      setNewTime("");
    }
  };

  const handleRemoveTime = (index: number) => {
    if (times.length > 1) {
      setTimes(times.filter((_, i) => i !== index));
    } else {
      toast.error("At least one schedule time is required.");
    }
  };

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast.error("Please enter a reminder title.");
      return;
    }

    const schedule_data: ScheduleData = {};
    if (scheduleType === "interval") {
      schedule_data.intervalMinutes = Number(intervalMinutes);
      schedule_data.intervalStart = intervalStart;
      schedule_data.intervalEnd = intervalEnd;
    } else if (scheduleType === "one_time") {
      if (!oneTimeDate) {
        toast.error("Please specify the date.");
        return;
      }
      schedule_data.date = oneTimeDate;
      schedule_data.times = times;
    } else {
      schedule_data.times = times;
      if (scheduleType === "weekly" || scheduleType === "custom_days") {
        if (selectedDays.length === 0) {
          toast.error("Please select at least one day.");
          return;
        }
        schedule_data.days = selectedDays;
      }
    }

    const reminder_data: ReminderData = {};
    if (category === "insulin" || category === "medication") {
      reminder_data.dosage = dosage;
      reminder_data.unit = unit;
      if (category === "medication") reminder_data.medicine_name = medName;
    } else if (category === "glucose") {
      reminder_data.meal_type = mealType;
    } else if (category === "water") {
      reminder_data.target_water_ml = Number(waterMl);
    } else if (category === "exercise") {
      reminder_data.exercise_type = exerciseType;
    } else if (category === "appointment" || category === "lab_test") {
      reminder_data.doctor_name = doctorName;
      reminder_data.location = location;
    } else if (category === "supply") {
      reminder_data.item_name = supplyItemName;
      reminder_data.threshold_quantity = Number(supplyThreshold);
      reminder_data.current_quantity = Number(supplyQuantity);
    }

    try {
      if (reminder) {
        // Edit Mode
        await reminderService.updateReminder(reminder.id, {
          category,
          title,
          description,
          is_enabled: isEnabled,
          schedule_type: scheduleType,
          schedule_data,
          reminder_data,
          sound,
          vibrate,
          sync_status: "pending_sync",
        });
        toast.success("Reminder updated successfully.");
      } else {
        // Create Mode
        await reminderService.createReminder({
          user_id: user.id,
          category,
          title,
          description,
          is_enabled: isEnabled,
          schedule_type: scheduleType,
          schedule_data,
          reminder_data,
          sound,
          vibrate,
          sync_status: "pending_sync",
        });
        toast.success("Reminder configured successfully.");
      }

      await refreshReminders();
      await triggerScheduler();
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save reminder.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-5 bg-card border border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">
            {reminder ? "Edit Reminder" : "Configure New Reminder"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure alarms, schedules, and custom tracking options.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 my-2 text-sm">
          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="category" className="font-semibold">Reminder Category</Label>
            <Select value={category} onValueChange={(v) => handleCategoryChange(v as ReminderCategory)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="rounded-lg">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="font-semibold">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lantus Insulin Dose"
              className="h-10 rounded-xl"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="font-semibold">Instruction / Note (Optional)</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Take with warm food"
              className="h-10 rounded-xl"
            />
          </div>

          {/* Category Specific Configs */}
          {category === "insulin" && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dosage</Label>
                <Input
                  type="number"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="10"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="units"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          )}

          {category === "medication" && (
            <div className="space-y-3 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Medicine Name</Label>
                <Input
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Metformin"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Dosage</Label>
                  <Input
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="500"
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Unit</Label>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="mg"
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {category === "glucose" && (
            <div className="space-y-1.5 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <Label className="text-xs font-semibold">Reading Period</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger className="h-9 rounded-lg bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="fasting" className="rounded-lg">Fasting</SelectItem>
                  <SelectItem value="before_breakfast" className="rounded-lg">Before Breakfast</SelectItem>
                  <SelectItem value="after_breakfast" className="rounded-lg">After Breakfast</SelectItem>
                  <SelectItem value="before_lunch" className="rounded-lg">Before Lunch</SelectItem>
                  <SelectItem value="after_lunch" className="rounded-lg">After Lunch</SelectItem>
                  <SelectItem value="before_dinner" className="rounded-lg">Before Dinner</SelectItem>
                  <SelectItem value="after_dinner" className="rounded-lg">After Dinner</SelectItem>
                  <SelectItem value="bedtime" className="rounded-lg">Bedtime</SelectItem>
                  <SelectItem value="any" className="rounded-lg">Custom Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {category === "water" && (
            <div className="space-y-1.5 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <Label className="text-xs font-semibold">Volume per Reminder (ml)</Label>
              <Input
                type="number"
                value={waterMl}
                onChange={(e) => setWaterMl(Number(e.target.value))}
                placeholder="250"
                className="h-9 rounded-lg"
              />
            </div>
          )}

          {category === "exercise" && (
            <div className="space-y-1.5 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <Label className="text-xs font-semibold">Exercise Details</Label>
              <Input
                value={exerciseType}
                onChange={(e) => setExerciseType(e.target.value)}
                placeholder="Walking, Jogging, Yoga, Gym"
                className="h-9 rounded-lg"
              />
            </div>
          )}

          {(category === "appointment" || category === "lab_test") && (
            <div className="space-y-3 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Doctor / Provider Name</Label>
                <Input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Dr. Vivek Dhedhi"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Location / Hospital</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Cardiology Clinic"
                  className="h-9 rounded-lg"
                />
              </div>
            </div>
          )}

          {category === "supply" && (
            <div className="space-y-3 p-3 bg-muted/40 rounded-2xl border border-border/50">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supply Item Name</Label>
                <Input
                  value={supplyItemName}
                  onChange={(e) => setSupplyItemName(e.target.value)}
                  placeholder="Glucose Strips"
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Current Count</Label>
                  <Input
                    type="number"
                    value={supplyQuantity}
                    onChange={(e) => setSupplyQuantity(Number(e.target.value))}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Alert Threshold</Label>
                  <Input
                    type="number"
                    value={supplyThreshold}
                    onChange={(e) => setSupplyThreshold(Number(e.target.value))}
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Schedule Settings */}
          <div className="space-y-3 p-3.5 bg-muted/40 rounded-2xl border border-border/40">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> Schedule Configuration
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Schedule Pattern</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleType)}>
                <SelectTrigger className="h-9 rounded-lg bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SCHEDULE_TYPES.map((st) => (
                    <SelectItem key={st.value} value={st.value} className="rounded-lg">
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {scheduleType === "interval" ? (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Repeat Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                    className="h-9 rounded-lg bg-card"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Start Time</Label>
                    <Input
                      type="time"
                      value={intervalStart}
                      onChange={(e) => setIntervalStart(e.target.value)}
                      className="h-9 rounded-lg bg-card"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">End Time</Label>
                    <Input
                      type="time"
                      value={intervalEnd}
                      onChange={(e) => setIntervalEnd(e.target.value)}
                      className="h-9 rounded-lg bg-card"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {/* One Time Date Selection */}
                {scheduleType === "one_time" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Alert Date</Label>
                    <Input
                      type="date"
                      value={oneTimeDate}
                      onChange={(e) => setOneTimeDate(e.target.value)}
                      className="h-9 rounded-lg bg-card"
                    />
                  </div>
                )}

                {/* Days of Week (Weekly / Custom Days) */}
                {(scheduleType === "weekly" || scheduleType === "custom_days") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Repeat Days</Label>
                    <div className="flex flex-wrap gap-1.5 justify-between">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => handleDayToggle(d.value)}
                          className={`h-8 w-10 text-xs font-bold rounded-lg border transition-all ${
                            selectedDays.includes(d.value)
                              ? "bg-primary border-primary text-primary-foreground shadow-soft"
                              : "bg-card border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Times List */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Alert Times</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {times.map((t, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-soft text-primary text-xs font-bold border border-primary/10">
                        {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTime(idx)}
                          className="hover:text-destructive transition-colors ml-0.5 text-[11px]"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="h-9 rounded-lg bg-card"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTime}
                      className="h-9 px-3 rounded-lg border-border hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sound & Vibrate Alerts */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-2xl border border-border/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alert Sound</Label>
              <Select value={sound} onValueChange={setSound}>
                <SelectTrigger className="h-8 rounded-lg bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SOUNDS.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="rounded-lg">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-center items-center gap-1">
              <Label className="text-xs font-semibold">Vibration</Label>
              <Switch checked={vibrate} onCheckedChange={setVibrate} className="mt-1" />
            </div>
          </div>

          {/* Switch: Is Enabled */}
          <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border/50">
            <div className="space-y-0.5">
              <Label className="font-semibold text-xs">Activate Reminder</Label>
              <p className="text-[10px] text-muted-foreground">Keep this reminder active</p>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <DialogFooter className="pt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-2xl"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-11 rounded-2xl gradient-primary text-white shadow-soft">
              {reminder ? "Save Changes" : "Create Reminder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
