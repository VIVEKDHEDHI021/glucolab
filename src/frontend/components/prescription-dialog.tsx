import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Badge } from "@/frontend/components/ui/badge";
import { prescriptionService, type PrescriptionSlotInput } from "@/services/prescriptionService";
import { toast } from "sonner";
import { Pill, Sun, Sunrise, Sunset, Moon, Coffee } from "lucide-react";

interface PrescriptionDialogProps {
  patientId: string;
  doctorId: string;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const TIME_SLOTS = [
  { id: "morning", label: "Morning", sublabel: "Before/After Breakfast", icon: Sunrise },
  { id: "lunch", label: "Lunch", sublabel: "Before/After Lunch", icon: Sun },
  { id: "afternoon", label: "Afternoon (Optional)", sublabel: "Mid-day dose", icon: Coffee },
  { id: "evening", label: "Evening", sublabel: "Before/After Dinner", icon: Sunset },
  { id: "night", label: "Night", sublabel: "Before Sleep", icon: Moon },
] as const;

export const PrescriptionDialog: React.FC<PrescriptionDialogProps> = ({
  patientId,
  doctorId,
  patientName,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [slots, setSlots] = useState<Record<string, { insulin_name: string; dose_units: string; instructions: string; remarks: string }>>({
    morning: { insulin_name: "", dose_units: "", instructions: "", remarks: "" },
    lunch: { insulin_name: "", dose_units: "", instructions: "", remarks: "" },
    afternoon: { insulin_name: "", dose_units: "", instructions: "", remarks: "" },
    evening: { insulin_name: "", dose_units: "", instructions: "", remarks: "" },
    night: { insulin_name: "", dose_units: "", instructions: "", remarks: "" },
  });

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSlotChange = (slotId: string, field: string, value: string) => {
    setSlots((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const items: PrescriptionSlotInput[] = TIME_SLOTS.map((slot) => {
        const val = slots[slot.id];
        return {
          time_slot: slot.id as any,
          insulin_name: val.insulin_name.trim(),
          dose_units: parseFloat(val.dose_units) || 0,
          instructions: val.instructions.trim(),
          remarks: val.remarks.trim(),
        };
      }).filter((item) => item.insulin_name !== "" && item.dose_units > 0);

      if (items.length === 0) {
        toast.error("Please add at least one valid insulin slot with name and dose > 0.");
        setLoading(false);
        return;
      }

      await prescriptionService.createOrReplacePrescription({
        patientId,
        doctorId,
        notes,
        items,
      });

      toast.success("Digital Insulin Prescription created successfully!");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to create prescription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display">Digital Insulin Prescription</DialogTitle>
              <DialogDescription className="text-xs">
                Patient: <span className="font-semibold text-foreground">{patientName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          <div className="space-y-4">
            {TIME_SLOTS.map((slot) => {
              const Icon = slot.icon;
              const slotData = slots[slot.id];

              return (
                <div key={slot.id} className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{slot.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{slot.sublabel}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Insulin Name</Label>
                      <Input
                        placeholder="e.g. NovoRapid / Humalog / Lantus"
                        value={slotData.insulin_name}
                        onChange={(e) => handleSlotChange(slot.id, "insulin_name", e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dose (Units)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        placeholder="e.g. 8"
                        value={slotData.dose_units}
                        onChange={(e) => handleSlotChange(slot.id, "dose_units", e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Instructions</Label>
                      <Input
                        placeholder="e.g. Before Breakfast / With Meals"
                        value={slotData.instructions}
                        onChange={(e) => handleSlotChange(slot.id, "instructions", e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Remarks (Optional)</Label>
                      <Input
                        placeholder="e.g. Inject subcutaneously"
                        value={slotData.remarks}
                        onChange={(e) => handleSlotChange(slot.id, "remarks", e.target.value)}
                        className="text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="doc-notes" className="text-xs font-semibold">Doctor Clinical Remarks / Notes</Label>
            <Textarea
              id="doc-notes"
              placeholder="Additional medical instructions or dietary advice..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? "Saving..." : "Issue Digital Prescription"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
