import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/frontend/components/ui/input-otp";
import { Button } from "@/frontend/components/ui/button";
import { toast } from "sonner";
import { authService } from "@/backend/services/authService";

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "your registered email";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  if (localPart.length === 2) {
    return `${localPart[0]}***@${domain}`;
  }
  const firstChar = localPart[0];
  const lastChar = localPart[localPart.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
}

function getFriendlyOtpErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Invalid verification code. Please check and try again.";
  }
  const errorObj = err as { message?: string; code?: string; status?: number };
  const msg = (errorObj.message || "").toLowerCase();
  const code = (errorObj.code || "").toLowerCase();
  const status = errorObj.status;

  if (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    code.includes("over_email_send_rate_limit")
  ) {
    return "Too many attempts. Please request a new verification code.";
  }
  if (
    msg.includes("expired") ||
    code.includes("expired") ||
    msg.includes("token has expired")
  ) {
    return "This verification code has expired. Please request a new code.";
  }
  if (
    msg.includes("invalid") ||
    msg.includes("token is invalid") ||
    msg.includes("otp") ||
    code.includes("otp_disabled")
  ) {
    return "Invalid verification code.";
  }
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("failed to fetch")
  ) {
    return "Unable to verify the code. Please check your connection and try again.";
  }
  return "Invalid verification code. Please check and try again.";
}

export const Route = createFileRoute("/otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || "",
  }),
  component: OTPVerificationPage,
});

function OTPVerificationPage() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleResend = useCallback(async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);
    try {
      if (email) {
        await authService.requestPasswordResetOtp(email.trim().toLowerCase());
      }
      setTimer(60);
      toast.success("If an account exists for this email, a verification code has been sent.");
    } catch (err) {
      console.warn("Resend OTP error:", err);
      toast.error("Unable to resend code right now. Please try again in a few moments.");
    } finally {
      setResending(false);
    }
  }, [email, timer, resending]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6 || verifying) return;

    setVerifying(true);
    setErrorMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await authService.verifyPasswordResetOtp(cleanEmail, code.trim());

      if (error) {
        const friendlyMsg = getFriendlyOtpErrorMessage(error);
        setErrorMsg(friendlyMsg);
        toast.error(friendlyMsg);
        setCode("");
        setVerifying(false);
        return;
      }

      setSuccess(true);
      toast.success("Code verified successfully.");

      // Navigate to reset password page with active recovery session
      setTimeout(() => {
        navigate({ to: "/reset-password" });
      }, 1000);
    } catch (err) {
      console.warn("OTP verification exception:", err);
      const friendlyMsg = getFriendlyOtpErrorMessage(err);
      setErrorMsg(friendlyMsg);
      toast.error(friendlyMsg);
      setCode("");
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md space-y-6">
        <Link
          to="/forgot-password"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Verify your email
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            A verification code was sent to:{" "}
            <strong className="text-foreground font-semibold">
              {maskEmail(email)}
            </strong>
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center p-8 bg-success/10 border border-success/30 rounded-3xl text-center space-y-3 animate-fade-in">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h3 className="font-display text-lg font-bold text-foreground">Code Verified!</h3>
            <p className="text-xs text-muted-foreground">Proceeding to set your new password...</p>
          </div>
        ) : (
          <form
            onSubmit={handleVerify}
            className="space-y-6 bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-elevated"
          >
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
                Enter 6-digit code
              </label>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(val) => {
                    setCode(val);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  disabled={verifying}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2 sm:gap-3">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-destructive animate-fade-in pt-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center pt-2">
                {timer > 0 ? (
                  <span>
                    Resend code in{" "}
                    <strong className="text-foreground font-semibold">{timer}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="inline-flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    {resending ? (
                      <>
                        <RefreshCw className="h-3 w-3 animate-spin" /> Resending...
                      </>
                    ) : (
                      "Resend Code"
                    )}
                  </button>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={verifying || code.length < 6}
              className="w-full gradient-primary text-primary-foreground btn-ripple-effect rounded-2xl h-12 text-sm font-semibold shadow-soft"
            >
              {verifying ? "Verifying..." : "Verify Code"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

