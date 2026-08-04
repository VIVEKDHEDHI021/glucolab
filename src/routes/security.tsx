import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Lock, Key, Server, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/security")({
  component: SecurityPage,
  head: () => ({
    meta: [
      { title: "Security & Encryption Policy — GlucoLab" },
      {
        name: "description",
        content: "Detailed overview of security controls, data encryption standards, biometrics, and threat safeguards in GlucoLab.",
      },
    ],
  }),
});

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Security Tier 1</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Application Security</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab incorporates defense-in-depth security standards across mobile app binaries, web interfaces, API communications, and database persistence layers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Lock className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-base">TLS 1.3 Transport Security</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All network communications are strictly encrypted using HTTPS/TLS 1.3. Cleartext unencrypted HTTP traffic is blocked in Android binaries and web configs.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Key className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-base">Local SQLite Encrypted Storage</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Device records stored via `@capacitor-community/sqlite` are secured inside protected application sandboxes accessible only by the GlucoLab app process.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <Server className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-base">Row-Level Security (RLS)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Database access control is strictly enforced at the database layer using PostgreSQL Row Level Security rules based on authenticated JWT tokens.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h3 className="font-bold text-base">Native Biometric Auth</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Users can enforce fingerprint or facial biometric authentication prior to opening app medical screens on native Android and iOS devices.
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-muted/40 border border-border text-xs space-y-2">
          <h4 className="font-bold text-foreground">Responsible Vulnerability Disclosure</h4>
          <p className="text-muted-foreground">
            If you discover a potential security flaw in GlucoLab, please report it directly to our security response team at <span className="font-mono text-primary">security@glucolab.app</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
