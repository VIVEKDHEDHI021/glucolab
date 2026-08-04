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
  AlertTriangle,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
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
import { accountService } from "@/services/accountService";
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

  // Delete Account Modals & State
  const [warningOpen, setWarningOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // Delete Account Flow Handlers
  const handleOpenDeleteWarning = () => {
    setPassword("");
    setShowPassword(false);
    setDeleteError(null);
    setWarningOpen(true);
  };

  const handleProceedToPassword = () => {
    setWarningOpen(false);
    setPasswordOpen(true);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setDeleteError("Password is required.");
      return;
    }

    if (typeof window !== "undefined" && !navigator.onLine) {
      const offlineMsg = "Internet connection is required to permanently delete your account.";
      setDeleteError(offlineMsg);
      toast.error(offlineMsg);
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const res = await accountService.deleteAccount(password);

    setDeleting(false);

    if (!res.success) {
      const errMsg = res.error || "Failed to delete account. Please try again.";
      setDeleteError(errMsg);
      toast.error(errMsg);
      return;
    }

    // Success! Close password modal and show success screen
    setPasswordOpen(false);
    setSuccessOpen(true);
  };

  const handleReturnToLogin = () => {
    setSuccessOpen(false);
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

      {/* 6. Danger Zone */}
      <div className="bg-card border border-destructive/40 rounded-[18px] p-6 shadow-sm space-y-3 mt-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="text-base font-bold">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Delete your account permanently.
        </p>
        <div className="pt-1">
          <Button
            variant="outline"
            onClick={handleOpenDeleteWarning}
            className="w-full sm:w-auto rounded-xl border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Delete Account
          </Button>
        </div>
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

      {/* Account Deletion Confirmation Warning Modal */}
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent className="sm:max-w-md rounded-[18px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Account
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-foreground pt-2">
              Deleting your account is permanent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              The following information will be permanently removed:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-sm pl-1">
              <li>Profile Information</li>
              <li>Email</li>
              <li>Glucose Readings</li>
              <li>Insulin Records</li>
              <li>Reports</li>
              <li>Notification Settings</li>
              <li>Reminder Data</li>
              <li>Device Tokens</li>
              <li>Offline Sync Data</li>
              <li>Any other account-related information</li>
            </ul>
            <p className="font-semibold text-destructive pt-2">
              This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWarningOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleProceedToPassword}
              className="rounded-xl font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Deletion Password Confirmation Modal */}
      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          if (!deleting) setPasswordOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirm Password</DialogTitle>
            <DialogDescription>
              Please enter your current password to confirm permanent account deletion.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmDelete} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="deletePassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="deletePassword"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (deleteError) setDeleteError(null);
                  }}
                  placeholder="Enter current password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {deleteError && (
                <p className="text-xs text-destructive font-medium pt-1">{deleteError}</p>
              )}
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordOpen(false)}
                disabled={deleting}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={deleting || !password.trim()}
                className="rounded-xl font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Account Deletion Success Modal */}
      <Dialog open={successOpen} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md rounded-[18px] text-center"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="flex flex-col items-center">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Account Deleted</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2 text-sm text-muted-foreground">
            <p>Your account and all associated data have been permanently deleted.</p>
            <p className="font-medium text-foreground">Thank you for using GlucoLab.</p>
          </div>

          <DialogFooter className="pt-4 flex justify-center">
            <Button
              type="button"
              onClick={handleReturnToLogin}
              className="w-full rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              Return to Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
