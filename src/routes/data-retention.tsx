import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, Database, ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/data-retention")({
  component: DataRetentionPage,
  head: () => ({
    meta: [
      { title: "Data Retention Policy — GlucoLab" },
      {
        name: "description",
        content: "Data retention schedules, active log storage durations, and automatic purging rules for GlucoLab user data.",
      },
    ],
  }),
});

export default function DataRetentionPage() {
  const retentionRules = [
    { type: "Glucose Logs & HbA1c History", duration: "Retained for active account duration or until deleted by user.", notes: "Editable & deletable at any time." },
    { type: "Insulin Dose Records", duration: "Retained for active account duration.", notes: "Included in doctor reports." },
    { type: "Weight Logs & Smart Scans", duration: "Retained until user deletes entry or purges account.", notes: "Stored in encrypted cloud tables." },
    { type: "Doctor Connections & Notes", duration: "Retained until patient revokes access or doctor deletes note.", notes: "Instant permission-level purge." },
    { type: "Push Notification Tokens", duration: "Active session duration.", notes: "Purged immediately upon logout or account deletion." },
    { type: "Account Deletion Audit Logs", duration: "30 days (Non-sensitive timestamp & request ID).", notes: "Maintained for compliance verification." },
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
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Data Retention Policy</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            This policy outlines how long GlucoLab retains personal and health data and the criteria used to determine retention periods.
          </p>
        </div>

        <div className="border border-border rounded-3xl overflow-hidden bg-card">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border font-semibold text-foreground">
              <tr>
                <th className="p-4">Data Category</th>
                <th className="p-4">Retention Schedule</th>
                <th className="p-4">Retention Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              {retentionRules.map((r, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="p-4 font-bold text-foreground">{r.type}</td>
                  <td className="p-4">{r.duration}</td>
                  <td className="p-4 font-mono text-[11px]">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/delete-account" className="hover:underline font-bold text-destructive">Account Deletion</Link>
        </div>
      </div>
    </div>
  );
}
