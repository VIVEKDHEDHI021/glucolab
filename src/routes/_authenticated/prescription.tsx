import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { prescriptionService, type FullPrescription, type PatientDoseLog } from "@/services/prescriptionService";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { toast } from "sonner";
import { Pill, CheckCircle, Sunrise, Sun, Coffee, Sunset, Moon, Clock, FileText, Stethoscope, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prescription")({
  component: PatientPrescriptionPage,
});

const SLOT_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  morning: { label: "Morning", icon: Sunrise, color: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  lunch: { label: "Lunch", icon: Sun, color: "text-orange-500 bg-orange-500/10 border-orange-500/20" },
  afternoon: { label: "Afternoon", icon: Coffee, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  evening: { label: "Evening", icon: Sunset, color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20" },
  night: { label: "Night", icon: Moon, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
};

function PatientPrescriptionPage() {
  const { user } = useAuth();
  const [activePrescription, setActivePrescription] = useState<FullPrescription | null>(null);
  const [history, setHistory] = useState<FullPrescription[]>([]);
  const [doseLogs, setDoseLogs] = useState<PatientDoseLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const active = await prescriptionService.getActivePrescription(user.id);
      const hist = await prescriptionService.getPrescriptionHistory(user.id);
      const logs = await prescriptionService.getTodayDoseLogs(user.id);

      setActivePrescription(active);
      setHistory(hist);
      setDoseLogs(logs);
    } catch (err: any) {
      toast.error(err.message || "Failed to load prescription");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLogDose = async (item: any) => {
    if (!user) return;
    try {
      await prescriptionService.logDoseTaken({
        patientId: user.id,
        prescriptionItemId: item.id,
        slot: item.time_slot,
      });

      toast.success(`Marked ${item.insulin_name} (${item.dose_units} Units) as taken!`);
      const updatedLogs = await prescriptionService.getTodayDoseLogs(user.id);
      setDoseLogs(updatedLogs);
    } catch (err: any) {
      toast.error(err.message || "Failed to record dose");
    }
  };

  const isDoseTakenToday = (itemId: string) => {
    return doseLogs.some((log) => log.prescription_item_id === itemId);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Digital Insulin Prescription</h1>
        <p className="text-sm text-muted-foreground">
          View active insulin schedule prescribed by your doctor and log daily doses
        </p>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="current" className="gap-2">
            <Pill className="h-4 w-4" />
            Current Prescription
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Revision History ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* Current Prescription Tab */}
        <TabsContent value="current" className="mt-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading prescription...</div>
          ) : !activePrescription ? (
            <Card className="rounded-2xl border-dashed p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Pill className="h-7 w-7" />
              </div>
              <CardTitle className="text-lg font-bold">No Active Digital Prescription</CardTitle>
              <CardDescription className="max-w-md mx-auto mt-1">
                Your doctor has not issued an active digital insulin schedule yet. Once your connected doctor issues a prescription, it will appear here.
              </CardDescription>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Doctor Details Banner */}
              <Card className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 shadow-sm">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Stethoscope className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prescribed By</p>
                      <h3 className="font-bold text-base">Dr. {activePrescription.doctor_name}</h3>
                      <p className="text-xs text-primary font-medium">{activePrescription.specialization}</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 self-start sm:self-auto">
                      Active (Version {activePrescription.version})
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Issued: {new Date(activePrescription.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Time Slots Cards */}
              <div className="space-y-4">
                <h2 className="text-base font-semibold font-display">Prescribed Daily Insulin Slots</h2>

                {activePrescription.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No specific dose slots in this prescription.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {activePrescription.items.map((item) => {
                      const cfg = SLOT_CONFIG[item.time_slot] || { label: item.time_slot, icon: Pill, color: "text-primary" };
                      const Icon = cfg.icon;
                      const taken = isDoseTakenToday(item.id);

                      return (
                        <Card key={item.id} className="rounded-2xl border border-border shadow-elevated">
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4">
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${cfg.color} shrink-0`}>
                                  <Icon className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="capitalize text-xs font-semibold">
                                      {cfg.label} Slot
                                    </Badge>
                                  </div>
                                  <h3 className="font-bold text-lg text-foreground">{item.insulin_name}</h3>
                                  <p className="text-sm font-semibold text-primary">
                                    {item.dose_units} <span className="text-xs font-normal">Units</span>
                                  </p>
                                  {item.instructions && (
                                    <p className="text-xs text-muted-foreground">{item.instructions}</p>
                                  )}
                                  {item.remarks && (
                                    <p className="text-xs text-muted-foreground italic">"{item.remarks}"</p>
                                  )}
                                </div>
                              </div>

                              <div className="self-end sm:self-center shrink-0">
                                {taken ? (
                                  <Badge className="bg-emerald-500 text-white gap-1 py-1.5 px-3">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Dose Taken Today
                                  </Badge>
                                ) : (
                                  <Button
                                    onClick={() => handleLogDose(item)}
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Mark as Taken
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Doctor Clinical Remarks */}
              {activePrescription.notes && (
                <Card className="rounded-2xl border border-border bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Doctor's Clinical Advice
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground whitespace-pre-line">
                    {activePrescription.notes}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6 space-y-4">
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No prescription history found.</p>
          ) : (
            history.map((pres) => (
              <Card key={pres.id} className="rounded-2xl border border-border">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">
                      Version {pres.version} - Dr. {pres.doctor_name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Issued: {new Date(pres.created_at).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant={pres.status === "active" ? "default" : "secondary"} className="capitalize">
                    {pres.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {pres.items.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-xl bg-muted/40 flex justify-between items-center">
                        <div>
                          <span className="font-semibold capitalize text-primary">{item.time_slot}: </span>
                          <span>{item.insulin_name}</span>
                        </div>
                        <span className="font-bold">{item.dose_units} Units</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
