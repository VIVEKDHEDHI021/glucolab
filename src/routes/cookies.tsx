import { createFileRoute, Link } from "@tanstack/react-router";
import { Cookie, ArrowLeft, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
  head: () => ({
    meta: [
      { title: "Cookies & Storage Policy — GlucoLab" },
      {
        name: "description",
        content: "Explanation of local storage, session storage, and cookies used in GlucoLab.",
      },
    ],
  }),
});

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Cookies & Local Storage Policy</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab uses essential browser local storage and mobile preferences strictly to store session tokens and UI themes.
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" /> Essential Storage Usage
          </h3>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-2">
            <li><strong>Authentication Sessions:</strong> Encrypted Supabase JWT tokens saved in local storage or Capacitor Preferences to maintain your logged-in state.</li>
            <li><strong>User Interface Preferences:</strong> Light/Dark theme setting, glucose unit preference (mg/dL vs mmol/L), and language preference.</li>
            <li><strong>Zero Tracking Cookies:</strong> GlucoLab does not place third-party advertising cookies or cross-site tracking tags.</li>
          </ul>
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
