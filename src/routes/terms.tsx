import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ShieldAlert, ArrowLeft, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — GlucoLab" },
      {
        name: "description",
        content: "Terms of Service for GlucoLab. Rules, medical disclaimers, user rights, and service conditions.",
      },
    ],
  }),
});

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Effective: August 2026</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Please read these Terms of Service ("Terms") carefully before using the GlucoLab web or mobile application.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /> Critical Medical Disclaimer Notice
          </div>
          <p>
            GlucoLab is an information tracking tool designed solely to log personal blood glucose measurements, insulin doses, and weight. <strong>GlucoLab is NOT a medical device, diagnostic tool, or substitute for professional clinical advice.</strong> Always consult a qualified physician for medical advice, treatment adjustments, or medical emergencies.
          </p>
        </div>

        <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">1. Acceptable Use</h2>
            <p>You agree to use GlucoLab only for personal health logging or clinical supervision. You must not:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Reverse engineer, decompile, or attempt to extract source code from the binary packages.</li>
              <li>Submit false, fraudulent, or malicious health entries into shared doctor portals.</li>
              <li>Attempt to bypass authentication, authorization checks, or API security rate limits.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">2. User Account & Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for enabling device biometrics or password protection. GlucoLab is not liable for unauthorized access resulting from compromised user credentials.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">3. Intellectual Property</h2>
            <p>
              All software components, branding, graphics, and interface designs are protected under copyright laws. User health data logged remains the sole property of the user.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-xl font-bold font-display text-foreground">4. Termination & Account Deletion</h2>
            <p>
              You may terminate your account at any time using the self-service options in settings or by visiting <Link to="/delete-account" className="text-primary underline">/delete-account</Link>. We reserve the right to suspend accounts violating acceptable use policies.
            </p>
          </section>
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/medical-disclaimer" className="hover:underline">Medical Disclaimer</Link>
          <span>•</span>
          <Link to="/contact" className="hover:underline">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
