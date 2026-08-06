import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Lock,
  Database,
  EyeOff,
  UserCheck,
  ArrowLeft,
  Mail,
  FileText,
  Bell,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Globe,
  Download,
} from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — GlucoLab | Personal Diabetes Management" },
      {
        name: "description",
        content:
          "Comprehensive Privacy Policy for GlucoLab by Viora Technology. Learn how your blood glucose, insulin, weight, and account data are protected in compliance with Google Play Health Apps Policies.",
      },
      { property: "og:title", content: "Privacy Policy — GlucoLab" },
      {
        property: "og:description",
        content:
          "GlucoLab Privacy Policy. Full transparency on data collection, encrypted Supabase/SQLite storage, zero advertising sharing, and permanent account deletion.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.vioraa.app/privacy-policy" },
      { name: "twitter:card", content: "summary_large_image" },
      { rel: "canonical", href: "https://www.vioraa.app/privacy-policy" },
    ],
  }),
});

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb Navigation & Last Updated Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <nav className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-foreground">Privacy Policy</span>
          </nav>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-md">
            Last Updated: August 6, 2026
          </span>
        </div>

        {/* Hero Title & Compliance Badge */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <ShieldCheck className="h-4 w-4" /> Google Play Health Policy Compliant
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab is committed to safeguarding your privacy and treating your health metrics with strict security, encryption, and confidentiality.
          </p>
        </div>

        {/* Key Principles Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-soft space-y-2">
            <Lock className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Encrypted Storage</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All records are transmitted over HTTPS (TLS 1.3) and stored in encrypted Supabase cloud databases and local SQLite caches.
            </p>
          </div>
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-soft space-y-2">
            <EyeOff className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Zero Data Selling</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We never sell, monetize, or share your health records, personal identifiers, or app activity with third-party advertisers.
            </p>
          </div>
          <div className="p-5 rounded-3xl bg-card border border-border/80 shadow-soft space-y-2">
            <UserCheck className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Complete Control</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You own your clinical data. You can view, update, export (PDF/Excel), or permanently delete your account at any time.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-8 text-sm leading-relaxed">
          {/* Section 1: Introduction */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> 1. Introduction
            </h2>
            <p className="text-muted-foreground">
              Welcome to <strong>GlucoLab</strong>, a personal diabetes self-management application developed by <strong>Viora Technology</strong> ("we," "us," or "our"). GlucoLab is designed to help individuals track their daily blood glucose levels, insulin dosages, and weight metrics to foster personal diabetes awareness and structured self-management.
            </p>
            <p className="text-muted-foreground">
              This Privacy Policy explains what information we collect, how it is processed and stored, and your privacy rights regarding the use of our web and mobile applications (https://www.vioraa.app).
            </p>
          </section>

          {/* Section 2: Information We Collect */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-4">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> 2. Information We Collect
            </h2>
            <p className="text-muted-foreground">
              GlucoLab collects only the data essential to operate diabetes self-tracking and report generation features:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" /> Personal Information
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                  <li><strong>Name:</strong> For account identity & clinical report headers</li>
                  <li><strong>Email Address:</strong> For authentication & password resets</li>
                  <li><strong>Phone Number:</strong> Optional account security & profile identity</li>
                  <li><strong>User ID:</strong> Unique account identifier assigned by Supabase</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Health Information
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                  <li><strong>Blood Glucose Readings:</strong> Measurements (mg/dL or mmol/L) & tags (Fasting, Before/After Meals, Bedtime)</li>
                  <li><strong>Weight Records:</strong> Weight metrics (kg/lbs) & date entries</li>
                  <li><strong>Insulin Information:</strong> Dosage units & medication times</li>
                  <li><strong>Health Notes:</strong> User-entered dietary & exercise annotations</li>
                  <li><strong>Generated Reports:</strong> Exported summary documents</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3: How We Use Your Information */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> 3. How We Use Your Information
            </h2>
            <p className="text-muted-foreground">
              We process your data strictly to provide, maintain, and improve GlucoLab core features. Specifically, your data is used for:
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Account Management:</strong> Account creation & session maintenance
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Authentication:</strong> Secure Email + Password login & password reset
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Diabetes Tracking:</strong> Logging glucose, insulin, and weight
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Statistics & Charts:</strong> Visualizing glucose trends over time
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Report Generation:</strong> Creating user-initiated PDF and Excel exports
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Notifications:</strong> Triggering New Reading & test reminder alerts
              </li>
              <li className="flex items-center gap-2 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                <strong>Synchronization:</strong> Seamless syncing between offline SQLite & Supabase
              </li>
            </ul>
          </section>

          {/* Section 4: Data Storage */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" /> 4. Data Storage & Security Architecture
            </h2>
            <p className="text-muted-foreground">
              GlucoLab employs robust security infrastructure to protect your personal and health data:
            </p>
            <div className="space-y-2 pt-1 text-xs text-muted-foreground">
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                <strong className="text-foreground text-sm">Cloud Storage (Supabase)</strong>
                <p>Cloud infrastructure is hosted on Supabase with encrypted database storage, strict Row Level Security (RLS) policies, and automated daily backups.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                <strong className="text-foreground text-sm">Local Offline Storage (SQLite)</strong>
                <p>On mobile devices, records are cached in a local SQLite database (`glucolab_local`). This allows full offline functionality when internet connectivity is lost.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1">
                <strong className="text-foreground text-sm">HTTPS Encrypted Communication</strong>
                <p>All network communications between the GlucoLab app and servers are enforced via HTTPS with TLS 1.3 encryption in transit.</p>
              </div>
            </div>
          </section>

          {/* Section 5: Data Sharing */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <EyeOff className="h-5 w-5 text-primary" /> 5. Data Sharing & Non-Disclosure
            </h2>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" /> Strict Non-Commercial Policy
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>We do NOT sell personal or health information</strong> to any third party under any circumstances.</li>
                <li><strong>We do NOT share data with advertisers</strong>, data brokers, or marketing platforms.</li>
                <li><strong>Reports are shared only when initiated by you</strong> (e.g., manually downloading or sending a PDF/Excel report to your physician).</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Notifications */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> 6. Push & Reminders Notifications
            </h2>
            <p className="text-muted-foreground">
              GlucoLab delivers <strong>New Reading Notifications</strong> and local test reminders to prompt you to log glucose levels or take prescribed medication. You can customize or turn off notifications anytime in your device settings or within the app's notification preferences.
            </p>
          </section>

          {/* Section 7: Reports */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" /> 7. Generated Reports & Data Ownership
            </h2>
            <p className="text-muted-foreground">
              You can export structured logs and clinical summaries in <strong>PDF</strong> and <strong>Excel (.xlsx)</strong> formats directly from the app's Export section. All generated reports belong entirely to you, and you hold full ownership and discretion over how and with whom you share them.
            </p>
          </section>

          {/* Section 8: Account Deletion */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> 8. Permanent Account Deletion
            </h2>
            <p className="text-muted-foreground">
              You have the right to request full account and data deletion at any time. You can permanently delete your account directly from within the application (Profile / Settings -&gt; Delete Account) or online via our dedicated <Link to="/delete-account" className="text-primary font-bold underline">Delete Account Page</Link>.
            </p>
            <p className="text-muted-foreground">
              Executing account deletion permanently and irreversibly purges your personal information, email address, glucose logs, insulin history, weight entries, health notes, and cloud backups from our servers and local device caches.
            </p>
          </section>

          {/* Section 9: User Rights */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> 9. User Rights
            </h2>
            <p className="text-muted-foreground">
              As a GlucoLab user, you maintain complete autonomy over your health records:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs pt-1">
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 font-semibold text-foreground">
                1. View Data
              </div>
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 font-semibold text-foreground">
                2. Update Data
              </div>
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 font-semibold text-foreground">
                3. Export Reports
              </div>
              <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 font-semibold text-foreground">
                4. Delete Account
              </div>
            </div>
          </section>

          {/* Section 10: Children's Privacy */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> 10. Children's Privacy (Age 13+)
            </h2>
            <p className="text-muted-foreground">
              GlucoLab is strictly intended for individuals who are at least <strong>13 years of age or older</strong>. We do not knowingly collect or solicit personal information from children under the age of 13. If we become aware that a child under 13 has provided personal data, we will take immediate steps to delete such information from our records.
            </p>
          </section>

          {/* Section 11: Medical Disclaimer */}
          <section className="bg-card border border-amber-500/30 rounded-3xl p-6 shadow-soft space-y-3 bg-amber-500/5">
            <h2 className="text-xl font-bold font-display text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-amber-600" /> 11. Medical & Emergency Disclaimer
            </h2>
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
              <p>
                <strong>GlucoLab is designed solely for personal diabetes self-management tracking.</strong>
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>GlucoLab is <strong>NOT a medical device</strong> and is not approved for diagnostic purposes.</li>
                <li>GlucoLab does <strong>NOT provide medical diagnosis</strong>, clinical advice, or treatment formulas.</li>
                <li>GlucoLab does <strong>NOT replace professional medical advice</strong>, diagnosis, or treatment from a qualified healthcare practitioner.</li>
                <li>GlucoLab is <strong>NOT intended for emergency medical situations</strong> or acute hypoglycemia/hyperglycemia intervention.</li>
              </ul>
              <p className="pt-1 font-semibold">
                Always consult a qualified physician or endocrinologist before altering your insulin dosages, medication schedules, or treatment plans. If you experience a medical emergency, contact your local emergency services immediately.
              </p>
            </div>
          </section>

          {/* Section 12: Changes to Policy */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> 12. Changes to This Privacy Policy
            </h2>
            <p className="text-muted-foreground">
              We may update this Privacy Policy periodically to reflect app updates, security enhancements, or legal policy changes. Any updates will be published on this page with a revised "Last Updated" date. We encourage you to review this policy periodically.
            </p>
          </section>

          {/* Section 13: Contact */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-4">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> 13. Contact Developer
            </h2>
            <p className="text-muted-foreground">
              If you have any questions, feedback, or data privacy inquiries, please reach out to the developer:
            </p>
            <div className="p-4 rounded-2xl bg-muted/40 border border-border/60 space-y-2 text-xs">
              <p><strong>Developer:</strong> Viora Technology</p>
              <p><strong>Official Website:</strong> <a href="https://www.vioraa.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://www.vioraa.app</a></p>
              <p><strong>Support Email:</strong> <a href="mailto:contact@vioraa.app" className="text-primary underline font-mono">contact@vioraa.app</a></p>
            </div>
          </section>
        </div>

        {/* Global Footer Links */}
        <footer className="border-t border-border/80 pt-8 pb-4 text-center space-y-4">
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground justify-center">
            <Link to="/privacy-policy" className="text-primary underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link to="/delete-account" className="hover:text-primary transition-colors">
              Delete Account
            </Link>
            <span>•</span>
            <Link to="/medical-disclaimer" className="hover:text-primary transition-colors">
              Medical Disclaimer
            </Link>
            <span>•</span>
            <Link to="/data-safety" className="hover:text-primary transition-colors">
              Data Safety
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GlucoLab by Viora Technology. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
