import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, HeartPulse, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/medical-disclaimer")({
  component: MedicalDisclaimerPage,
  head: () => ({
    meta: [
      { title: "Medical & Health Disclaimer — GlucoLab" },
      {
        name: "description",
        content: "Important medical disclaimer regarding GlucoLab self-tracking software, HbA1c estimates, and clinical supervision.",
      },
    ],
  }),
});

export default function MedicalDisclaimerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Google Play Health Policy</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-xs font-bold">
            <ShieldAlert className="h-4 w-4" /> Health & Clinical Notice
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Medical Disclaimer</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Please read this disclaimer carefully before using GlucoLab for diabetes management or insulin dose calculation.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-amber-500/30 space-y-4">
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" /> Not a Medical Device or Clinical Diagnostic Tool
          </h2>
          <div className="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 text-muted-foreground">
            <p>
              1. <strong>Informational & Self-Tracking Purpose Only:</strong> GlucoLab is designed solely as a digital logbook and organizational utility to help users store blood glucose readings, insulin doses, and weight metrics. It does not provide medical diagnoses, treatment guarantees, or automated prescription advice.
            </p>
            <p>
              2. <strong>Insulin Calculation & Widget Presets:</strong> Quick Insulin widgets and calculation presets in GlucoLab are user-configurable memory shortcuts. They must be validated against your personal physician's prescribed dosage guidelines. Never adjust insulin dosages without consulting your endocrinologist.
            </p>
            <p>
              3. <strong>Estimated HbA1c & Reports:</strong> Calculated HbA1c values generated in reports are mathematical approximations derived from average logged glucose values over 30 to 90 days. They do not replace laboratory blood draws or certified HbA1c clinical testing.
            </p>
            <p>
              4. <strong>Medical Emergencies:</strong> If you experience severe hypoglycemia (blood sugar below 50 mg/dL), ketoacidosis symptoms, or any medical emergency, seek immediate emergency medical care. Do not rely on GlucoLab during a health crisis.
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
          <span>•</span>
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/contact" className="hover:underline">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
