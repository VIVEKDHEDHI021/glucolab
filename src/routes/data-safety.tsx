import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff } from "lucide-react";

export const Route = createFileRoute("/data-safety")({
  component: DataSafetyPage,
  head: () => ({
    meta: [
      { title: "Google Play Data Safety Summary — GlucoLab" },
      {
        name: "description",
        content: "Exact declaration summary matching Google Play Console Data Safety questionnaire for GlucoLab by Viora Technology.",
      },
      { property: "og:title", content: "Google Play Data Safety Summary — GlucoLab" },
      {
        property: "og:description",
        content: "Transparent disclosure of data collection, storage, and encryption in compliance with Google Play Console Data Safety guidelines.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.vioraa.app/data-safety" },
      { rel: "canonical", href: "https://www.vioraa.app/data-safety" },
    ],
  }),
});

export default function DataSafetyPage() {
  const declarations = [
    { title: "Personal Info", items: "Name, Email Address, Phone Number, User ID", purpose: "App functionality, account management", shared: "No" },
    { title: "Health & Fitness", items: "Blood Glucose, Insulin Logs, Weight Metrics", purpose: "App functionality, report generation", shared: "No (User-initiated export only)" },
    { title: "Photos & Images", items: "Smart Scan meter display OCR photos", purpose: "App functionality (OCR scanning)", shared: "No" },
    { title: "Device IDs & App Activity", items: "Push notification tokens (FCM)", purpose: "New Reading Notifications, app alerts", shared: "No" },
  ];

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
            <span className="text-foreground">Data Safety</span>
          </nav>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2.5 py-1 rounded-md">
            Google Play Console Sync
          </span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
            <ShieldCheck className="h-4 w-4" /> Official Data Safety Declarations
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight">Data Safety Information</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            This page provides transparent disclosure of all data collected, processed, encrypted, and managed by GlucoLab in full alignment with the Google Play Console Data Safety section.
          </p>
        </div>

        <div className="border border-border/80 rounded-3xl overflow-hidden bg-card shadow-soft">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-foreground">
              <tr>
                <th className="p-4">Data Type</th>
                <th className="p-4">Data Collected</th>
                <th className="p-4">Primary Purpose</th>
                <th className="p-4">Shared with Third Parties?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-muted-foreground">
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

        <div className="bg-card border border-border/80 rounded-3xl p-6 space-y-3 shadow-soft text-xs text-muted-foreground">
          <h3 className="font-bold text-sm text-foreground">Key Security Commitments</h3>
          <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
            <li><strong>Data Encryption in Transit:</strong> All data is encrypted using HTTPS/TLS 1.3 during transmission.</li>
            <li><strong>Data Encryption at Rest:</strong> Database tables use PostgreSQL disk encryption (Supabase cloud & SQLite mobile).</li>
            <li><strong>Account Deletion Request Mechanism:</strong> Users can permanently delete all data in-app or via web request at <Link to="/delete-account" className="text-primary font-semibold underline">/delete-account</Link>.</li>
            <li><strong>Developer & Contact:</strong> Viora Technology | <a href="https://www.vioraa.app" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://www.vioraa.app</a> | <a href="mailto:contact@vioraa.app" className="text-primary underline font-mono">contact@vioraa.app</a></li>
          </ul>
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
            <Link to="/medical-disclaimer" className="hover:text-primary transition-colors">
              Medical Disclaimer
            </Link>
            <span>•</span>
            <Link to="/data-safety" className="text-primary underline">
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
