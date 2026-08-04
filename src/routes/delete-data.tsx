import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2, ShieldCheck, ArrowLeft, CheckCircle2, Clock, Mail } from "lucide-react";

export const Route = createFileRoute("/delete-data")({
  component: DeleteDataPage,
  head: () => ({
    meta: [
      { title: "Delete Data & Privacy Controls — GlucoLab" },
      {
        name: "description",
        content: "Learn how to delete your specific data entries or purge your complete GlucoLab history.",
      },
    ],
  }),
});

export default function DeleteDataPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
          <span className="text-xs text-muted-foreground font-mono">Google Play Data Policy Compliant</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
            <Trash2 className="h-4 w-4" /> User Data Deletion Rights
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Data Deletion Policy</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab provides full user autonomy over all personal health metrics, log entries, and account profiles. You can delete specific records or request a complete wipe of your entire account history.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
            <h3 className="text-lg font-bold font-display flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Delete Individual Records
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You can instantly delete any individual glucose log, insulin dose entry, weight metric, or scanner scan directly inside the app:
            </p>
            <ol className="list-decimal pl-5 text-xs text-muted-foreground space-y-1">
              <li>Open the <strong>History</strong> tab in the app.</li>
              <li>Locate the specific reading entry.</li>
              <li>Tap the trash icon next to the record and confirm deletion.</li>
            </ol>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-2">
              ✓ Record is immediately removed from SQLite local database & Supabase cloud backup.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
            <h3 className="text-lg font-bold font-display flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete Complete Account & All Data
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To permanently remove your account, profile, doctor access permissions, and all logs across all devices:
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
              <li><strong>In-App:</strong> Settings → Account Security → Delete Account.</li>
              <li><strong>Web Portal:</strong> Visit our <Link to="/delete-account" className="text-primary underline">Delete Account Page</Link> for self-service or web request submission.</li>
            </ul>
            <p className="text-xs text-muted-foreground font-mono pt-2">
              Processing time: Immediate for in-app password verification, 1-3 business days for web requests.
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/delete-account" className="hover:underline font-bold text-primary">Go to Account Deletion</Link>
          <span>•</span>
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/contact" className="hover:underline">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
