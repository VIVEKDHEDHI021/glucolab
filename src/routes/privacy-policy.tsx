import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/frontend/lib/auth-context";
import {
  ShieldCheck,
  Lock,
  Activity,
  Bell,
  Camera,
  Database,
  UserCheck,
  AlertTriangle,
  Mail,
  ArrowLeft,
  Printer,
  Calendar,
  FileCheck,
  CheckCircle2,
  HelpCircle,
  EyeOff,
  Trash2,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — GlucoLab Pro" },
      {
        name: "description",
        content:
          "Official Privacy Policy and Health Data Protection standards for GlucoLab Pro diabetes companion application.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: user ? "/settings" : "/welcome" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      {/* Top sticky header */}
      <header className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-md",
        Capacitor.isNativePlatform() && "pt-[calc(max(env(safe-area-inset-top,0px),44px))]"
      )}>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs font-medium rounded-xl print:hidden"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Policy
            </Button>
            <Link to={user ? "/dashboard" : "/login"}>
              <Button size="sm" className="gradient-primary text-primary-foreground text-xs font-semibold rounded-xl">
                {user ? "Dashboard" : "Open App"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Title Header Card */}
        <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 sm:p-10 shadow-soft">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                Official Privacy Policy
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Effective: September 2026
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-success">
                <FileCheck className="h-3.5 w-3.5" />
                Version 2.4.0
              </span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              GlucoLab Pro Privacy Policy
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
              Your health and diabetes records belong exclusively to you. This Privacy Policy details the rigorous
              safeguards, encryption protocols, and zero-monetization standards governing all data within GlucoLab.
            </p>
          </div>
        </section>

        {/* Quick Highlights Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-soft">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <EyeOff className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Zero Data Selling</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We never sell, broker, or license your medical or personal metrics to advertisers, insurance providers, or third parties.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-soft">
            <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">End-to-End Encryption</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All communications utilize TLS 1.3 encryption in-transit, backed by PostgreSQL Row-Level Security (RLS) isolation.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-2 shadow-soft">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Complete Patient Control</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export comprehensive reports to PDF/Excel at any time, or permanently purge your account and database records with one click.
            </p>
          </div>
        </section>

        {/* Structured Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <article id="overview" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">1. Overview & Commitment</h2>
            </div>
            <p>
              GlucoLab Pro (&quot;GlucoLab&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting the privacy and confidentiality of individuals managing diabetes, pre-diabetes, and related metabolic conditions.
            </p>
            <p>
              This policy explains how our mobile application (Android and iOS) and web platform collect, store, synchronize, and protect your information. By accessing or using GlucoLab, you consent to the data practices described in this document.
            </p>
          </article>

          {/* Section 2 */}
          <article id="data-collected" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">2. Information We Collect</h2>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-foreground text-sm">A. Health and Metabolic Records</h3>
              <p>
                When you use GlucoLab, you may record clinical metrics vital to diabetes management, including:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-xs">
                <li><strong className="text-foreground">Blood Glucose Levels:</strong> mg/dL or mmol/L readings categorized by context (fasting, pre-meal, post-meal, bedtime, exercise, or nighttime).</li>
                <li><strong className="text-foreground">Insulin Dosing:</strong> Rapid-acting bolus, long-acting basal units, injection timestamps, and scheduling preferences.</li>
                <li><strong className="text-foreground">Body Metrics & Lab Results:</strong> Weight, body mass index (BMI), HbA1c lab percentages, and ketone test results.</li>
                <li><strong className="text-foreground">Dietary & Activity Notes:</strong> Carbohydrate intake estimations, meal descriptions, and exercise logs.</li>
              </ul>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="font-semibold text-foreground text-sm">B. Account & Authentication Information</h3>
              <p>
                To synchronize your logs across devices and prevent data loss, we store your email address, full name, encrypted password hashes, and session authentication tokens.
              </p>
            </div>

          </article>

          {/* Section 3 */}
          <article id="permissions" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Camera className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">3. Device Hardware & Permissions</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <Camera className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground text-xs">Camera & Photo Library (Scanner Module)</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Used strictly for the optical character recognition (OCR) feature allowing you to scan glucose meter screens, lab reports, and paper logs. Image processing is performed securely; photos are never cataloged, sold, or shared for advertising.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl bg-muted/40 p-4">
                <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-foreground text-xs">Biometric Authentication (Fingerprint & Face Unlock)</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Operates through your operating system&apos;s secure enclave (`Capacitor Native Biometric`). GlucoLab never accesses, transmits, or stores your biometric raw images or mathematical templates on any server.
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Section 4 */}
          <article id="security" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Database className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">4. Storage, Security & Compliance</h2>
            </div>

            <p>
              We implement industry-leading technical and administrative defenses to safeguard your sensitive clinical data:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Row-Level Security (RLS)
                </div>
                <p className="text-muted-foreground">
                  Database queries strictly enforce user identity boundaries at the database engine level. No user can access or view another patient&apos;s records.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Encryption in Transit & at Rest
                </div>
                <p className="text-muted-foreground">
                  Encrypted across all channels with TLS 1.3 protocol and industry-standard AES-256 block ciphers at rest.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Local Offline SQLite Cache
                </div>
                <p className="text-muted-foreground">
                  On mobile devices, records are stored in a sandboxed local database to guarantee offline functionality and fast sync without data loss.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Compliance Principles
                </div>
                <p className="text-muted-foreground">
                  Designed aligned with GDPR (EU), CCPA (California), HIPAA principles for privacy protection, and global digital personal data regulations.
                </p>
              </div>
            </div>
          </article>

          {/* Section 5 */}
          <article id="third-parties" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">5. Third-Party Infrastructure Providers</h2>
            </div>
            <p>
              To maintain global reliability and speed, GlucoLab integrates with vetted infrastructure providers adhering to stringent data protection agreements:
            </p>
            <ul className="list-disc list-inside space-y-2 text-xs pl-2">
              <li>
                <strong className="text-foreground">Supabase:</strong> Scalable, SOC2-compliant PostgreSQL cloud storage and identity provider.
              </li>
              <li>
                <strong className="text-foreground">Cloudflare Workers:</strong> High-performance serverless compute and DDoS-protected edge infrastructure.
              </li>
            </ul>
          </article>

          {/* Section 6 */}
          <article id="patient-rights" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserCheck className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">6. Your Rights & Data Deletion</h2>
            </div>
            <p>
              We believe in uncompromised patient data ownership. Under GDPR, CCPA, and applicable health privacy frameworks, you have the right to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs pl-2">
              <li><strong className="text-foreground">Data Portability:</strong> Export your full glucose, insulin, and weight logs at any time in structured Excel (.xlsx) or formatted PDF reports to share with your endocrinologist.</li>
              <li><strong className="text-foreground">Correction:</strong> Edit, update, or re-categorize any historical reading directly inside the History tab.</li>
              <li><strong className="text-foreground">Complete Deletion (Right to be Forgotten):</strong> Request permanent account deletion. Upon verification, all corresponding entries, backup logs, and token associations are permanently purged from our database.</li>
            </ul>
            <div className="pt-2">
              <Link to="/delete-account">
                <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                  Account &amp; Data Deletion Portal
                </Button>
              </Link>
            </div>
          </article>

          {/* Section 7 */}
          <article id="medical-disclaimer" className="rounded-3xl border border-warning/40 bg-warning/5 p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-warning/20 text-warning flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">7. Medical & Emergency Disclaimer</h2>
            </div>
            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
              <strong>GlucoLab Pro is an informational and personal health log management tool.</strong> It is not a certified medical device, continuous glucose monitor hardware sensor, or automated insulin delivery system.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nothing contained within the application should be construed as medical diagnosis, prescription advice, or direct treatment instructions. In case of acute hypoglycemia, severe hyperglycemia, diabetic ketoacidosis (DKA), or any medical emergency, seek immediate emergency medical care or call your local emergency services (e.g. 911/112).
            </p>
          </article>

          {/* Section 8 */}
          <article id="children" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <HelpCircle className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">8. Children&apos;s Privacy (COPPA Compliance)</h2>
            </div>
            <p className="text-xs">
              GlucoLab is not directed toward children under 13 years of age (or under 16 in certain EU jurisdictions) without verified parental or legal guardian supervision. If you believe a minor has registered an account without parental consent, please contact us immediately to have the account and data purged.
            </p>
          </article>

          {/* Section 9 */}
          <article id="contact" className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 space-y-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground font-display">9. Contact Us & Privacy Inquiries</h2>
            </div>
            <p className="text-xs">
              If you have questions regarding this Privacy Policy, wish to exercise your data deletion rights, or require data protection officer assistance, please contact:
            </p>
            <div className="rounded-2xl bg-muted/40 p-4 text-xs space-y-1 font-mono">
              <p><strong className="text-foreground font-sans">Entity:</strong> GlucoLab Pro Health Team</p>
              <p><strong className="text-foreground font-sans">Email:</strong> support@glucolab.app</p>
              <p><strong className="text-foreground font-sans">Support Domain:</strong> https://glucolab.vioraa.workers.dev</p>
            </div>
          </article>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8 text-center space-y-4 shadow-soft">
          <h3 className="font-display text-lg font-bold text-foreground">Ready to take control of your glycemic health?</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Experience secure, effortless blood sugar tracking with clinical charting and doctor-ready reports.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleBack}
              className="font-semibold rounded-xl px-6 gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Previous Page
            </Button>
            <Link to="/signup">
              <Button className="gradient-primary text-primary-foreground font-semibold rounded-xl px-6">
                Create Free Account
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="font-semibold rounded-xl px-6">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <footer className="pt-6 border-t border-border/60 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span>GlucoLab Pro &bull; Next-Gen Diabetes Management</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} GlucoLab. All rights reserved. Built with HIPAA and GDPR data privacy standards in mind.
          </p>
        </footer>
      </main>
    </div>
  );
}
