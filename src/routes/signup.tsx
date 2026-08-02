import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Eye, EyeOff, User, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/db/client";
import { useAuth } from "@/frontend/lib/auth-context";
import { doctorService } from "@/services/doctorService";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Doctor specific state
  const [regNumber, setRegNumber] = useState("");
  const [specialization, setSpecialization] = useState("Diabetology & Endocrinology");
  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [experience, setExperience] = useState("5");

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (role === "doctor") {
      if (!regNumber.trim() || !clinicName.trim()) {
        toast.error("Please fill in Medical Registration Number and Hospital/Clinic Name.");
        return;
      }
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name, role },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) throw authError;

      const newUser = authData.user;
      if (newUser) {
        if (role === "doctor") {
          await doctorService.createDoctorProfile({
            id: newUser.id,
            full_name: name,
            email: cleanEmail,
            phone,
            registration_number: regNumber,
            specialization,
            hospital_clinic_name: clinicName,
            clinic_address: clinicAddress,
            experience_years: parseInt(experience) || 0,
          });
        } else {
          await supabase.from("profiles").upsert({
            user_id: newUser.id,
            name,
            email: cleanEmail,
            phone: phone || null,
            role: "patient",
          });
        }
      }

      toast.success(
        role === "doctor"
          ? "Doctor Account created successfully!"
          : "Account created! Welcome to GlucoLab."
      );
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Activity className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join GlucoLab for smart diabetes management
          </p>
        </div>

        {/* Role Toggle */}
        <div className="mb-6 grid grid-cols-2 gap-3 p-1 rounded-xl bg-muted/60">
          <button
            type="button"
            onClick={() => setRole("patient")}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              role === "patient"
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            Patient
          </button>
          <button
            type="button"
            onClick={() => setRole("doctor")}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
              role === "doctor"
                ? "bg-card text-primary shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="h-4 w-4" />
            Doctor
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">{role === "doctor" ? "Doctor Full Name" : "Full name"}</Label>
            <Input
              id="name"
              required
              placeholder={role === "doctor" ? "e.g. Dr. Sarah Jenkins" : "e.g. John Doe"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 555-0192"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Doctor specific fields */}
          {role === "doctor" && (
            <div className="space-y-4 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Medical Professional Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="regNumber">Medical Reg. Number *</Label>
                  <Input
                    id="regNumber"
                    required
                    placeholder="e.g. MED-884920"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    required
                    placeholder="e.g. Diabetology & Endocrinology"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clinicName">Hospital / Clinic Name *</Label>
                <Input
                  id="clinicName"
                  required
                  placeholder="e.g. City Health Diabetes Center"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="clinicAddress">Clinic Address</Label>
                  <Input
                    id="clinicAddress"
                    placeholder="e.g. 102 Medical Park Ave"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="experience">Experience (yrs)</Label>
                  <Input
                    id="experience"
                    type="number"
                    min="0"
                    placeholder="5"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating account..." : role === "doctor" ? "Register Doctor Account" : "Create Patient Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
