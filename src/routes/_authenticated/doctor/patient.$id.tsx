import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { doctorService, type DoctorNote } from "@/services/doctorService";
import { prescriptionService, type FullPrescription } from "@/services/prescriptionService";
import { supabase } from "@/db/client";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { Textarea } from "@/frontend/components/ui/textarea";
import { PrescriptionDialog } from "@/frontend/components/prescription-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Activity,
  Pill,
  FileText,
  Plus,
  BarChart2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Stethoscope,
  TrendingUp,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/doctor/patient/$id")({
  component: DoctorPatientDetailPage,
});

function DoctorPatientDetailPage() {
  const { id: patientId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [activePrescription, setActivePrescription] = useState<FullPrescription | null>(null);
  const [prescriptionHistory, setPrescriptionHistory] = useState<FullPrescription[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);

  // Prescription dialog state
  const [prescriptionDialogOpen, setPrescriptionDialogOpen] = useState(false);

  const fetchPatientDetails = async () => {
    if (!user || !patientId) return;
    setLoading(true);
    try {
      // 1. Patient profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", patientId)
        .maybeSingle();

      setPatientProfile(prof);

      // 2. Glucose readings
      const { data: readData } = await supabase
        .from("glucose_entries")
        .select("*")
        .eq("user_id", patientId)
        .order("date_time", { ascending: false });

      setReadings(readData || []);

      // 3. Digital Prescription
      const activeP = await prescriptionService.getActivePrescription(patientId);
      const histP = await prescriptionService.getPrescriptionHistory(patientId);
      setActivePrescription(activeP);
      setPrescriptionHistory(histP);

      // 4. Doctor Notes
      const noteList = await doctorService.getDoctorNotes(patientId);
      setNotes(noteList);
    } catch (err: any) {
      toast.error(err.message || "Failed to load patient profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [user, patientId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newNote.trim()) return;

    try {
      await doctorService.createDoctorNote(user.id, patientId, newNote.trim());
      toast.success("Clinical note added successfully!");
      setNewNote("");
      const updatedNotes = await doctorService.getDoctorNotes(patientId);
      setNotes(updatedNotes);
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    }
  };

  const handleDeactivatePrescription = async (prescriptionId: string) => {
    if (!user || !confirm("Are you sure you want to deactivate this active prescription?")) return;
    try {
      await prescriptionService.deactivatePrescription(prescriptionId, user.id);
      toast.success("Prescription deactivated.");
      fetchPatientDetails();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate prescription");
    }
  };

  const latestGlucose = readings.length > 0 ? readings[0].glucose : null;
  const latestTime = readings.length > 0 ? readings[0].date_time : null;
  const isCritical = latestGlucose !== null && (latestGlucose < 70 || latestGlucose > 180);

  // Prepare chart data
  const chartData = [...readings]
    .reverse()
    .slice(-15)
    .map((r) => ({
      time: new Date(r.date_time).toLocaleDateString([], { month: "short", day: "numeric" }),
      glucose: r.glucose,
    }));

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: "/dashboard" })}
          className="gap-1.5 text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Patient Header Card */}
      <Card className="rounded-2xl border border-border shadow-elevated">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-2xl">
                {patientProfile?.name ? patientProfile.name.charAt(0) : "P"}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {patientProfile?.name || "Patient Profile"}
                </h1>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{patientProfile?.email || "No email"}</span>
                  {patientProfile?.phone && <span>• {patientProfile.phone}</span>}
                </div>
              </div>
            </div>

            {/* Glucose Summary Stat */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Latest Reading</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-2xl font-display">
                    {latestGlucose !== null ? latestGlucose : "--"}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">mg/dL</span>
                </div>
                {latestTime && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(latestTime).toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                {latestGlucose === null ? (
                  <Badge variant="secondary">No Data</Badge>
                ) : isCritical ? (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-semibold px-3 py-1">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    Critical
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold px-3 py-1">
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Stable
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="readings" className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="readings" className="gap-1.5 text-xs">
            <Activity className="h-3.5 w-3.5" />
            Readings
          </TabsTrigger>
          <TabsTrigger value="prescription" className="gap-1.5 text-xs">
            <Pill className="h-3.5 w-3.5" />
            Prescription
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            Doctor Notes
          </TabsTrigger>
          <TabsTrigger value="charts" className="gap-1.5 text-xs">
            <BarChart2 className="h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* 1. Readings Tab */}
        <TabsContent value="readings" className="mt-6 space-y-4">
          <Card className="rounded-2xl border border-border">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold font-display">Glucose Reading History</CardTitle>
              <CardDescription className="text-xs">
                Real-time synchronized glucose measurements recorded by the patient
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {readings.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No glucose readings recorded yet.</p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {readings.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
                            r.glucose < 70 || r.glucose > 180
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {r.glucose}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {r.glucose} <span className="text-xs font-normal text-muted-foreground">mg/dL</span>
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            Type: {r.reading_type} {r.notes && `• "${r.notes}"`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(r.date_time).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Digital Prescription Tab */}
        <TabsContent value="prescription" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-display">Active Digital Insulin Schedule</h2>
            <Button
              onClick={() => setPrescriptionDialogOpen(true)}
              className="gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              {activePrescription ? "Replace / Edit Prescription" : "Create Prescription"}
            </Button>
          </div>

          {!activePrescription ? (
            <Card className="rounded-2xl border-dashed p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <Pill className="h-6 w-6" />
              </div>
              <CardTitle className="text-base font-bold">No Active Digital Prescription</CardTitle>
              <CardDescription className="max-w-md mx-auto mt-1">
                Issue a structured daily insulin schedule for this patient across Morning, Lunch, Afternoon, Evening, and Night time slots.
              </CardDescription>
              <Button onClick={() => setPrescriptionDialogOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Issue Digital Prescription
              </Button>
            </Card>
          ) : (
            <Card className="rounded-2xl border border-border shadow-elevated">
              <CardHeader className="p-5 pb-2 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">
                      Prescription Version {activePrescription.version}
                    </CardTitle>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                      Active
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-0.5">
                    Issued: {new Date(activePrescription.created_at).toLocaleString()}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeactivatePrescription(activePrescription.id)}
                  className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Deactivate
                </Button>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activePrescription.items.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {item.time_slot} Slot
                        </Badge>
                        <span className="font-bold text-sm text-primary">{item.dose_units} Units</span>
                      </div>
                      <p className="font-semibold text-sm text-foreground">{item.insulin_name}</p>
                      {item.instructions && (
                        <p className="text-xs text-muted-foreground">{item.instructions}</p>
                      )}
                      {item.remarks && (
                        <p className="text-xs text-muted-foreground italic">"{item.remarks}"</p>
                      )}
                    </div>
                  ))}
                </div>

                {activePrescription.notes && (
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
                    <span className="font-semibold text-primary">Doctor Remarks: </span>
                    {activePrescription.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Revision History */}
          {prescriptionHistory.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold font-display">Prescription Revision Log</h3>
              <div className="space-y-2">
                {prescriptionHistory.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl border border-border bg-card flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-foreground">Version {p.version} </span>
                      <span className="text-muted-foreground">• {new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* 3. Doctor Notes Tab */}
        <TabsContent value="notes" className="mt-6 space-y-6">
          <Card className="rounded-2xl border border-border">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold font-display">Write Clinical Note</CardTitle>
              <CardDescription className="text-xs">
                Clinical observations, dosage notes, or dietary recommendations for the patient
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <form onSubmit={handleAddNote} className="space-y-3">
                <Textarea
                  placeholder="Enter clinical observations, progress notes..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
                <Button type="submit" disabled={!newNote.trim()} className="gap-2 text-xs">
                  <Plus className="h-4 w-4" />
                  Save Note
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Notes Log */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold font-display">Clinical Notes Log ({notes.length})</h3>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes written for this patient yet.</p>
            ) : (
              <div className="space-y-3">
                {notes.map((n) => (
                  <Card key={n.id} className="rounded-xl border border-border bg-card">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">
                          Dr. {n.doctor_profiles?.full_name || "Doctor"}
                        </span>
                        <span className="font-mono">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-line">{n.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* 4. Analytics Tab */}
        <TabsContent value="charts" className="mt-6 space-y-4">
          <Card className="rounded-2xl border border-border">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold font-display">Glucose Trend Chart</CardTitle>
              <CardDescription className="text-xs">
                Historical blood glucose fluctuation pattern over recent readings
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Insufficient reading data for chart visualization.</p>
              ) : (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                      <YAxis domain={[50, 250]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="glucose"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Digital Prescription Dialog */}
      <PrescriptionDialog
        patientId={patientId}
        doctorId={user?.id || ""}
        patientName={patientProfile?.name || "Patient"}
        open={prescriptionDialogOpen}
        onOpenChange={setPrescriptionDialogOpen}
        onSuccess={fetchPatientDetails}
      />
    </div>
  );
}
