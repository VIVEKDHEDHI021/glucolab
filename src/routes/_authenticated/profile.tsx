import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
  ShieldCheck,
  Trash2,
  RefreshCw,
  Heart,
  Scale,
  Ruler,
  Calendar,
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

const DIABETES_TYPES = [
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Gestational Diabetes",
  "Other / Not sure",
];

function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  // State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [diabetesType, setDiabetesType] = useState<string>("");
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [lowTarget, setLowTarget] = useState("70");
  const [highTarget, setHighTarget] = useState("180");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editDiabetesType, setEditDiabetesType] = useState("Type 1 Diabetes");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editHeightCm, setEditHeightCm] = useState("");
  const [editLowTarget, setEditLowTarget] = useState("70");
  const [editHighTarget, setEditHighTarget] = useState("180");
  const [editEmerName, setEditEmerName] = useState("");
  const [editEmerPhone, setEditEmerPhone] = useState("");

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");

    // Load profile from healthService or context
    healthService.getProfile().then((p) => {
      if (p?.data) {
        setName(p.data.name || "");
        setPhone(p.data.phone || "");
        setAge(p.data.age ?? null);
        setDiabetesType(p.data.diabetes_type || "");
        setWeightKg(p.data.weight_kg ? Number(p.data.weight_kg) : null);
        setHeightCm(p.data.height_cm ? Number(p.data.height_cm) : null);
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
    setEditAge(age !== null ? String(age) : "");
    setEditDiabetesType(diabetesType || "Type 1 Diabetes");
    setEditWeightKg(weightKg !== null ? String(weightKg) : "");
    setEditHeightCm(heightCm !== null ? String(heightCm) : "");
    setEditLowTarget(lowTarget);
    setEditHighTarget(highTarget);
    setEditEmerName(emergencyName);
    setEditEmerPhone(emergencyPhone);
    setEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    const parsedAge = editAge ? parseInt(editAge, 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      toast.error("Please enter a valid age between 1 and 120.");
      return;
    }

    const parsedWeight = editWeightKg ? parseFloat(editWeightKg) : null;
    if (parsedWeight !== null && (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 350)) {
      toast.error("Please enter a valid weight between 20 kg and 350 kg.");
      return;
    }

    const parsedHeight = editHeightCm ? parseFloat(editHeightCm) : null;
    if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 260)) {
      toast.error("Please enter a valid height between 50 cm and 260 cm.");
      return;
    }

    setSaving(true);

    try {
      // Update DB profile (preserves onboarding_completed and all health logs)
      await healthService.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        age: parsedAge,
        diabetes_type: editDiabetesType,
        weight_kg: parsedWeight,
        height_cm: parsedHeight,
      });

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
      setName(editName.trim());
      setPhone(editPhone.trim());
      setAge(parsedAge);
      setDiabetesType(editDiabetesType);
      setWeightKg(parsedWeight);
      setHeightCm(parsedHeight);
      setLowTarget(editLowTarget);
      setHighTarget(editHighTarget);
      setEmergencyName(editEmerName);
      setEmergencyPhone(editEmerPhone);

      await refreshProfile();
      toast.success("Health profile updated successfully!");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutOpen(false); // Close modal immediately
    if (typeof window !== "undefined") {
      document.body.style.pointerEvents = "";
      document.body.style.overflow = "";
      document.body.removeAttribute("data-scroll-locked");
    }
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
      navigate({ to: "/signup", replace: true });
    }
    return;
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
            <h2 className="text-xl font-bold text-foreground">{name || "Patient"}</h2>
            <p className="text-sm text-muted-foreground">{email || "No email"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{phone || "No phone set"}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleOpenEdit}
          className="rounded-xl flex items-center gap-2 border-border hover:bg-muted/50 text-foreground cursor-pointer"
        >
          <Pencil className="h-4 w-4 text-blue-500" /> Edit Profile
        </Button>
      </div>

      {/* 2. Diabetes & Health Profile Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Diabetes &amp; Health Profile
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 pt-1">
          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Heart className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Condition</p>
              <p className="text-sm font-bold text-foreground truncate">
                {diabetesType || "Not Specified"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Age</p>
              <p className="text-sm font-bold text-foreground">
                {age !== null ? `${age} years old` : "Not Set"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Scale className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="text-sm font-bold text-foreground">
                {weightKg !== null ? `${weightKg} kg` : "Not Set"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Ruler className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Height</p>
              <p className="text-sm font-bold text-foreground">
                {heightCm !== null ? `${heightCm} cm` : "Not Set"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Personal Contact Information Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Contact Details
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

      {/* 4. Medical Parameters Card */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Glucose Target Ranges
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

      {/* 5. Emergency Contact Card */}
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

      {/* 6. Account Privacy & Data Governance */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Privacy &amp; Data Governance
        </h3>
        
        <div className="space-y-3 pt-1">
          <Link to="/privacy-policy" className="block">
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl h-11 border-border/60 hover:bg-muted font-medium text-xs sm:text-sm"
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Privacy Policy &amp; Health Data Protection
              </span>
              <span className="text-[11px] text-primary font-semibold">View</span>
            </Button>
          </Link>

          <Link to="/delete-account" className="block">
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl h-11 border-destructive/30 hover:bg-destructive/10 text-destructive font-medium text-xs sm:text-sm"
            >
              <span className="flex items-center gap-2.5">
                <Trash2 className="h-4 w-4" />
                Delete Account &amp; Medical Records
              </span>
              <span className="text-[11px] text-destructive font-semibold">Manage</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 7. Danger Zone (Logout) */}
      <div className="bg-card border border-border/70 rounded-[18px] p-6 shadow-sm">
        <Button
          variant="outline"
          onClick={() => setLogoutOpen(true)}
          className="w-full rounded-xl border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
        >
          <LogOut className="h-4 w-4" /> Log Out
        </Button>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-[18px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Health Profile</DialogTitle>
            <DialogDescription>
              Update your personal and clinical parameters. All changes are encrypted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName">Full Name</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your full name"
                required
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

            {/* Health parameters */}
            <div className="pt-2 border-t border-border/60 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Clinical Information
              </h4>

              <div className="space-y-1.5">
                <Label htmlFor="editDiabetesType">Diabetes Type</Label>
                <select
                  id="editDiabetesType"
                  value={editDiabetesType}
                  onChange={(e) => setEditDiabetesType(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {DIABETES_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label htmlFor="editAge">Age</Label>
                  <Input
                    id="editAge"
                    type="number"
                    min="1"
                    max="120"
                    value={editAge}
                    onChange={(e) => setEditAge(e.target.value)}
                    placeholder="e.g. 30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editWeight">Weight (kg)</Label>
                  <Input
                    id="editWeight"
                    type="number"
                    step="0.1"
                    min="20"
                    max="350"
                    value={editWeightKg}
                    onChange={(e) => setEditWeightKg(e.target.value)}
                    placeholder="e.g. 70"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editHeight">Height (cm)</Label>
                  <Input
                    id="editHeight"
                    type="number"
                    step="0.5"
                    min="50"
                    max="260"
                    value={editHeightCm}
                    onChange={(e) => setEditHeightCm(e.target.value)}
                    placeholder="e.g. 175"
                  />
                </div>
              </div>
            </div>

            {/* Targets */}
            <div className="pt-2 border-t border-border/60 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Target Ranges (mg/dL)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="editLow">Low Target</Label>
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
                  <Label htmlFor="editHigh">High Target</Label>
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
            </div>

            {/* Emergency Contact */}
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
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-primary text-primary-foreground font-semibold cursor-pointer"
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
              disabled={loggingOut}
              className="rounded-xl font-semibold flex items-center gap-2"
            >
              {loggingOut ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Logging out...</span>
                </>
              ) : (
                "Log Out"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
