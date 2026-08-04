import { createFileRoute, Link } from "@tanstack/react-router";
import { Server, ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/third-party-licenses")({
  component: ThirdPartyLicensesPage,
  head: () => ({
    meta: [
      { title: "Third-Party SDK Disclosures — GlucoLab" },
      {
        name: "description",
        content: "Detailed disclosure of third-party SDKs, services, and cloud APIs utilized in GlucoLab.",
      },
    ],
  }),
});

export default function ThirdPartyLicensesPage() {
  const sdks = [
    { name: "Supabase Cloud Platform", purpose: "User authentication, database sync, push notification token storage", dataProcessed: "Encrypted account profiles & health entries" },
    { name: "Firebase Cloud Messaging (FCM)", purpose: "Cross-platform push notification delivery for glucose reminders", dataProcessed: "Device push tokens only" },
    { name: "Capacitor Native Plugins", purpose: "Native Android hardware access (Biometrics, Camera, Local Notifications)", dataProcessed: "Processed strictly locally on device" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Third-Party SDK Disclosures</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab integrates a minimal set of trusted third-party SDKs strictly to deliver core app functionality.
          </p>
        </div>

        <div className="space-y-4">
          {sdks.map((sdk, i) => (
            <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-2">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" /> {sdk.name}
              </h3>
              <p className="text-xs text-muted-foreground"><strong>Primary Purpose:</strong> {sdk.purpose}</p>
              <p className="text-xs text-muted-foreground font-mono"><strong>Data Handled:</strong> {sdk.dataProcessed}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/open-source-licenses" className="hover:underline">Open Source Licenses</Link>
          <span>•</span>
          <Link to="/data-safety" className="hover:underline">Data Safety</Link>
        </div>
      </div>
    </div>
  );
}
