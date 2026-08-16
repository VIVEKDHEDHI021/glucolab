import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/backend/services/authService";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPage });

function ForgotPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      // Supabase recovery OTP request
      await authService.requestPasswordResetOtp(cleanEmail);
    } catch (err) {
      console.warn("Password reset request error:", err);
    } finally {
      setLoading(false);
    }

    // Always show generic message to prevent account enumeration
    toast.success("If an account exists for this email, a verification code has been sent.");

    // Navigate to OTP verification page
    navigate({
      to: "/otp",
      search: { email: cleanEmail },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Forgot password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your registered email address to receive a 6-digit verification code.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full gradient-primary text-primary-foreground btn-ripple-effect rounded-xl"
            size="lg"
            disabled={loading || !email.trim()}
          >
            {loading ? "Sending code..." : "Send Verification Code"}
          </Button>
        </form>
      </div>
    </div>
  );
}

