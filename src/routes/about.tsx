import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, Heart, Cpu, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { getAppVersionInfo } from "@/config/appConfig";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About GlucoLab — Diabetes Management Platform" },
      {
        name: "description",
        content: "GlucoLab is a privacy-first, offline-ready glucose tracking and clinical analytics suite.",
      },
    ],
  }),
});

export default function AboutPage() {
  const [appVersion, setAppVersion] = useState({ version: "3.0.0", build: "3" });

  useEffect(() => {
    getAppVersionInfo().then(setAppVersion);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">
            Version {appVersion.version} (Build {appVersion.build})
          </span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            <Activity className="h-4 w-4" /> Clinical Companion Architecture
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">About GlucoLab</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab was built to empower individuals living with diabetes to seamlessly log blood sugar readings, calculate insulin dosages, track body metrics, and securely share structured clinical reports with their endocrinologists.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Cpu className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Offline SQLite First</h3>
            <p className="text-xs text-muted-foreground">
              Readings are recorded locally in native SQLite before syncing to cloud backup, ensuring 100% availability offline.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Biometric Security</h3>
            <p className="text-xs text-muted-foreground">
              Native fingerprint and facial recognition lock screens protect your health log from physical intrusion.
            </p>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Heart className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-sm">Doctor Supervision</h3>
            <p className="text-xs text-muted-foreground">
              Permission-based sharing allows doctors to prescribe insulin schedules and leave clinical notes securely.
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/medical-disclaimer" className="hover:underline">Medical Disclaimer</Link>
          <span>•</span>
          <Link to="/security" className="hover:underline">Security Policy</Link>
        </div>
      </div>
    </div>
  );
}
