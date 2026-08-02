import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  User,
  Mail,
  Phone,
  TrendingDown,
  TrendingUp,
  UserCheck,
  PhoneCall,
  Pencil,
  LogOut,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/frontend/components/ui/dialog";
import { healthService } from "@/backend/services/healthService";
import { useAuth } from "@/frontend/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Profile — GlucoLab" }] }),
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lowTarget, setLowTarget] = useState("70");
  const [highTarget, setHighTarget] = useState("180");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLowTarget, setEditLowTarget] = useState("70");
  const [editHighTarget, setEditHighTarget] = useState("180");
  const [editEmerName, setEditEmerName] = useState("");
  const [editEmerPhone, setEditEmerPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");

    // Load profile from healthService
    healthService.getProfile().then((p) => {
      if (p?.data) {
        setName(p.data.name || "");
        setPhone(p.data.phone || "");
      }
    });

    // Load medical targets and emergency contact from local storage
    const savedTargets = localStorage.getItem(`glucolab_targets_${user.id}`);
    if (savedTargets) {
      try {
        const parsed = JSON.parse(savedTargets);
        if (parsed.lowTarget) setLowTarget(parsed.lowTarget);
        if (parsed.highTarget) setHighTarget(parsed.highTarget);
      } catch (err) {
        console.warn("Failed to parse saved targets:", err);
      }
    }

    const savedEmergency = localStorage.getItem(`glucolab_emergency_${user.id}`);
    if (savedEmergency) {
      try {
        const parsed = JSON.parse(savedEmergency);
        if (parsed.name) setEmergencyName(parsed.name);
        if (parsed.phone) setEmergencyPhone(parsed.phone);
      } catch (err) {
        console.warn("Failed to parse emergency contact:", err);
      }
    }
  }, [user]);

  const handleOpenEdit = () => {
    setEditName(name);
    setEditPhone(phone);
    setEditLowTarget(lowTarget);
    setEditHighTarget(highTarget);
    setEditEmerName(emergencyName);
    setEditEmerPhone(emergencyPhone);
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      // Update DB profile
      await healthService.updateProfile({ name: editName, phone: editPhone });

      // Save targets & emergency contact locally
      localStorage.setItem(
        `glucolab_targets_${user.id}`,
        JSON.stringify({ lowTarget: editLowTarget, highTarget: editHighTarget })
      );
      localStorage.setItem(
        `glucolab_emergency_${user.id}`,
        JSON.stringify({ name: editEmerName, phone: editEmerPhone })
      );

      // Update local view state
      setName(editName);
      setPhone(editPhone);
      setLowTarget(editLowTarget);
      setHighTarget(editHighTarget);
      setEmergencyName(editEmerName);
      setEmergencyPhone(editEmerPhone);

      toast.success("Profile updated successfully!");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const avatarLetter = name ? name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : "U";

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* 1. Profile Header Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-500/10 text-blue-500 font-display font-bold text-2xl flex items-center justify-center border border-blue-500/20 shrink-0">
            {avatarLetter}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{name || "User"}</h2>
            <p className="text-sm text-muted-foreground">{email || "No email"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{phone || "Not Set"}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleOpenEdit}
          className="rounded-xl flex items-center gap-2 border-border hover:bg-muted/50 text-foreground"
        >
          <Pencil className="h-4 w-4 text-blue-500" /> Edit Profile
        </Button>
      </div>

      {/* 2. Personal Information Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Personal Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email Address</p>
              <p className="text-sm font-medium text-foreground truncate">{email || "Not Set"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Mobile Number</p>
              <p className="text-sm font-medium text-foreground truncate">{phone || "Not Set"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Medical Parameters Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Medical Parameters
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low Target</p>
              <p className="text-sm font-medium text-foreground">{lowTarget} mg/dL</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">High Target</p>
              <p className="text-sm font-medium text-foreground">{highTarget} mg/dL</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Emergency Contact Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Emergency Contact
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contact Name</p>
              <p className="text-sm font-medium text-foreground">{emergencyName || "Not Set"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Phone Number</p>
              <p className="text-sm font-medium text-foreground">{emergencyPhone || "Not Set"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Logout */}
      <div className="pt-2">
        <Button
          variant="destructive"
          onClick={() => setLogoutOpen(true)}
          className="w-full h-12 rounded-[18px] font-bold text-base bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
        >
          <LogOut className="h-5 w-5 mr-2" /> Logout
        </Button>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-[18px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal details and medical targets.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName">User Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editEmail">Email Address</Label>
              <Input
                id="editEmail"
                type="email"
                value={email}
                disabled
                className="opacity-60 bg-muted/40 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editPhone">Mobile Number</Label>
              <Input
                id="editPhone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g. +1 555-0199"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="editLow">Low Target (mg/dL)</Label>
                <Input
                  id="editLow"
                  type="number"
                  value={editLowTarget}
                  onChange={(e) => setEditLowTarget(e.target.value)}
                  min="40"
                  max="100"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editHigh">High Target (mg/dL)</Label>
                <Input
                  id="editHigh"
                  type="number"
                  value={editHighTarget}
                  onChange={(e) => setEditHighTarget(e.target.value)}
                  min="120"
                  max="250"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Emergency Contact
              </h4>
              <div className="space-y-1.5">
                <Label htmlFor="editEmerName">Contact Name</Label>
                <Input
                  id="editEmerName"
                  value={editEmerName}
                  onChange={(e) => setEditEmerName(e.target.value)}
                  placeholder="Guardian or doctor name"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editEmerPhone">Phone Number</Label>
                <Input
                  id="editEmerPhone"
                  type="tel"
                  value={editEmerPhone}
                  onChange={(e) => setEditEmerPhone(e.target.value)}
                  placeholder="Emergency phone"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-primary text-primary-foreground font-semibold"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Modal */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-md rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2 sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogoutOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLogout}
              className="rounded-xl font-semibold"
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
