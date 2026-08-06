import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, HeartPulse, ArrowLeft, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/medical-disclaimer")({
  component: MedicalDisclaimerPage,
  head: () => ({
    meta: [
      { title: "Medical & Health Disclaimer — GlucoLab" },
      {
        name: "description",
        content: "Important medical disclaimer regarding GlucoLab self-management tracking software, HbA1c estimates, and clinical supervision.",
      },
      { property: "og:title", content: "Medical & Health Disclaimer — GlucoLab" },
      {
        property: "og:description",
        content: "GlucoLab is strictly a personal self-management logbook. It is NOT a medical device and does NOT provide medical diagnosis.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.vioraa.app/medical-disclaimer" },
      { rel: "canonical", href: "https://www.vioraa.app/medical-disclaimer" },
    ],
  }),
});

export default function MedicalDisclaimerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <nav className="flex items-center space-x-2 text-xs font-semibold text-muted-foreground">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span>/</span>
            <span className="text-foreground">Medical Disclaimer</span>
          </nav>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-md">
            Google Play Health Policy
          </span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold border border-amber-500/20">
            <ShieldAlert className="h-4 w-4" /> Health & Clinical Notice
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Medical Disclaimer</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Please read this disclaimer carefully regarding the intended purpose and limitations of GlucoLab.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-amber-500/30 space-y-4 shadow-soft">
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-amber-600" /> Personal Diabetes Self-Management Only
          </h2>
          <div className="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 text-muted-foreground">
            <p>
              1. <strong>Informational & Self-Tracking Purpose Only:</strong> GlucoLab is designed solely as a digital logbook and organizational utility to help users record blood glucose levels, insulin doses, and body weight. It does not provide medical diagnosis, treatment guarantees, or automated clinical advice.
            </p>
            <p>
              2. <strong>Not a Medical Device:</strong> GlucoLab is <strong>NOT a certified medical device</strong> and is not designed to perform automated diagnostic functions or emergency medical interventions.
            </p>
            <p>
              3. <strong>Insulin Calculation & Presets:</strong> Dosage shortcuts and log templates in GlucoLab are user-configurable presets. They must be validated against your physician's prescribed guidelines. Never adjust insulin dosages without consulting your healthcare team.
            </p>
            <p>
              4. <strong>Estimated HbA1c & Reports:</strong> Calculated HbA1c values generated in PDF/Excel summary reports are mathematical approximations based on average logged glucose values over 30 to 90 days. They do not replace laboratory blood draws or certified HbA1c clinical testing.
            </p>
            <p>
              5. <strong>Medical Emergencies:</strong> If you experience severe hypoglycemia (blood sugar below 50 mg/dL), ketoacidosis symptoms, or any medical emergency, seek immediate emergency medical care. Do not rely on GlucoLab during a health crisis.
            </p>
          </div>
        </div>

        {/* Global Footer Links */}
        <footer className="border-t border-border/80 pt-8 pb-4 text-center space-y-4">
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground justify-center">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">
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
            <Link to="/medical-disclaimer" className="text-primary underline">
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
