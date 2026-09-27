import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  Lock,
  Mail,
  FileSpreadsheet,
  Smartphone,
  Calendar,
  Info,
  KeyRound,
  FileCheck,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { useAuth } from "@/frontend/lib/auth-context";
import { supabase } from "@/db/client";
import { localDbService } from "@/services/localDbService";
import { toast } from "sonner";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete Account & Data — GlucoLab Pro" },
      {
        name: "description",
        content:
          "Official account and health data deletion request portal for GlucoLab Pro diabetes management companion.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();

  // Active user deletion states
  const [confirmText, setConfirmText] = useState("");
  const [activePassword, setActivePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletedSuccessfully, setIsDeletedSuccessfully] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState("");

  // Unauthenticated direct deletion states
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [directConfirmAck, setDirectConfirmAck] = useState(false);
  const [directLoading, setDirectLoading] = useState(false);

  // Unauthenticated offline request states
  const [requestEmail, setRequestEmail] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestAck, setRequestAck] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSubmittedRef, setRequestSubmittedRef] = useState<string | null>(null);

  // Active tab for unauthenticated visitors
  const [unauthTab, setUnauthTab] = useState<"instant" | "request">("instant");

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: user ? "/settings" : "/welcome" });
    }
  };

  // Handle deletion for logged-in user
  const handleAuthenticatedDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm permanent deletion.");
      return;
    }

    const confirmed = window.confirm(
      "WARNING: This will permanently erase your blood glucose entries, insulin logs, weight metrics, and profile. This action CANNOT be reversed. Do you wish to proceed?",
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const token = session?.access_token;
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          password: activePassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to complete account deletion.");
      }

      // 1. Clear local caches if in mobile or local storage
      try {
        await localDbService.clearAllCaches();
      } catch (cacheErr) {
        console.warn("Cache clearing non-critical error:", cacheErr);
      }

      // 2. Sign out auth session
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn("Sign out non-critical error:", signOutErr);
      }

      setIsDeletedSuccessfully(true);
      setDeletionSummary(data.message || "Account successfully purged.");
      toast.success("Account permanently deleted.");
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      toast.error(err.message || "Deletion failed. Please verify credentials or contact support.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle direct deletion with email & password (when not already logged in)
  const handleDirectDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmail.trim() || !directPassword) {
      toast.error("Email and password are required.");
      return;
    }
    if (!directConfirmAck) {
      toast.error("Please confirm that you understand this action is irreversible.");
      return;
    }

    const confirmed = window.confirm(
      `Are you absolutely sure you want to permanently delete the GlucoLab account for ${directEmail}? All glucose, insulin, and medical records will be deleted forever.`,
    );
    if (!confirmed) return;

    setDirectLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: directEmail.trim(),
          password: directPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Authentication failed or error processing deletion.");
      }

      setIsDeletedSuccessfully(true);
      setDeletionSummary(data.message || "Account and records successfully deleted.");
      toast.success("Account deleted.");
    } catch (err: any) {
      console.error("Direct deletion failed:", err);
      toast.error(err.message || "Deletion failed. Please check your credentials.");
    } finally {
      setDirectLoading(false);
    }
  };

  // Handle public deletion request form submission (no password / forgot password)
  const handleRequestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestEmail.trim()) {
      toast.error("Registered email address is required.");
      return;
    }
    if (!requestAck) {
      toast.error("Please check the confirmation checkbox.");
      return;
    }

    setRequestLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: requestEmail.trim(),
          reason: requestReason.trim(),
          requestOnly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to submit deletion request.");
      }

      setRequestSubmittedRef(data.referenceId || `DEL-${Date.now().toString(36).toUpperCase()}`);
      toast.success("Deletion request submitted.");
    } catch (err: any) {
      console.error("Request submission error:", err);
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setRequestLoading(false);
    }
  };

  // SUCCESS SCREEN: When account is fully deleted
  if (isDeletedSuccessfully) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border/80 rounded-3xl p-8 shadow-elevated text-center space-y-6 animate-fade-in">
          <div className="h-16 w-16 mx-auto rounded-3xl bg-destructive/10 text-destructive flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl font-bold text-foreground">
              Account &amp; Records Permanently Deleted
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {deletionSummary ||
                "Your GlucoLab Pro user profile, authentication credentials, and all recorded blood glucose, insulin, and weight logs have been completely and permanently erased from our database."}
            </p>
          </div>

          <div className="rounded-2xl bg-muted/40 p-4 text-xs text-muted-foreground text-left space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldAlert className="h-4 w-4 text-success" />
              Privacy Assurance
            </div>
            <p>
              No residual backups or analytics profiles associated with your account are retained. If you choose to use GlucoLab in the future, you may register as a new patient at any time.
            </p>
          </div>

          <Link to="/welcome" className="block">
            <Button className="w-full gradient-primary text-primary-foreground font-semibold rounded-xl">
              Return to Home Screen
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-destructive/20">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="gap-1.5 text-xs font-bold rounded-xl border-border/80 hover:bg-muted shadow-xs"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Link to="/" className="font-display font-bold text-sm text-foreground hover:text-primary transition-colors hidden sm:inline-block">
              GlucoLab Pro
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/privacy-policy">
              <Button variant="ghost" size="sm" className="text-xs font-semibold rounded-xl">
                Privacy Policy
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header Title Card */}
        <section className="relative overflow-hidden rounded-3xl border border-destructive/30 bg-destructive/5 p-6 sm:p-10 shadow-soft">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-destructive/10 blur-3xl pointer-events-none" />

          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-destructive">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1 text-destructive font-bold">
                <Trash2 className="h-3.5 w-3.5" />
                Permanent Data &amp; Account Deletion
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Google Play &amp; GDPR Compliant Portal
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Delete GlucoLab Account &amp; Medical Data
            </h1>

            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              We respect your right to be forgotten. Through this official portal, you can permanently and irreversibly
              delete your GlucoLab account along with all blood sugar readings, insulin logs, weight records, and device tokens.
            </p>
          </div>
        </section>

        {/* Essential Disclosures: What Data is Deleted vs Retained (Mandatory for App Store & Google Play) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-3 shadow-soft">
            <div className="flex items-center gap-2.5 text-destructive font-bold text-sm font-display">
              <Trash2 className="h-4 w-4" />
              <span>What Data is Permanently Erased</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground pl-1 leading-relaxed">
              <li>
                <strong className="text-foreground">Blood Glucose Records:</strong> All historical mg/dL &amp; mmol/L readings, meal context, notes, and symptoms.
              </li>
              <li>
                <strong className="text-foreground">Insulin Dosing:</strong> All basal and bolus dosages and administration schedules.
              </li>
              <li>
                <strong className="text-foreground">Weight &amp; Lab Metrics:</strong> Weight logs, BMI history, and HbA1c test entries.
              </li>
              <li>
                <strong className="text-foreground">Prescription &amp; Meter Scans:</strong> Optical character recognition (OCR) scanner logs and metadata.
              </li>
              <li>
                <strong className="text-foreground">User Profile:</strong> Full name, registered email address, and encrypted credentials.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card p-6 space-y-3 shadow-soft">
            <div className="flex items-center gap-2.5 text-success font-bold text-sm font-display">
              <ShieldAlert className="h-4 w-4" />
              <span>Retention Period &amp; Zero Residue Policy</span>
            </div>
            <div className="space-y-3 text-xs text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">Immediate Deletion:</strong> We do NOT retain your health logs or personal metrics for advertising, training, or data resale. All database rows and associated credentials are permanently purged immediately upon confirmation.
              </p>
              <div className="rounded-2xl bg-muted/40 p-3.5 space-y-1 border border-border/50">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  Tip: Export your data first
                </div>
                <p className="text-[11px]">
                  If your doctor or endocrinologist requires your recent logs, please export your doctor-ready PDF or Excel (.xlsx) file from the <strong>Reports</strong> tab in the app before initiating deletion.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION A: Logged-in User Experience */}
        {user ? (
          <section className="rounded-3xl border border-destructive/40 bg-card p-6 sm:p-8 space-y-6 shadow-elevated">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                  Active Session Detected
                </span>
                <h2 className="text-xl font-bold font-display text-foreground mt-2">
                  Confirm Deletion for Logged-In Account
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  You are currently authenticated as{" "}
                  <strong className="text-foreground font-semibold">{user.email}</strong>.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs space-y-2 text-destructive">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertTriangle className="h-4 w-4" />
                This action is irreversible
              </div>
              <p className="text-destructive/90">
                Once confirmed, all diabetes logs, insulin doses, and device tokens tied to your account will be immediately destroyed.
              </p>
            </div>

            <form onSubmit={handleAuthenticatedDelete} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="confirm-box" className="text-xs font-semibold">
                  Type <span className="font-mono text-destructive font-bold">DELETE</span> to confirm:
                </Label>
                <Input
                  id="confirm-box"
                  required
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="font-mono text-sm uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="active-password" className="text-xs font-semibold">
                  Confirm Account Password (Optional verification):
                </Label>
                <Input
                  id="active-password"
                  type="password"
                  placeholder="Enter your password"
                  value={activePassword}
                  onChange={(e) => setActivePassword(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isDeleting || confirmText.trim().toUpperCase() !== "DELETE"}
                  variant="destructive"
                  className="w-full sm:w-auto px-6 font-semibold rounded-xl"
                >
                  {isDeleting ? "Permanently Erasing Data..." : "Permanently Delete My Account & All Data"}
                </Button>
              </div>
            </form>
          </section>
        ) : (
          /* SECTION B: Unauthenticated / Web Visitor Experience */
          <section className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-6 shadow-elevated">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-display text-foreground">
                Self-Service Account Deletion Options
              </h2>
              <p className="text-xs text-muted-foreground">
                Choose the deletion method that matches your current access status:
              </p>
            </div>

            {/* Toggle Tabs */}
            <div className="flex rounded-2xl bg-muted p-1 max-w-md">
              <button
                type="button"
                onClick={() => setUnauthTab("instant")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  unauthTab === "instant"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Instant Deletion (with Password)
              </button>
              <button
                type="button"
                onClick={() => setUnauthTab("request")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  unauthTab === "request"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Submit Deletion Request (No App Access)
              </button>
            </div>

            {/* Tab 1: Instant Deletion with credentials */}
            {unauthTab === "instant" && (
              <form onSubmit={handleDirectDelete} className="space-y-4 max-w-md animate-fade-in">
                <div className="space-y-1.5">
                  <Label htmlFor="direct-email" className="text-xs font-semibold">
                    Registered Email Address
                  </Label>
                  <Input
                    id="direct-email"
                    type="email"
                    required
                    placeholder="patient@example.com"
                    value={directEmail}
                    onChange={(e) => setDirectEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="direct-password" className="text-xs font-semibold">
                    Account Password
                  </Label>
                  <Input
                    id="direct-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={directPassword}
                    onChange={(e) => setDirectPassword(e.target.value)}
                  />
                </div>

                <div className="flex items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="direct-ack"
                    checked={directConfirmAck}
                    onChange={(e) => setDirectConfirmAck(e.target.checked)}
                    className="mt-0.5 rounded border-border"
                  />
                  <Label htmlFor="direct-ack" className="text-xs text-muted-foreground cursor-pointer leading-tight">
                    I acknowledge that clicking delete will immediately and irreversibly wipe all blood glucose logs, insulin schedules, and account records.
                  </Label>
                </div>

                <Button
                  type="submit"
                  disabled={directLoading || !directConfirmAck}
                  variant="destructive"
                  className="w-full font-semibold rounded-xl mt-2"
                >
                  {directLoading ? "Verifying & Deleting..." : "Verify Credentials & Delete Account"}
                </Button>
              </form>
            )}

            {/* Tab 2: Public Request Form */}
            {unauthTab === "request" && (
              <div className="space-y-4 max-w-md animate-fade-in">
                {requestSubmittedRef ? (
                  <div className="rounded-2xl border border-success/30 bg-success/10 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-success font-bold text-sm">
                      <CheckCircle2 className="h-5 w-5" />
                      Deletion Request Received
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Your deletion request has been formally logged. If an account is associated with{" "}
                      <strong className="text-foreground">{requestEmail}</strong>, our compliance team will initiate
                      complete purging within 24 to 48 hours.
                    </p>
                    <div className="rounded-xl bg-background/80 p-3 font-mono text-xs border border-border/60">
                      Reference ID: <strong className="text-foreground">{requestSubmittedRef}</strong>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequestFormSubmit} className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      If you have uninstalled the app or lost your password, submit your registered email below.
                    </p>

                    <div className="space-y-1.5">
                      <Label htmlFor="req-email" className="text-xs font-semibold">
                        Registered Account Email
                      </Label>
                      <Input
                        id="req-email"
                        type="email"
                        required
                        placeholder="your-email@example.com"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="req-reason" className="text-xs font-semibold">
                        Reason for Deletion (Optional)
                      </Label>
                      <Input
                        id="req-reason"
                        placeholder="e.g. Switched to another monitor, no longer needed"
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                      />
                    </div>

                    <div className="flex items-start gap-2.5 pt-1">
                      <input
                        type="checkbox"
                        id="req-ack"
                        checked={requestAck}
                        onChange={(e) => setRequestAck(e.target.checked)}
                        className="mt-0.5 rounded border-border"
                      />
                      <Label htmlFor="req-ack" className="text-xs text-muted-foreground cursor-pointer leading-tight">
                        I confirm that I am the account holder requesting the permanent deletion of my GlucoLab profile and medical data.
                      </Label>
                    </div>

                    <Button
                      type="submit"
                      disabled={requestLoading || !requestAck}
                      className="w-full gradient-primary text-primary-foreground font-semibold rounded-xl mt-2"
                    >
                      {requestLoading ? "Submitting Request..." : "Submit Formal Deletion Request"}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {/* Step-by-Step Mobile In-App Instructions */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm font-display">
            <Smartphone className="h-4 w-4 text-primary" />
            <span>How to Delete Your Account Inside the GlucoLab Mobile App</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            If you have the GlucoLab Pro mobile application installed on your Android or iOS device, you can delete your account directly at any time:
          </p>

          <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground pl-1 leading-relaxed">
            <li>
              Open the <strong>GlucoLab Pro</strong> app on your device.
            </li>
            <li>
              Tap on the <strong>Settings</strong> tab in the bottom navigation menu.
            </li>
            <li>
              Scroll down to the <strong>Account &amp; Security</strong> section.
            </li>
            <li>
              Tap <strong>Delete Account &amp; Medical Data</strong>.
            </li>
            <li>
              Confirm your password or enter <span className="font-mono font-bold text-foreground">DELETE</span> to immediately purge your device cache and server records.
            </li>
          </ol>
        </section>

        {/* Support & Contact Information */}
        <section className="rounded-3xl border border-border/80 bg-card p-6 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Info className="h-4 w-4 text-primary" />
            <span>Need Assistance with Data Portability or Deletion?</span>
          </div>
          <p>
            If you encounter any issues or have questions regarding our data retention protocols, contact our Privacy Compliance Officer directly at{" "}
            <a href="mailto:support@glucolab.app" className="text-primary hover:underline font-mono">
              support@glucolab.app
            </a>
            .
          </p>
        </section>

        {/* Return to App Action */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleBack}
            className="font-semibold rounded-xl px-6 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Previous Page
          </Button>
          <Link to="/">
            <Button size="sm" className="gradient-primary text-primary-foreground font-semibold rounded-xl px-6">
              Return to GlucoLab App
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <footer className="pt-4 border-t border-border/60 text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} GlucoLab Pro. Official Account Deletion &amp; Data Erasure Portal.
          </p>
        </footer>
      </main>
    </div>
  );
}
