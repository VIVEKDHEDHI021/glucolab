import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  AlertTriangle,
  Lock,
  ArrowRight,
  Database,
  UserX,
  HeartPulse,
  Pill,
  Scale,
  Camera,
  Bell,
  KeyRound,
  ChevronRight,
  Sun,
  Moon,
  Info,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Textarea } from "@/frontend/components/ui/textarea";
import { Checkbox } from "@/frontend/components/ui/checkbox";
import { useAuth } from "@/frontend/lib/auth-context";
import { useTheme } from "@/frontend/lib/theme";
import { accountService } from "@/services/accountService";
import { toast } from "sonner";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
  head: () => ({
    meta: [
      { title: "Account & Data Deletion Policy — GlucoLab" },
      {
        name: "description",
        content:
          "Request account deletion and learn how GlucoLab handles user data, deletion requests, and retention policies in compliance with Google Play Store standards.",
      },
    ],
  }),
});

export default function DeleteAccountPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  // Web Request Form State (For unauthenticated / uninstalled app users)
  const [formEmail, setFormEmail] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formConfirmed, setFormConfirmed] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  // Self-Service Direct Deletion State (For authenticated users)
  const [directPassword, setDirectPassword] = useState("");
  const [directLoading, setDirectLoading] = useState(false);
  const [directSuccess, setDirectSuccess] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  const handlePublicRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!formConfirmed) {
      toast.error("Please confirm that you understand account deletion is permanent.");
      return;
    }

    setRequestLoading(true);
    setRequestSuccess(null);

    try {
      const res = await fetch("/api/account-deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail.trim(),
          reason: formReason.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      setRequestLoading(false);

      if (!res.ok || data.error) {
        toast.error(data.error || "Failed to submit request. Please try again.");
        return;
      }

      setRequestSuccess(
        data.message ||
          "Your account deletion request has been received. Requests are processed within 1–3 business days."
      );
      toast.success("Deletion request submitted!");
      setFormEmail("");
      setFormReason("");
      setFormConfirmed(false);
    } catch (err: any) {
      setRequestLoading(false);
      toast.error(err?.message || "Connection error. Please try again later.");
    }
  };

  const handleDirectSelfServiceDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPassword.trim()) {
      setDirectError("Password is required.");
      return;
    }

    setDirectLoading(true);
    setDirectError(null);

    const res = await accountService.deleteAccount(directPassword);
    setDirectLoading(false);

    if (!res.success) {
      const msg = res.error || "Failed to delete account. Please verify your password.";
      setDirectError(msg);
      toast.error(msg);
      return;
    }

    setDirectSuccess(true);
    toast.success("Account deleted successfully.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white shadow-soft">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-lg text-foreground">GlucoLab</span>
              <span className="ml-1.5 text-[10px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                Policy
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Toggle theme"
              className="rounded-xl"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {user ? (
              <Link to="/dashboard">
                <Button className="rounded-xl font-semibold bg-primary text-primary-foreground">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="outline" className="rounded-xl font-semibold border-border">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 mx-auto max-w-4xl px-4 py-8 sm:py-12 space-y-10">
        {/* Banner Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider border border-destructive/20">
            <ShieldAlert className="h-4 w-4" /> Google Play Policy & Data Safety Compliance
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            GlucoLab Account & Data Deletion
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            We empower you with full control over your personal medical records and account data.
            Learn how account deletion works, submit a web deletion request, or perform instant self-service account removal.
          </p>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Immediate Purge</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In-app self-service deletions are executed in real time within seconds across all server databases.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Web Form Requests</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Users without app access can request deletion below. Processed within 1–3 business days.
            </p>
          </div>

          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">Zero Retention</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              0% of your personal health metrics, glucose logs, or identity credentials are retained after deletion.
            </p>
          </div>
        </div>

        {/* SECTION 1: INTERACTIVE DELETION TOOLS */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-elevated space-y-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Request Account & Data Deletion</h2>
              <p className="text-xs text-muted-foreground">
                Select the option that matches your current account access status.
              </p>
            </div>
          </div>

          {/* Option A: Public Request Form for Logged-Out or Uninstalled App Users */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </span>
              Web Deletion Request Form (App Uninstalled or Logged Out)
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If you have uninstalled the app or lost login credentials, enter your registered email address below to submit an official account deletion request.
            </p>

            {requestSuccess ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2 text-sm text-foreground">
                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                  <CheckCircle2 className="h-5 w-5" /> Request Submitted Successfully
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{requestSuccess}</p>
                <Button
                  variant="outline"
                  onClick={() => setRequestSuccess(null)}
                  className="mt-2 text-xs rounded-xl border-emerald-500/30"
                >
                  Submit Another Request
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePublicRequestSubmit} className="space-y-4 bg-muted/30 p-5 rounded-2xl border border-border/60">
                <div className="space-y-1.5">
                  <Label htmlFor="reqEmail" className="text-xs font-semibold">
                    Registered Email Address *
                  </Label>
                  <Input
                    id="reqEmail"
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="bg-card"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reqReason" className="text-xs font-semibold">
                    Reason for Deletion (Optional)
                  </Label>
                  <Textarea
                    id="reqReason"
                    rows={2}
                    placeholder="Tell us why you are deleting your account (e.g. no longer needed, changing devices)"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="bg-card text-xs"
                  />
                </div>

                <div className="flex items-start space-x-2.5 pt-1">
                  <Checkbox
                    id="confirmCheckbox"
                    checked={formConfirmed}
                    onCheckedChange={(c) => setFormConfirmed(!!c)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="confirmCheckbox"
                    className="text-xs font-normal text-muted-foreground leading-snug cursor-pointer"
                  >
                    I confirm that I am requesting permanent deletion of my account and all associated health records. I understand this action cannot be undone.
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={requestLoading || !formConfirmed || !formEmail.trim()}
                  className="w-full sm:w-auto font-semibold rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {requestLoading ? "Submitting Request..." : "Submit Deletion Request"}
                </Button>
              </form>
            )}
          </div>

          <div className="border-t border-border/60 my-6" />

          {/* Option B: Direct Self-Service Deletion for Authenticated Users */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </span>
              Instant In-App / Web Self-Service Deletion
            </h3>

            {user ? (
              <div className="bg-destructive/5 border border-destructive/20 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                  <UserX className="h-4 w-4" /> Signed in as: {user.email}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You are currently logged in. Enter your current account password to instantly purge your account and all associated health metrics right now.
                </p>

                {directSuccess ? (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-600 font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Your account and data have been permanently purged.
                  </div>
                ) : (
                  <form onSubmit={handleDirectSelfServiceDelete} className="space-y-3">
                    <div className="space-y-1.5 max-w-sm">
                      <Label htmlFor="directPassword" className="text-xs font-semibold">
                        Confirm Account Password
                      </Label>
                      <Input
                        id="directPassword"
                        type="password"
                        required
                        placeholder="Enter account password"
                        value={directPassword}
                        onChange={(e) => setDirectPassword(e.target.value)}
                        className="bg-card"
                      />
                      {directError && (
                        <p className="text-xs text-destructive font-medium pt-0.5">{directError}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={directLoading || !directPassword.trim()}
                      className="font-semibold rounded-xl"
                    >
                      {directLoading ? "Purging Account..." : "Permanently Delete My Account Now"}
                    </Button>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-muted/40 border border-border/60 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Want to delete instantly via your active account?</h4>
                  <p className="text-xs text-muted-foreground">
                    Sign in to access your profile settings or perform instant password-verified deletion.
                  </p>
                </div>
                <Link to="/login">
                  <Button variant="outline" className="rounded-xl text-xs font-semibold border-border shrink-0">
                    Sign In to Delete <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: HOW TO REQUEST ACCOUNT DELETION */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Step-by-Step Instructions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Activity className="h-4 w-4" /> Method 1: In Mobile App / Web App
              </div>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2 leading-relaxed">
                <li>Log in to your <strong>GlucoLab</strong> account.</li>
                <li>Navigate to <strong>Profile</strong> from the side menu or navigation bar.</li>
                <li>Scroll down to the <strong>Danger Zone</strong> section at the bottom.</li>
                <li>Click <strong>Delete Account</strong> and read the data loss warning.</li>
                <li>Enter your account password to verify ownership and confirm deletion.</li>
                <li>Your account and data are deleted immediately.</li>
              </ol>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Mail className="h-4 w-4" /> Method 2: Web Form & Email Request
              </div>
              <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2 leading-relaxed">
                <li>Fill out the <strong>Web Deletion Request Form</strong> above on this page.</li>
                <li>Alternatively, send an email to <strong>support@glucolab.app</strong> or <strong>privacy@vioraa.workers.dev</strong>.</li>
                <li>Subject line: <code>Account Deletion Request - [Your Registered Email]</code>.</li>
                <li>Include your registered email address in the body of the message.</li>
                <li>Our team will verify the request and complete deletion within <strong>1–3 business days</strong>.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* SECTION 3: WHAT DATA IS DELETED */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-destructive" /> Data Types Subject to Permanent Deletion
            </h2>
            <span className="text-xs font-bold text-destructive bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-lg">
              100% Permanently Purged
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            When your account deletion is processed, the following categories of data stored in server databases and local app storage are deleted permanently and cannot be recovered:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">User Identity & Authentication</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Full name, email address, phone number, encrypted password hash, role credentials, and Supabase Auth identity record.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Blood Glucose Log Records</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  All historical blood sugar readings (mg/dL), meal tags (Before/After meal, Fasting, Bedtime), timestamps, and symptoms.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                <Pill className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Insulin & Dosage History</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Basal and bolus insulin dosage units, time slot allocations (morning, lunch, evening, night), and custom dosage notes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Weight & Body Metrics</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Body weight entries (kg/lbs), high/low target thresholds, emergency contact details, and trend analytics.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 mt-0.5">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Smart Scan OCR Readings</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Glucose meter display OCR scan images, confidence ratings, device model presets, and scan history.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Prescriptions & Clinical Notes</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Doctor-issued prescriptions, insulin schedules, patient dose logs, clinical notes, and doctor access permissions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Notifications & Push Devices</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  FCM / APNs push notification device tokens, reminder schedules, reminder history logs, and alert preferences.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/70 shadow-sm">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Local Cache & Device Storage</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Mobile SQLite cache, Capacitor Preferences keys, LocalStorage items, and pending offline sync queues.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: DATA RETENTION & EXCEPTIONS */}
        <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 space-y-5 shadow-sm">
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" /> Data Retention Policy & Exceptions
          </h2>

          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-1">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">Personal & Medical Data Retention</h4>
              <p>
                <strong>0 Days (Zero Retention)</strong>: Once an account deletion is initiated and confirmed, all personal identity records, blood glucose readings, insulin doses, body weight metrics, smart scan images, and clinical notes are deleted immediately from all server database tables and backup caches. We do not retain any user health data.
              </p>
            </div>

            <div className="bg-muted/40 p-4 rounded-2xl border border-border/50 space-y-1">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wide">System & Security Infrastructure Logs</h4>
              <p>
                For security, fraud prevention, and DDoS protection, Cloudflare edge servers automatically log basic non-identifiable web request connection details (e.g. IP address, HTTP request method, user-agent header, and request timestamp). These logs contain <strong>no personal health data</strong> or account credentials, and are automatically purged/rotated after <strong>30 days</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 5: CONTACT & SUPPORT */}
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 text-center space-y-3">
          <h3 className="font-bold text-foreground text-base">Questions Regarding Account Deletion?</h3>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            If you have questions about our data safety practices or need assistance with an account deletion request, please reach out to our privacy compliance officer:
          </p>
          <div className="pt-1 inline-flex items-center gap-2 text-primary font-bold text-sm bg-background px-4 py-2 rounded-xl border border-border shadow-xs">
            <Mail className="h-4 w-4" /> contact@vioraa.app / vivekdhedhi21@gmail.com
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span>&copy; {new Date().getFullYear()} GlucoLab Pro. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground">Sign In</Link>
            <Link to="/delete-account" className="hover:text-foreground font-semibold text-primary">Account Deletion Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
