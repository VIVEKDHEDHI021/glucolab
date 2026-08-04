import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, Heart, FileText, ArrowLeft, Mail, Database, EyeOff, UserCheck } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — GlucoLab" },
      {
        name: "description",
        content:
          "Comprehensive Privacy Policy for GlucoLab. Learn how we handle your blood glucose, insulin, weight data, and account information in accordance with Google Play Health Apps Policies.",
      },
    ],
  }),
});

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Last Updated: August 2026</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <ShieldCheck className="h-4 w-4" /> Google Play Health Policy Compliant
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            At GlucoLab, your personal health information, blood glucose logs, insulin schedules, and clinical reports are treated with the highest standard of privacy, security, and data protection.
          </p>
        </div>

        {/* Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Lock className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Encrypted Storage</h3>
            <p className="text-xs text-muted-foreground">
              All health metrics are encrypted in transit via TLS 1.3 and at rest in our secure database.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <EyeOff className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Zero Data Selling</h3>
            <p className="text-xs text-muted-foreground">
              We never sell, monetize, or rent your health data or personal identifiers to third parties.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <UserCheck className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Full User Control</h3>
            <p className="text-xs text-muted-foreground">
              You own your data. You can export or permanently delete your account and all logs at any time.
            </p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">1. Information We Collect</h2>
            <p>GlucoLab collects only data essential for providing glucose logging, insulin calculation assistance, and clinical report generation:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Account Credentials:</strong> Email address, name, password hash, and authentication tokens.</li>
              <li><strong>Health & Medical Data:</strong> Blood glucose readings (mg/dL or mmol/L), insulin doses, medication times, meal tags, weight logs, and smart scanner image logs.</li>
              <li><strong>Doctor Access Records:</strong> Consent records authorizing specific healthcare providers to view your reports.</li>
              <li><strong>Device & Diagnostics:</strong> Push notification tokens (FCM) and native device biometrics (processed strictly locally on your device).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">2. How Your Data Is Used</h2>
            <p>Your health data is exclusively used to provide app functionality, including:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Rendering interactive glucose trend graphs and calculating HbA1c estimates.</li>
              <li>Generating downloadable PDF and Excel clinical summary reports for your doctor visits.</li>
              <li>Syncing offline SQLite records with cloud backup storage when internet connectivity is active.</li>
              <li>Sending medication and blood sugar test reminders via push notifications.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">3. Google Play Health Apps Policy Declaration</h2>
            <p>
              GlucoLab complies with the Google Play Health Apps Policy. Health data collected by GlucoLab is handled as sensitive personal data. We do not use health data for advertising target profiling, market analysis, or credit assessment. Access to patient records by healthcare providers requires explicit, user-initiated consent with configurable permission levels and revocation rights.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">4. Data Retention & Permanent Deletion</h2>
            <p>
              Your data is stored for as long as your account remains active. You may request permanent deletion of your account and all associated personal and health data directly within the app settings or via our public <Link to="/delete-account" className="text-primary underline">Account Deletion Page</Link>. Upon deletion, all records are permanently purged from server databases within 24 hours and cleared from local device caches.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">5. Contact Information</h2>
            <p>If you have questions or concerns regarding this Privacy Policy or data security practices, contact us at:</p>
            <div className="p-4 rounded-xl bg-muted/40 border border-border font-mono text-xs space-y-1">
              <p>GlucoLab Data Protection & Privacy Team</p>
              <p>Email: privacy@glucolab.app</p>
              <p>Support Portal: <Link to="/contact" className="text-primary underline">/contact</Link></p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
          <span>•</span>
          <Link to="/medical-disclaimer" className="hover:underline">Medical Disclaimer</Link>
          <span>•</span>
          <Link to="/data-safety" className="hover:underline">Data Safety</Link>
          <span>•</span>
          <Link to="/delete-account" className="hover:underline">Delete Account</Link>
        </div>
      </div>
    </div>
  );
}
