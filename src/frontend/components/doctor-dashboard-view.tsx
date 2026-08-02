import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { doctorService, type DoctorProfile, type DoctorPatientSummary } from "@/services/doctorService";
import { prescriptionService } from "@/services/prescriptionService";
import { QRCodeSVG } from "@/frontend/components/qr-code";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Badge } from "@/frontend/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { toast } from "sonner";
import {
  Users,
  Clock,
  Pill,
  Bell,
  Search,
  Check,
  X,
  UserCheck,
  AlertTriangle,
  CheckCircle,
  Copy,
  QrCode,
  ArrowRight,
  Stethoscope,
  Building2,
  Phone,
  Mail,
  ShieldAlert,
} from "lucide-react";

interface DoctorDashboardViewProps {
  userId: string;
}

export const DoctorDashboardView: React.FC<DoctorDashboardViewProps> = ({ userId }) => {
  const navigate = useNavigate();
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<DoctorPatientSummary[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "stable" | "recently_updated" | "no_recent_reading">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch Doctor Profile
      const doc = await doctorService.getDoctorProfile(userId);
      setDoctorProfile(doc);

      // Fetch Pending Requests
      const pending = await doctorService.getPendingRequests(userId);
      setPendingRequests(pending);

      // Fetch Patients
      const ptList = await doctorService.getDoctorPatients(userId, activeFilter);
      setPatients(ptList);
    } catch (err: any) {
      console.error("Error loading doctor dashboard data:", err);
      toast.error(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId, activeFilter]);

  const handleRespondRequest = async (accessId: string, status: "accepted" | "rejected") => {
    try {
      await doctorService.respondToAccessRequest(accessId, status);
      toast.success(status === "accepted" ? "Patient request accepted!" : "Patient request declined.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    }
  };

  const copyDoctorId = () => {
    if (!doctorProfile) return;
    navigator.clipboard.writeText(doctorProfile.doctor_id);
    toast.success(`Copied Doctor ID: ${doctorProfile.doctor_id}`);
  };

  // Filter patients by search query
  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.patient_name.toLowerCase().includes(q) || (p.email && p.email.toLowerCase().includes(q));
  });

  const criticalCount = patients.filter((p) => p.reading_status === "critical").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Doctor Clinical Portal</h1>
          <p className="text-sm text-muted-foreground">
            Monitor connected patients, process access requests, and issue digital prescriptions
          </p>
        </div>

        {doctorProfile && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 px-3 py-1 font-mono text-xs">
              <Stethoscope className="h-3.5 w-3.5 mr-1" />
              ID: {doctorProfile.doctor_id}
            </Badge>
            <Button size="sm" variant="ghost" onClick={copyDoctorId} className="h-8 px-2">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Patients</p>
              <h3 className="text-2xl font-bold font-display mt-1">{patients.length}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Requests</p>
              <h3 className="text-2xl font-bold font-display mt-1 text-amber-600">{pendingRequests.length}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Critical Alerts</p>
              <h3 className="text-2xl font-bold font-display mt-1 text-destructive">{criticalCount}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <h3 className="text-base font-bold font-display mt-1 text-emerald-600">Verified</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctor ID & QR Code Banner */}
      {doctorProfile && (
        <Card className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified Doctor Account
                </Badge>
                <h2 className="text-xl font-bold font-display">Dr. {doctorProfile.full_name}</h2>
                <p className="text-xs text-primary font-medium">{doctorProfile.specialization} • {doctorProfile.hospital_clinic_name}</p>
                <div className="pt-2 flex items-center justify-center md:justify-start gap-2">
                  <span className="text-xs text-muted-foreground">Your Doctor ID: </span>
                  <span className="font-mono font-bold text-sm bg-background border px-2.5 py-1 rounded-lg">
                    {doctorProfile.doctor_id}
                  </span>
                  <Button size="sm" variant="outline" onClick={copyDoctorId} className="h-8 gap-1 text-xs">
                    <Copy className="h-3 w-3" />
                    Copy ID
                  </Button>
                </div>
              </div>

              <div className="flex flex-col items-center shrink-0">
                <QRCodeSVG value={doctorProfile.doctor_id} size={120} />
                <p className="text-[11px] text-muted-foreground mt-1">Scan QR Code to Connect</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Access Requests Section */}
      {pendingRequests.length > 0 && (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base font-bold font-display text-amber-900 dark:text-amber-200">
                Pending Patient Access Requests ({pendingRequests.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-amber-700 dark:text-amber-300">
              Patients who have requested to share their glucose readings & medical profile with you
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="divide-y divide-amber-500/20">
              {pendingRequests.map((req) => (
                <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm">{req.patient_name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Requested: {new Date(req.created_at).toLocaleDateString()} • Level:{" "}
                      <span className="font-semibold capitalize">{req.access_level.replace("_", " ")}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespondRequest(req.id, "accepted")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondRequest(req.id, "rejected")}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patient List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-bold font-display">My Connected Patients ({filteredPatients.length})</h2>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={(v: any) => setActiveFilter(v)} className="w-full">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl text-xs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="critical" className="text-destructive font-semibold">Critical</TabsTrigger>
            <TabsTrigger value="stable" className="text-emerald-600 font-semibold">Stable</TabsTrigger>
            <TabsTrigger value="recently_updated">Recent</TabsTrigger>
            <TabsTrigger value="no_recent_reading">No Data</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Patients Grid */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading connected patients...</div>
        ) : filteredPatients.length === 0 ? (
          <Card className="rounded-2xl border-dashed p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold text-foreground">No patients found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Patients who connect with your Doctor ID ({doctorProfile?.doctor_id}) will appear here after you accept their request.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatients.map((pt) => (
              <Card key={pt.patient_id} className="rounded-2xl border border-border shadow-elevated hover:border-primary/40 transition-colors">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                        {pt.patient_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-base">{pt.patient_name}</h3>
                        <p className="text-xs text-muted-foreground">{pt.email || "No email"}</p>
                        {pt.phone && <p className="text-xs text-muted-foreground">{pt.phone}</p>}
                      </div>
                    </div>

                    <div>
                      {pt.reading_status === "critical" && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-semibold">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Critical
                        </Badge>
                      )}
                      {pt.reading_status === "stable" && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Stable
                        </Badge>
                      )}
                      {pt.reading_status === "no_recent" && (
                        <Badge variant="secondary" className="text-xs">
                          No Reading
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 text-xs">
                    <div>
                      <span className="text-muted-foreground">Latest Glucose: </span>
                      <span className="font-bold text-foreground text-sm">
                        {pt.latest_glucose !== null ? `${pt.latest_glucose} mg/dL` : "N/A"}
                      </span>
                    </div>
                    <div className="text-right text-muted-foreground">
                      {pt.latest_reading_time ? (
                        <span>{new Date(pt.latest_reading_time).toLocaleDateString()}</span>
                      ) : (
                        <span>No timestamp</span>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => navigate({ to: `/doctor/patient/${pt.patient_id}` as any })}
                    className="w-full gap-2 text-xs"
                    size="sm"
                  >
                    View Patient Profile & Prescriptions
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
