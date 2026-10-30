import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/frontend/components/ui/input-otp";
import { Button } from "@/frontend/components/ui/button";
import { toast } from "sonner";
import { authService, type OtpPurpose } from "@/backend/services/authService";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "your registered email";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  return `${localPart[0]}***@${domain}`;
}

function getFriendlyOtpErrorMessage(err: unknown): string {
  if (!err) return "Unable to verify the code. Please try again.";
  if (typeof err === "string") return err;
  const errorObj = err as { message?: string; code?: string; status?: number };
  const msg = (errorObj.message || "").toLowerCase();
  const code = (errorObj.code || "").toLowerCase();
  const status = errorObj.status;

  if (
    status === 429 ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("maximum verification attempts") ||
    code.includes("over_email_send_rate_limit")
  ) {
    return "Too many attempts. Please request a new code or try again later.";
  }
  if (
    msg.includes("expired") ||
    code.includes("expired") ||
    msg.includes("token has expired")
  ) {
    return "This verification code has expired. Please request a new code.";
  }
  if (
    msg.includes("already been used") ||
    msg.includes("consumed") ||
    msg.includes("already used")
  ) {
    return "This verification code has already been used. Please request a new code.";
  }
  if (
    msg.includes("invalid") ||
    msg.includes("token is invalid") ||
    msg.includes("otp") ||
    code.includes("otp_disabled") ||
    msg.includes("incorrect")
  ) {
    return "Invalid verification code. Please check and re-enter.";
  }
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("failed to fetch")
  ) {
    return "Connection error. Please check your network and try again.";
  }
  return (errorObj.message as string) || "Unable to verify the code. Please try again.";
}

export const Route = createFileRoute("/otp")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || "",
    purpose: ((search.purpose as string) || "password_reset") as OtpPurpose,
  }),
  component: OTPVerificationPage,
});

function OTPVerificationPage() {
  const { email, purpose } = Route.useSearch();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reliable 1-second countdown on client mount that does not reset on typing/re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResend = useCallback(async () => {
    if (timer > 0 || resending) return;
    setResending(true);
    setErrorMsg(null);
    try {
      if (email) {
        const res = await authService.sendOtp(email.trim().toLowerCase(), purpose);
        if (!res.success && res.error) {
          toast.error(res.error);
        } else {
          setTimer(60);
          toast.success(res.message || "A new 6-digit verification code has been sent.");
        }
      }
    } catch (err) {
      console.warn("Resend OTP error:", err);
      toast.error("Unable to resend code right now. Please try again later.");
    } finally {
      setResending(false);
    }
  }, [email, purpose, timer, resending]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim();
    if (cleanCode.length !== 6 || !/^[0-9]{6}$/.test(cleanCode) || verifying) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setVerifying(true);
    setErrorMsg(null);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const result = await authService.verifyOtp(cleanEmail, purpose, cleanCode);

      if (!result.success) {
        const friendlyMsg = getFriendlyOtpErrorMessage(result.error);
        setErrorMsg(friendlyMsg);
        toast.error(friendlyMsg);
        setCode("");
        setVerifying(false);
        return;
      }

      setSuccess(true);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("login_otp_pending");
        sessionStorage.removeItem("pending_otp_verification");
        sessionStorage.removeItem("pending_otp_purpose");
      }

      toast.success(
        purpose === "password_reset"
          ? "Code verified! Proceeding to set new password..."
          : "Verification successful! Welcome to GlucoLab.",
      );

      // Destination based on purpose
      setTimeout(async () => {
        if (purpose === "password_reset") {
          navigate({ to: "/reset-password" });
        } else {
          // Verify active session before routing to dashboard
          const { data } = await authService.getSession();
          if (data?.session?.user) {
            navigate({ to: "/dashboard" });
          } else {
            navigate({ to: "/login" });
          }
        }
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

  const isComplete = code.length === 6 && /^[0-9]{6}$/.test(code);

  const getBackLink = () => {
    if (purpose === "email_verification") return "/signup";
    if (purpose === "password_reset") return "/forgot-password";
    return "/login";
  };

  const getPageTitle = () => {
    if (purpose === "email_verification") return "Verify your email";
    if (purpose === "login_verification") return "Confirm email ownership";
    return "Verify password reset";
  };

  const getPageSubtitle = () => {
    if (purpose === "email_verification") {
      return "Enter the 6-digit verification code sent to your email to activate your account.";
    }
    if (purpose === "login_verification") {
      return "Enter the 6-digit code sent to your email to verify your identity and access your account.";
    }
    return "Enter the 6-digit code sent to your email to reset your password.";
  };

  return (
    <div className={cn(
      "flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in",
      Capacitor.isNativePlatform() && "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"
    )}>
      <div className="w-full max-w-md space-y-6">
        <Link
          to={getBackLink()}
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
              {getPageTitle()}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{getPageSubtitle()}</p>
          {email && (
            <p className="text-xs text-muted-foreground pt-0.5">
              Code sent to:{" "}
              <strong className="text-foreground font-semibold">{maskEmail(email)}</strong>
            </p>
          )}
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center p-8 bg-success/10 border border-success/30 rounded-3xl text-center space-y-3 animate-fade-in">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h3 className="font-display text-lg font-bold text-foreground">Code Verified!</h3>
            <p className="text-xs text-muted-foreground">
              {purpose === "password_reset"
                ? "Proceeding to set your new password..."
                : "Your account is activated. Redirecting..."}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleVerify}
            className="space-y-6 bg-card border border-border rounded-3xl p-5 sm:p-8 shadow-elevated"
          >
            <div className="space-y-4">
              <label
                htmlFor="otp-code-input"
                className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center"
              >
                Enter 6-digit verification code
              </label>

              <div className="flex justify-center items-center py-2 px-1">
                <InputOTP
                  id="otp-code-input"
                  maxLength={6}
                  value={code}
                  onChange={(val) => {
                    const numericVal = val.replace(/[^0-9]/g, "").slice(0, 6);
                    setCode(numericVal);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  disabled={verifying}
                  autoFocus
                >
                  <InputOTPGroup className="gap-1 sm:gap-2">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <div className="text-muted-foreground font-bold px-1 sm:px-2 select-none">-</div>
                  <InputOTPGroup className="gap-1 sm:gap-2">
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {errorMsg && (
                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-destructive animate-fade-in pt-1 text-center">
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
              disabled={verifying || !isComplete}
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
