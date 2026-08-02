import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { doctorService, type DoctorProfile } from "@/services/doctorService";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Badge } from "@/frontend/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/frontend/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/components/ui/select";
import { DoctorProfileDialog } from "@/frontend/components/doctor-profile-dialog";
import { toast } from "sonner";
import { Stethoscope, UserPlus, Trash2, Eye, ShieldCheck, ShieldAlert, Clock, Building2, QrCode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/doctors")({
  component: MyDoctorsPage,
});

function MyDoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add doctor modal state
  const [addOpen, setAddOpen] = useState(false);
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [accessLevel, setAccessLevel] = useState<"read_only" | "full" | "temporary">("full");
  const [expiresDays, setExpiresDays] = useState("30");
  const [submitting, setSubmitting] = useState(false);

  // View doctor profile dialog state
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchDoctors = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await doctorService.getConnectedDoctors(user.id);
      setDoctors(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load connected doctors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, [user]);

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !doctorIdInput.trim()) return;

    setSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (accessLevel === "temporary") {
        const days = parseInt(expiresDays) || 30;
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + days);
        expiresAt = expDate.toISOString();
      }

      await doctorService.requestDoctorAccess({
        patientId: user.id,
        doctorIdCode: doctorIdInput.trim(),
        accessLevel,
        expiresAt,
      });

      toast.success("Access request sent to doctor!");
      setAddOpen(false);
      setDoctorIdInput("");
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || "Failed to add doctor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (accessId: string, doctorName: string) => {
    if (!confirm(`Are you sure you want to remove access for Dr. ${doctorName}?`)) return;

    try {
      await doctorService.revokeDoctorAccess(accessId);
      toast.success("Doctor access revoked.");
      fetchDoctors();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke access");
    }
  };

  const viewDoctorDetails = (docProfile: DoctorProfile) => {
    setSelectedDoctor(docProfile);
    setProfileOpen(true);
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">My Connected Doctors</h1>
          <p className="text-sm text-muted-foreground">
            Manage medical record access granted to your healthcare providers
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 self-start sm:self-auto">
          <UserPlus className="h-4 w-4" />
          Connect Doctor
        </Button>
      </div>

      {/* Doctor List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading connected doctors...</div>
      ) : doctors.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
            <Stethoscope className="h-7 w-7" />
          </div>
          <CardTitle className="text-lg font-bold">No Doctors Connected</CardTitle>
          <CardDescription className="max-w-md mx-auto mt-1">
            You own your medical records. Connect with your doctor using their Doctor ID or QR code to grant access to glucose reports & digital prescriptions.
          </CardDescription>
          <Button onClick={() => setAddOpen(true)} className="mt-4 gap-2">
            <UserPlus className="h-4 w-4" />
            Add Doctor
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {doctors.map((acc) => {
            const doc = acc.doctor_profiles as DoctorProfile;
            if (!doc) return null;

            const isPending = acc.status === "pending";
            const isAccepted = acc.status === "accepted";
            const isRejected = acc.status === "rejected";

            return (
              <Card key={acc.id} className="rounded-2xl border border-border shadow-elevated">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                        {doc.full_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">Dr. {doc.full_name}</h3>
                        <p className="text-xs text-primary font-medium">{doc.specialization}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {doc.hospital_clinic_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60 text-xs">
                    {isPending && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending Approval
                      </Badge>
                    )}
                    {isAccepted && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        Declined
                      </Badge>
                    )}

                    <Badge variant="secondary" className="capitalize">
                      Level: {acc.access_level.replace("_", " ")}
                    </Badge>

                    {acc.access_level === "temporary" && acc.expires_at && (
                      <span className="text-[11px] text-muted-foreground">
                        Expires: {new Date(acc.expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewDoctorDetails(doc)}
                      className="gap-1.5 text-xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Profile
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(acc.id, doc.full_name)}
                      className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove Access
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Doctor Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-display">Connect with Doctor</DialogTitle>
            <DialogDescription className="text-xs">
              Enter your doctor's unique Doctor ID or scan their QR code to request medical access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddDoctor} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="docId" className="text-xs font-semibold">
                Doctor ID Code *
              </Label>
              <div className="relative">
                <Input
                  id="docId"
                  required
                  placeholder="e.g. DOC-89A4B2"
                  value={doctorIdInput}
                  onChange={(e) => setDoctorIdInput(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-wider pr-10"
                />
                <QrCode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ask your doctor for their unique GlucoLab Doctor ID.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Permission Access Level</Label>
              <Select
                value={accessLevel}
                onValueChange={(v: any) => setAccessLevel(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Access (View Readings, Prescribe Insulin & Write Notes)</SelectItem>
                  <SelectItem value="read_only">Read Only (View Readings, Charts & Reports)</SelectItem>
                  <SelectItem value="temporary">Temporary Access (Auto-expires after specified days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {accessLevel === "temporary" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Expiration Duration (Days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={expiresDays}
                  onChange={(e) => setExpiresDays(e.target.value)}
                />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Access Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Doctor Profile View Modal */}
      <DoctorProfileDialog
        doctor={selectedDoctor}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}
