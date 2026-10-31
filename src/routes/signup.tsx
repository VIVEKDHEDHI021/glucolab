import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, ShieldCheck, Heart, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/backend/services/authService";
import { useAuth } from "@/frontend/lib/auth-context";
import { Button } from "@/frontend/components/ui/button";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
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

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({ meta: [{ title: "Welcome — GlucoLab" }] }),
});

function SignupPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (user && authService.isEmailVerified(user) && profile !== undefined) {
      if (profile?.onboarding_completed) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/onboarding", replace: true });
      }
    }
  }, [user, profile, authLoading, navigate]);

  const onGoogleSignIn = async () => {
    if (googleLoading) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("An internet connection is required to continue with Google.");
      return;
    }

    setGoogleLoading(true);

    try {
      const { error } = await authService.signInWithGoogle();
      if (error) {
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("cancel") || msg.includes("closed") || msg.includes("popup")) {
          toast.info("Google sign-in was cancelled.");
        } else {
          toast.error(error.message || "Unable to connect with Google. Please try again.");
        }
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("cancel") || msg.includes("closed") || msg.includes("popup")) {
        toast.info("Google sign-in was cancelled.");
      } else {
        toast.error(err?.message || "Unable to connect with Google. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-between bg-gradient-to-b from-background via-background to-muted/20 px-4 py-8 sm:py-12",
        Capacitor.isNativePlatform() &&
          "pt-[calc(2rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      {/* Top Brand & Hero */}
      <div className="w-full max-w-md mx-auto flex flex-col items-center text-center space-y-6 pt-4">
        {/* Pulsing Medical Blue Logo */}
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-1.5 rounded-3xl bg-primary/20 blur-xl animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary text-primary-foreground shadow-elevated">
            <Activity className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Smart Diabetes Companion</span>
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Welcome to GlucoLab
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Your personal health companion to record glucose readings, log insulin, and track your wellness.
          </p>
        </div>

        {/* Feature Highlights Cards */}
        <div className="w-full space-y-3 pt-2 text-left">
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-border/70 shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Heart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Effortless Tracking</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quickly record blood glucose readings with meal context.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-border/70 shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Precision Insulin Wheel</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dial whole-number doses seamlessly with tactile wheel selector.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-card border border-border/70 shadow-sm transition-all">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Private & Encrypted</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your health data is securely encrypted and belongs only to you.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Area: Google Authentication & Privacy */}
      <div className="w-full max-w-md mx-auto pt-8 pb-4 space-y-4 text-center">
        {/* Single Prominent Google Sign-in Button */}
        <Button
          type="button"
          size="lg"
          onClick={onGoogleSignIn}
          disabled={googleLoading || authLoading}
          className="w-full h-13 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold border-2 border-slate-200 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
        >
          {googleLoading ? (
            <span className="flex items-center gap-2.5 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">Connecting to Google...</span>
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <GoogleIcon className="shrink-0" />
              <span className="text-base text-slate-800 font-semibold">Continue with Google</span>
              <ArrowRight className="h-4 w-4 text-slate-400 ml-1" />
            </span>
          )}
        </Button>

        {/* Privacy & Terms Notice */}
        <p className="text-xs text-muted-foreground px-4 leading-relaxed">
          By continuing with Google, you agree to GlucoLab&apos;s{" "}
          <Link to="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          . Your personal health records are encrypted and never shared with Google or third parties.
        </p>
      </div>
    </div>
  );
}
