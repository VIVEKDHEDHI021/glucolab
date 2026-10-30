import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { authService } from "@/backend/services/authService";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Label } from "@/frontend/components/ui/label";
import { AlertCircle, ArrowLeft, KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Verify that the user has an active authenticated session (created via verifyOtp)
    authService.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsVerified(true);
      } else {
        setIsVerified(false);
      }
      setCheckingAuth(false);
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error("Please enter a new password.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (!confirmPassword) {
      toast.error("Please confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authService.updatePassword(password);
      if (error) {
        toast.error(error.message || "Failed to update password. Please try again.");
        setLoading(false);
        return;
      }

      // Clear recovery session state so user logs in cleanly with new credentials
      await authService.signOut();

      setIsSuccess(true);
      toast.success("Password updated successfully.");
    } catch (err) {
      console.warn("Password update error:", err);
      toast.error("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10",
        Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
      )}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying security session...</p>
        </div>
      </div>
    );
  }

  if (!isVerified && !isSuccess) {
    return (
      <div className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in",
        Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
      )}>
        <div className="w-full max-w-md text-center bg-card border border-border rounded-3xl p-8 shadow-elevated">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Verification Required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You must verify your 6-digit email code before creating a new password.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild className="w-full gradient-primary text-primary-foreground rounded-xl" size="lg">
              <Link to="/forgot-password">Request Verification Code</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-xl" size="lg">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in",
        Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
      )}>
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 shadow-elevated text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Password updated successfully
            </h1>
            <p className="text-sm text-muted-foreground">
              Your password has been changed. You can now log in to your account with your new credentials.
            </p>
          </div>
          <div className="pt-4">
            <Button
              onClick={() => navigate({ to: "/login" })}
              className="w-full gradient-primary text-primary-foreground btn-ripple-effect rounded-2xl h-12 text-sm font-semibold shadow-soft"
              size="lg"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in",
      Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
    )}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-soft">
            <KeyRound className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Create New Password
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your identity is verified. Please create and confirm your new password below.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-elevated"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1 font-medium">Passwords do not match.</p>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground btn-ripple-effect rounded-2xl h-12 text-sm font-semibold shadow-soft"
              size="lg"
              disabled={loading || !password || !confirmPassword || password !== confirmPassword || password.length < 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating Password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

