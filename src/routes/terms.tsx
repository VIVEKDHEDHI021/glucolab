import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Lock,
  UserCheck,
  Stethoscope,
  Globe,
  Mail,
  Scale,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — GlucoLab | Personal Diabetes Management" },
      {
        name: "description",
        content:
          "Terms & Conditions for GlucoLab by Viora Technology. Acceptable use rules, eligibility (13+), medical disclaimers, user rights, and legal guidelines.",
      },
      { property: "og:title", content: "Terms & Conditions — GlucoLab" },
      {
        property: "og:description",
        content:
          "Official Terms & Conditions for using GlucoLab mobile and web applications developed by Viora Technology.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.vioraa.app/terms-and-conditions" },
      { name: "twitter:card", content: "summary_large_image" },
      { rel: "canonical", href: "https://www.vioraa.app/terms-and-conditions" },
    ],
  }),
});

export default function TermsPage() {
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
            <span className="text-foreground">Terms & Conditions</span>
          </nav>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-md">
            Last Updated: August 6, 2026
          </span>
        </div>

        {/* Hero Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
            <FileText className="h-4 w-4" /> Official Terms of Service
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Please read these Terms & Conditions ("Terms") carefully before using the GlucoLab web or mobile applications provided by Viora Technology.
          </p>
        </div>

        {/* Highlight Alert Banner: Medical Disclaimer */}
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2 shadow-soft">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /> Mandatory Health & Medical Disclaimer
          </div>
          <p className="leading-relaxed">
            GlucoLab is a personal logging and visualization tool intended solely for self-management tracking. <strong>GlucoLab is NOT a medical device, does NOT provide medical diagnosis, and does NOT replace professional healthcare advice.</strong> Always consult a qualified medical professional for treatment decisions or medical emergencies.
          </p>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6 text-sm leading-relaxed">
          {/* Section 1: Acceptance of Terms */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> 1. Acceptance of Terms
            </h2>
            <p className="text-muted-foreground">
              By registering an account, downloading, accessing, or using the GlucoLab application (the "Service"), you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree to these Terms, you must discontinue using the Service immediately.
            </p>
          </section>

          {/* Section 2: Eligibility (13+) */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> 2. Eligibility (Age 13+)
            </h2>
            <p className="text-muted-foreground">
              You must be at least <strong>13 years of age or older</strong> to use GlucoLab. By creating an account, you represent and warrant that you meet this minimum age requirement. If you are under 18, you represent that you are using the Service with the consent of a parent or legal guardian.
            </p>
          </section>

          {/* Section 3: User Accounts */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> 3. User Accounts & Security
            </h2>
            <p className="text-muted-foreground">
              Accounts are created using <strong>Email + Password</strong> authentication. Self-service password reset functionality is available at any time. You are responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Maintaining the confidentiality of your login credentials.</li>
              <li>Restricting physical access to your mobile device or browser session.</li>
              <li>Promptly notifying support at <a href="mailto:contact@vioraa.app" className="text-primary underline">contact@vioraa.app</a> if you suspect unauthorized account access.</li>
            </ul>
          </section>

          {/* Section 4: Acceptable Use */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> 4. Acceptable Use Policy
            </h2>
            <p className="text-muted-foreground">
              You agree to use GlucoLab solely for lawful personal health management. You shall not:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
              <li>Decompile, reverse engineer, or attempt to extract source code from GlucoLab binaries.</li>
              <li>Interfere with or disrupt server networks, Supabase APIs, or cloud database infrastructure.</li>
              <li>Upload malicious code, automated bots, or exploit security vulnerabilities.</li>
              <li>Misrepresent your identity or use another person's account without authorization.</li>
            </ul>
          </section>

          {/* Section 5: User Responsibilities */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> 5. User Responsibilities
            </h2>
            <p className="text-muted-foreground">
              You are responsible for ensuring your mobile device software is updated, maintaining secure passwords, and regularly reviewing your logged data. You acknowledge that exported PDF and Excel reports contain sensitive medical metrics and that you are solely responsible for protecting exported documents.
            </p>
          </section>

          {/* Section 6: Data Accuracy */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> 6. Data Accuracy
            </h2>
            <p className="text-muted-foreground">
              GlucoLab processes metrics (blood glucose levels, insulin units, weight, health notes) based on manual user entry or local device inputs. Viora Technology does not verify the accuracy or medical validity of data entered by users.
            </p>
          </section>

          {/* Section 7: Health Disclaimer */}
          <section className="bg-card border border-amber-500/30 rounded-3xl p-6 shadow-soft space-y-3 bg-amber-500/5">
            <h2 className="text-xl font-bold font-display text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-amber-600" /> 7. Comprehensive Health Disclaimer
            </h2>
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-2 leading-relaxed">
              <p>
                <strong>Personal Diabetes Self-Management Only:</strong> GlucoLab is strictly an informational software tool.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>GlucoLab is <strong>NOT a medical device</strong>.</li>
                <li>GlucoLab does <strong>NOT provide medical diagnosis</strong> or dosage algorithms.</li>
                <li>GlucoLab does <strong>NOT provide emergency medical services</strong>.</li>
              </ul>
              <p>
                Never disregard professional medical advice or delay seeking care because of charts, statistics, or reports generated by GlucoLab. In an emergency, contact your doctor or local emergency services immediately.
              </p>
            </div>
          </section>

          {/* Section 8: Intellectual Property */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> 8. Intellectual Property Rights
            </h2>
            <p className="text-muted-foreground">
              All branding, trade names, software code, design assets, trademarks, and intellectual property associated with GlucoLab are the exclusive property of <strong>Viora Technology</strong>. Users retain full ownership of their raw self-reported health records.
            </p>
          </section>

          {/* Section 9: Account Suspension & Termination */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> 9. Account Suspension & Termination
            </h2>
            <p className="text-muted-foreground">
              We reserve the right to suspend or terminate accounts that violate these Terms or engage in security abuse. You may terminate your account at any time by executing self-service account deletion in the application settings or visiting <Link to="/delete-account" className="text-primary underline">/delete-account</Link>.
            </p>
          </section>

          {/* Section 10: Limitation of Liability */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> 10. Limitation of Liability
            </h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by applicable law, Viora Technology and its officers, developers, and partners shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of health data resulting from device loss, user input errors, or service interruptions.
            </p>
          </section>

          {/* Section 11: Privacy */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> 11. Privacy Policy Integration
            </h2>
            <p className="text-muted-foreground">
              Your submission of personal and health data through the Service is governed by our <Link to="/privacy-policy" className="text-primary font-bold underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.
            </p>
          </section>

          {/* Section 12: Changes to Terms */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> 12. Modifications to Terms
            </h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. Updated versions will be posted on this page with a revised "Last Updated" date. Continued use of GlucoLab following posted updates constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 13: Governing Law */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" /> 13. Governing Law
            </h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with applicable governing laws, without regard to conflict of law principles.
            </p>
          </section>

          {/* Section 14: Contact Information */}
          <section className="bg-card border border-border/80 rounded-3xl p-6 shadow-soft space-y-4">
            <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> 14. Contact Information
            </h2>
            <p className="text-muted-foreground">
              For legal inquiries, questions about these Terms, or support requests:
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
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="text-primary underline">
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
