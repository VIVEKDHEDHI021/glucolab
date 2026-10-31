import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Clock,
  TimerOff,
  XCircle,
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/frontend/components/ui/input-otp";
import { Button } from "@/frontend/components/ui/button";
import { toast } from "sonner";
import { authService, type OtpPurpose } from "@/backend/services/authService";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/frontend/lib/utils";

const OTP_SESSION_TIMEOUT_SECONDS = 300; // 5-minute request validity window

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "your registered email";
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  return `${localPart[0]}***@${domain}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getFriendlyOtpErrorMessage(err: unknown): string {
  if (!err) return "That code doesn't look right. Please check and try again.";
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
    return "Too many requests. Please wait a moment before trying again.";
  }
  if (
    msg.includes("expired") ||
    code.includes("expired") ||
    msg.includes("token has expired")
  ) {
    return "This code has expired. Request a new verification code.";
  }
  if (
    msg.includes("already been used") ||
    msg.includes("consumed") ||
    msg.includes("already used")
  ) {
    return "This code has expired. Request a new verification code.";
  }
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("connection") ||
    msg.includes("failed to fetch")
  ) {
    return "Connection issue. Please check your internet and try again.";
  }
  if (
    msg.includes("invalid") ||
    msg.includes("token is invalid") ||
    msg.includes("otp") ||
    code.includes("otp_disabled") ||
    msg.includes("incorrect") ||
    msg.includes("doesn't look right")
  ) {
    return "That code doesn't look right. Please check and try again.";
  }
  return (errorObj.message as string) || "That code doesn't look right. Please check and try again.";
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
  const [resendCooldown, setResendCooldown] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or restore session expiration timestamp
  const [sessionRemaining, setSessionRemaining] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const storedExp = sessionStorage.getItem("otp_request_expires_at");
      const storedEmail = sessionStorage.getItem("otp_request_email");
      const cleanEmail = email.trim().toLowerCase();

      if (storedExp && storedEmail === cleanEmail) {
        const expTime = parseInt(storedExp, 10);
        const diff = Math.floor((expTime - Date.now()) / 1000);
        return diff > 0 ? diff : 0;
      }

      // Fresh session
      const newExpTime = Date.now() + OTP_SESSION_TIMEOUT_SECONDS * 1000;
      sessionStorage.setItem("otp_request_expires_at", newExpTime.toString());
      sessionStorage.setItem("otp_request_email", cleanEmail);
      return OTP_SESSION_TIMEOUT_SECONDS;
    }
    return OTP_SESSION_TIMEOUT_SECONDS;
  });

  const [isTerminated, setIsTerminated] = useState<boolean>(() => sessionRemaining <= 0);
  const terminatedTriggeredRef = useRef(false);

  // Terminate the request when time runs out
  const terminateActiveRequest = useCallback(async (notify = true) => {
    if (terminatedTriggeredRef.current) return;
    terminatedTriggeredRef.current = true;
    setIsTerminated(true);
    setSessionRemaining(0);

    const cleanEmail = email.trim().toLowerCase();
    await authService.terminateOtp(cleanEmail, purpose);

    if (notify) {
      toast.error("Verification session timed out. This request has been terminated.");
    }
  }, [email, purpose]);

  // Master countdown timer: handles both 60s resend cooldown and 5-min session expiration
  useEffect(() => {
    if (isTerminated || success) return;

    const interval = setInterval(() => {
      // 1. Decrement resend cooldown
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));

      // 2. Decrement session remaining
      setSessionRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          terminateActiveRequest(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTerminated, success, terminateActiveRequest]);

  const handleRestartRequest = async () => {
    if (resending) return;
    setResending(true);
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await authService.sendOtp(cleanEmail, purpose);
      if (!res.success && res.error) {
        toast.error(res.error);
      } else {
        // Reset timers & session state
        const newExpTime = Date.now() + OTP_SESSION_TIMEOUT_SECONDS * 1000;
        if (typeof window !== "undefined") {
          sessionStorage.setItem("otp_request_expires_at", newExpTime.toString());
          sessionStorage.setItem("otp_request_email", cleanEmail);
          sessionStorage.setItem("pending_otp_verification", cleanEmail);
          sessionStorage.setItem("pending_otp_purpose", purpose);
        }

        terminatedTriggeredRef.current = false;
        setSessionRemaining(OTP_SESSION_TIMEOUT_SECONDS);
        setResendCooldown(60);
        setIsTerminated(false);
        setCode("");

        toast.success(res.message || "Your verification code is on its way! Please check your inbox.");
      }
    } catch {
      toast.error("We couldn't send your verification code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0 || resending || isTerminated) return;
    setResending(true);
    setErrorMsg(null);
    try {
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        const res = await authService.sendOtp(cleanEmail, purpose);
        if (!res.success && res.error) {
          toast.error(res.error);
        } else {
          // Refresh session timeout on active resend
          const newExpTime = Date.now() + OTP_SESSION_TIMEOUT_SECONDS * 1000;
          if (typeof window !== "undefined") {
            sessionStorage.setItem("otp_request_expires_at", newExpTime.toString());
            sessionStorage.setItem("otp_request_email", cleanEmail);
          }
          setSessionRemaining(OTP_SESSION_TIMEOUT_SECONDS);
          setResendCooldown(60);
          toast.success(res.message || "Your verification code is on its way! Please check your inbox.");
        }
      }
    } catch {
      toast.error("We couldn't send your verification code. Please try again.");
    } finally {
      setResending(false);
    }
  }, [email, purpose, resendCooldown, resending, isTerminated]);

  const handleCancelAndExit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    await authService.terminateOtp(cleanEmail, purpose);
    toast.info("Verification request cancelled.");

    if (purpose === "email_verification") {
      navigate({ to: "/signup" });
    } else if (purpose === "password_reset") {
      navigate({ to: "/forgot-password" });
    } else {
      navigate({ to: "/login" });
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isTerminated) {
      toast.error("This verification request has expired. Please request a new code.");
      return;
    }

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
        sessionStorage.removeItem("otp_request_expires_at");
        sessionStorage.removeItem("otp_request_email");
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

  const getPageTitle = () => {
    if (isTerminated) return "Verification Request Terminated";
    if (purpose === "email_verification") return "Verify your email";
    if (purpose === "login_verification") return "Confirm email ownership";
    return "Verify password reset";
  };

  const getPageSubtitle = () => {
    if (isTerminated) {
      return "The verification window timed out before a code was provided. You can request a fresh code or return to sign in.";
    }
    if (purpose === "email_verification") {
      return "Enter the 6-digit verification code sent to your email to activate your account.";
    }
    if (purpose === "login_verification") {
      return "Enter the 6-digit code sent to your email to verify your identity and access your account.";
    }
    return "Enter the 6-digit code sent to your email to reset your password.";
  };

  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-background px-4 py-10 animate-fade-in",
        Capacitor.isNativePlatform() &&
          "pt-[calc(2.5rem+max(env(safe-area-inset-top,0px),44px))] pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]",
      )}
    >
      <div className="w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={handleCancelAndExit}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="space-y-1.5 text-center sm:text-left">
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                isTerminated
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary",
              )}
            >
              {isTerminated ? <TimerOff className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {getPageTitle()}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{getPageSubtitle()}</p>
          {email && !isTerminated && (
            <p className="text-xs text-muted-foreground pt-0.5">
              Code sent to:{" "}
              <strong className="text-foreground font-semibold">{maskEmail(email)}</strong>
            </p>
          )}
        </div>

        {/* 1. SUCCESS VIEW */}
        {success ? (
          <div className="flex flex-col items-center justify-center p-8 bg-success/10 border border-success/30 rounded-3xl text-center space-y-3 animate-fade-in shadow-elevated">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <h3 className="font-display text-lg font-bold text-foreground">Code Verified!</h3>
            <p className="text-xs text-muted-foreground">
              {purpose === "password_reset"
                ? "Proceeding to set your new password..."
                : "Your account is activated. Redirecting..."}
            </p>
          </div>
        ) : isTerminated ? (
          /* 2. REQUEST TERMINATED / TIMED OUT VIEW */
          <div className="space-y-6 bg-card border border-destructive/20 rounded-3xl p-6 sm:p-8 shadow-elevated text-center animate-fade-in">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
              <TimerOff className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                Request Expired & Terminated
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You didn't enter the verification code in time. For your privacy and account security,
                this verification session has been closed.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button
                type="button"
                onClick={handleRestartRequest}
                disabled={resending}
                className="w-full gradient-primary text-primary-foreground btn-ripple-effect rounded-2xl h-12 text-sm font-semibold shadow-soft"
              >
                {resending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Requesting New Code...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Request New Code
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleCancelAndExit}
                className="w-full rounded-2xl h-12 text-sm font-medium border-border hover:bg-muted/50 cursor-pointer"
              >
                {purpose === "password_reset" ? "Back to Sign In" : "Return to Sign In"}
              </Button>
            </div>
          </div>
        ) : (
          /* 3. ACTIVE OTP INPUT VIEW */
          <form
            onSubmit={handleVerify}
            className="space-y-6 bg-card border border-border rounded-3xl p-5 sm:p-8 shadow-elevated animate-fade-in"
          >
            {/* Session Expiration Countdown Indicator */}
            <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-2xl bg-muted/40 border border-border/60">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Request expires in:
              </span>
              <span
                className={cn(
                  "font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg transition-colors",
                  sessionRemaining <= 60
                    ? "bg-destructive/15 text-destructive animate-pulse"
                    : "bg-primary/10 text-primary",
                )}
              >
                {formatTime(sessionRemaining)}
              </span>
            </div>

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
                {resendCooldown > 0 ? (
                  <span>
                    Resend code in{" "}
                    <strong className="text-foreground font-semibold">{resendCooldown}s</strong>
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

            {/* Cancel / Voluntarily terminate request */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleCancelAndExit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                Cancel verification request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
