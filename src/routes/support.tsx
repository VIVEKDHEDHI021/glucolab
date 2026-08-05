import { createFileRoute, Link } from "@tanstack/react-router";
import { HelpCircle, ArrowLeft, BookOpen, Smartphone, ShieldCheck, Mail } from "lucide-react";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Help Center & FAQ — GlucoLab" },
      {
        name: "description",
        content: "GlucoLab Help Center. Frequently asked questions, sync troubleshooting, and Android widget setup.",
      },
    ],
  }),
});

export default function SupportPage() {
  const faqs = [
    {
      q: "How does offline SQLite sync work in GlucoLab?",
      a: "GlucoLab stores all your glucose, insulin, and weight logs directly on your phone using SQLite. When an internet connection is established, changes are automatically synced to your secure cloud database.",
    },
    {
      q: "How do I setup the Quick Insulin Android Widget?",
      a: "Long-press your Android home screen, select Widgets, search for 'GlucoLab', and drag the Quick Insulin or Glucose Dashboard widget onto your screen. You can configure dose presets in App Settings.",
    },
    {
      q: "How do I share my readings with my physician?",
      a: "You can generate downloadable PDF and Excel clinical summary reports from the 'Reports' tab and share them via email, WhatsApp, or print.",
    },
    {
      q: "How do I export PDF and Excel reports?",
      a: "Go to the 'Reports' tab, select your date range (7, 14, 30, or 90 days), and tap 'Export PDF' or 'Export Excel'. Reports include HbA1c estimates and target range breakdowns.",
    },
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
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Help Center & Support</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Find answers to common questions about glucose tracking, report generation, and app security.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold font-display">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {faqs.map((faq, i) => (
              <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary shrink-0" /> {faq.q}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-primary/5 border border-primary/20 text-center space-y-3">
          <h3 className="font-bold text-base">Still need assistance?</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Our support team is available 24/7 to assist with account recovery or technical feedback.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/contact" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs">
              <Mail className="h-4 w-4" /> Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
