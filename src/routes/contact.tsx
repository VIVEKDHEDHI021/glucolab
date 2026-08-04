import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MessageSquare, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact & Support — GlucoLab" },
      {
        name: "description",
        content: "Get in touch with the GlucoLab support team for technical assistance, privacy inquiries, or developer feedback.",
      },
    ],
  }),
});

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("General Support");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) {
      toast.error("Please provide your email and message.");
      return;
    }
    setSubmitted(true);
    toast.success("Support ticket created successfully!");
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to GlucoLab
          </Link>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Contact Support</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Have questions about GlucoLab, data privacy, or app features? Reach out to our technical support team.
          </p>
        </div>

        {submitted ? (
          <div className="p-8 rounded-3xl bg-card border border-border text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold font-display">Message Sent</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Thank you for contacting GlucoLab support. A team member will respond to <strong>{email}</strong> within 24 business hours.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline">Send Another Message</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-card border border-border space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Your Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Email Address *</label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Inquiry Type</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-muted/40 text-xs font-semibold px-3 py-2 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="General Support">General Support</option>
                <option value="Privacy & Data Request">Privacy & Data Request</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Doctor Access Issue">Doctor Access Issue</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Message *</label>
              <Textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or issue in detail..."
              />
            </div>

            <Button type="submit" className="w-full gap-2 font-bold">
              <Send className="h-4 w-4" /> Submit Inquiry
            </Button>
          </form>
        )}

        <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-1 text-xs text-muted-foreground">
          <p className="font-bold text-foreground">Direct Email Contacts:</p>
          <p>Technical Support: support@glucolab.app</p>
          <p>Privacy & Data Officer: privacy@glucolab.app</p>
        </div>
      </div>
    </div>
  );
}
