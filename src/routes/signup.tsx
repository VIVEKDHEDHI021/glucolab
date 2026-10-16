import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/db/client";
import { authService } from "@/backend/services/authService";
import { useAuth } from "@/frontend/lib/auth-context";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const isPendingOtp =
      typeof window !== "undefined" &&
      Boolean(sessionStorage.getItem("pending_otp_verification"));

    if (user && authService.isEmailVerified(user) && !isPendingOtp) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // 1. Email format and required field validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!cleanName) {
      toast.error("Please enter your full name.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      // 2. Lock pending OTP verification state BEFORE registration
      // This strictly prevents onAuthStateChange from triggering premature dashboard navigation
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_otp_verification", cleanEmail);
        sessionStorage.setItem("pending_otp_purpose", "email_verification");
      }

      // 3. Register user with authentication provider
      const { data, error } = await authService.signUp(cleanEmail, password, cleanName);

      if (error) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_otp_verification");
          sessionStorage.removeItem("pending_otp_purpose");
        }
        setLoading(false);
        toast.error(error.message || "Failed to create account. Please try again.");
        return;
      }

      // Check if user already exists (Supabase returns empty identities array for existing users)
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_otp_verification");
          sessionStorage.removeItem("pending_otp_purpose");
        }
        setLoading(false);
        toast.error("An account with this email already exists. Please sign in instead.");
        return;
      }

      // 4. Send email verification OTP using unified OTP infrastructure
      const otpRes = await authService.sendOtp(cleanEmail, "email_verification");
      if (!otpRes.success && otpRes.error) {
        toast.error(otpRes.error);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("pending_otp_verification");
          sessionStorage.removeItem("pending_otp_purpose");
        }
        setLoading(false);
        return;
      }

      setLoading(false);
      toast.success("Verification code sent! Please check your email to activate your account.");

      // 5. Navigate directly to dedicated OTP verification screen (dashboard navigation is strictly blocked)
      navigate({
        to: "/otp",
        search: { email: cleanEmail, purpose: "email_verification" },
      });
    } catch (err: any) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pending_otp_verification");
        sessionStorage.removeItem("pending_otp_purpose");
      }
      setLoading(false);
      console.warn("Sign-up exception:", err);
      toast.error(err?.message || "An unexpected error occurred during registration.");
    }
  };

  const onGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("Internet connection is required to sign in with Google.");
      return;
    }
    setGoogleLoading(true);
    try {
      const { error } = await authService.signInWithGoogle();
      if (error) {
        if (error.message?.toLowerCase().includes("cancel") || error.message?.toLowerCase().includes("closed")) {
          toast.info("Google sign-in was cancelled.");
        } else {
          toast.error(error.message || "Unable to sign in with Google. Please try again.");
        }
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes("cancel") || err?.message?.toLowerCase().includes("closed")) {
        toast.info("Google sign-in was cancelled.");
      } else {
        toast.error(err?.message || "Unable to sign in with Google. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex min-h-screen items-center justify-center bg-background px-4 py-10",
      Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
    )}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Activity className="h-7 w-7 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start tracking in seconds</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-elevated"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">At least 6 characters.</p>
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading || googleLoading}>
            {loading ? "Creating..." : "Create account"}
          </Button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">
              or
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2.5 h-11 bg-background hover:bg-muted/80 font-medium border-border transition-colors cursor-pointer"
            disabled={loading || googleLoading}
            onClick={onGoogleSignIn}
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Connecting to Google...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2.5">
                <GoogleIcon className="h-4 w-4 shrink-0" />
                <span>Continue with Google</span>
              </span>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          By signing up, you acknowledge our{" "}
          <Link to="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
