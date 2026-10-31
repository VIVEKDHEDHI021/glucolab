import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
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

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign In — GlucoLab" }] }),
});

function LoginPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    const isPendingOtp =
      typeof window !== "undefined" &&
      Boolean(sessionStorage.getItem("pending_otp_verification"));

    if (user && authService.isEmailVerified(user) && !isPendingOtp && profile !== undefined) {
      const isReturningOrCompleted =
        authService.isReturningUser(user, profile) ||
        Boolean(profile?.onboarding_completed) ||
        Boolean(user?.user_metadata?.onboarding_completed) ||
        (typeof window !== "undefined" &&
          (localStorage.getItem(`glucolab_onboarding_completed_${user.id}`) === "true" ||
           localStorage.getItem(`glucolab_has_logged_in_${user.id}`) === "true"));

      if (isReturningOrCompleted) {
        authService.markUserAsLoggedIn(user);
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/onboarding", replace: true });
      }
    }
  }, [user, profile, authLoading, navigate]);

  const onGoogleSignIn = async () => {
    if (googleLoading) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("An internet connection is required to sign in with Google.");
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
          toast.error(error.message || "Unable to sign in with Google. Please try again.");
        }
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("cancel") || msg.includes("closed") || msg.includes("popup")) {
        toast.info("Google sign-in was cancelled.");
      } else {
        toast.error(err?.message || "Unable to sign in with Google. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Prevent flash of unauthenticated login panel for already logged-in users
  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-14 w-14 rounded-2xl overflow-hidden animate-pulse border border-border/40 shadow-sm p-1 bg-card">
          <img src="/icon/icon.png" alt="GlucoLab" className="h-full w-full object-contain" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-between bg-gradient-to-b from-background via-background to-muted/20 px-6 py-12",
        Capacitor.isNativePlatform() &&
          "pt-[calc(3rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      <div />

      {/* Main Minimalist Center Container */}
      <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-6">
        {/* App Logo */}
        <div className="h-24 w-24 rounded-[26px] overflow-hidden shadow-md border border-slate-100 flex items-center justify-center bg-white p-2">
          <img
            src="/icon/icon.png"
            alt="GlucoLab Logo"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Clean Typography */}
        <div className="space-y-1.5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Welcome to GlucoLab
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sign in to track your glucose, insulin, and wellness.
          </p>
        </div>

        {/* Single Continue with Google Button */}
        <div className="w-full pt-4 space-y-3">
          <Button
            type="button"
            size="lg"
            onClick={onGoogleSignIn}
            disabled={googleLoading}
            className="w-full h-13 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-semibold border-2 border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
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

          <p className="text-xs text-muted-foreground/80 leading-relaxed px-2">
            Your personal health records are encrypted and never shared.
          </p>
        </div>
      </div>

      {/* Minimal Bottom Footer */}
      <div className="w-full max-w-sm mx-auto pt-6 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:text-foreground hover:underline">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link to="/delete-account" className="hover:text-destructive hover:underline">
            Delete Account &amp; Data
          </Link>
        </div>
      </div>
    </div>
  );
}
