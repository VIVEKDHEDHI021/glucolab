import { createFileRoute, Link } from "@tanstack/react-router";
import { Key, ShieldCheck, ArrowLeft, Bell, Camera, Fingerprint, Wifi } from "lucide-react";

export const Route = createFileRoute("/permissions")({
  component: PermissionsPage,
  head: () => ({
    meta: [
      { title: "Android Permissions Rationale — GlucoLab" },
      {
        name: "description",
        content: "Explanation of why GlucoLab requests specific Android permissions and how privacy is maintained.",
      },
    ],
  }),
});

export default function PermissionsPage() {
  const permissions = [
    {
      name: "android.permission.INTERNET",
      label: "Internet & Network Access",
      icon: Wifi,
      reason: "Required to sync offline SQLite glucose entries with your cloud database backup and communicate with Supabase backend APIs.",
    },
    {
      name: "android.permission.POST_NOTIFICATIONS",
      label: "Push Notifications",
      icon: Bell,
      reason: "Required to deliver scheduled glucose logging reminders, high/low sugar alert notifications, and doctor message alerts.",
    },
    {
      name: "android.permission.USE_BIOMETRIC",
      label: "Native Biometrics",
      icon: Fingerprint,
      reason: "Required to authenticate fingerprint or facial recognition unlock prior to displaying sensitive medical logs.",
    },
    {
      name: "android.permission.CAMERA",
      label: "Camera Access",
      icon: Camera,
      reason: "Used exclusively during Smart Scan mode to capture prescription slips or glucose meter screen images for local OCR reading.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Google Play Permission Audit</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Android Permissions Rationale</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab adheres strictly to the Principle of Least Privilege. We request only essential Android runtime permissions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {permissions.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{p.label}</h3>
                    <p className="text-[11px] font-mono text-muted-foreground">{p.name}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{p.reason}</p>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/data-safety" className="hover:underline">Data Safety</Link>
        </div>
      </div>
    </div>
  );
}
