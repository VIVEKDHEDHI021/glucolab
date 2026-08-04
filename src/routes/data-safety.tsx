import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff } from "lucide-react";

export const Route = createFileRoute("/data-safety")({
  component: DataSafetyPage,
  head: () => ({
    meta: [
      { title: "Google Play Data Safety Summary — GlucoLab" },
      {
        name: "description",
        content: "Exact declaration summary matching Google Play Console Data Safety questionnaire for GlucoLab.",
      },
    ],
  }),
});

export default function DataSafetyPage() {
  const declarations = [
    { title: "Personal Info", items: "Name, Email Address, User ID", purpose: "App functionality, account management", shared: "No" },
    { title: "Health & Fitness", items: "Blood Glucose, Insulin Logs, Weight Metrics", purpose: "App functionality, report generation", shared: "No (Shared with Doctor only upon user consent)" },
    { title: "Photos & Images", items: "Smart Scan prescription/meter photos", purpose: "App functionality (OCR scanning)", shared: "No" },
    { title: "Device IDs & App Activity", items: "Push notification tokens (FCM)", purpose: "Push notifications, app diagnostics", shared: "No" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Google Play Console Sync</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold">
            <ShieldCheck className="h-4 w-4" /> Official Data Safety Declarations
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Data Safety Information</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            This page provides transparent disclosure of all data collected, processed, encrypted, and managed by GlucoLab in full alignment with the Google Play Console Data Safety section.
          </p>
        </div>

        <div className="border border-border rounded-3xl overflow-hidden bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-foreground">
              <tr>
                <th className="p-4">Data Type</th>
                <th className="p-4">Data Collected</th>
                <th className="p-4">Primary Purpose</th>
                <th className="p-4">Shared with Third Parties?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {declarations.map((d, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="p-4 font-bold text-foreground">{d.title}</td>
                  <td className="p-4">{d.items}</td>
                  <td className="p-4">{d.purpose}</td>
                  <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-400">{d.shared}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <h3 className="font-bold text-sm text-foreground">Key Security Commitments</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Data Encryption in Transit:</strong> All data is encrypted using HTTPS/TLS 1.3.</li>
            <li><strong>Data Encryption at Rest:</strong> Database tables use PostgreSQL disk encryption.</li>
            <li><strong>Account Deletion Request Mechanism:</strong> Users can delete all data in-app or via web request at <Link to="/delete-account" className="text-primary underline">/delete-account</Link>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
