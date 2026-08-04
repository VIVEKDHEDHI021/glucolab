import { createFileRoute, Link } from "@tanstack/react-router";
import { Code, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/open-source-licenses")({
  component: OpenSourceLicensesPage,
  head: () => ({
    meta: [
      { title: "Open Source Licenses — GlucoLab" },
      {
        name: "description",
        content: "Attribution and license disclosures for open source libraries used in GlucoLab.",
      },
    ],
  }),
});

export default function OpenSourceLicensesPage() {
  const licenses = [
    { name: "React & React DOM", license: "MIT License", copyright: "Copyright (c) Meta Platforms, Inc. and affiliates." },
    { name: "Capacitor Core & Plugins", license: "MIT License", copyright: "Copyright (c) Ionic / Max Lynch." },
    { name: "@capacitor-community/sqlite", license: "MIT License", copyright: "Copyright (c) Jean-Charles Guinot." },
    { name: "@tanstack/react-router & react-query", license: "MIT License", copyright: "Copyright (c) Tanner Linsley." },
    { name: "@supabase/supabase-js", license: "MIT License", copyright: "Copyright (c) Supabase Inc." },
    { name: "Lucide React Icons", license: "ISC License", copyright: "Copyright (c) Lucide Contributors." },
    { name: "Tesseract.js OCR", license: "Apache License 2.0", copyright: "Copyright (c) Naptha." },
    { name: "jsPDF & jsPDF-AutoTable", license: "MIT License", copyright: "Copyright (c) James Hall, Simon Tengs." },
    { name: "Tailwind CSS", license: "MIT License", copyright: "Copyright (c) Tailwind Labs, Inc." },
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
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Open Source Licenses</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            GlucoLab is made possible thanks to the following open source software packages:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {licenses.map((l, i) => (
            <div key={i} className="p-5 rounded-2xl bg-card border border-border space-y-2">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Code className="h-4 w-4 text-primary shrink-0" /> {l.name}
              </h3>
              <p className="text-xs font-semibold text-primary">{l.license}</p>
              <p className="text-xs text-muted-foreground font-mono">{l.copyright}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 flex flex-wrap gap-4 text-xs text-muted-foreground justify-center">
          <Link to="/third-party-licenses" className="hover:underline">Third Party SDK Licenses</Link>
          <span>•</span>
          <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
