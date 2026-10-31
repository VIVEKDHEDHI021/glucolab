import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { authService } from "@/backend/services/authService";
import { AppShell } from "@/frontend/components/app-shell";
import { Activity } from "lucide-react";
import { PendingInsulinManager } from "@/features/pending-insulin";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const isPendingOtp =
    typeof window !== "undefined" &&
    Boolean(sessionStorage.getItem("pending_otp_verification"));

  const pendingEmail =
    (typeof window !== "undefined" &&
      sessionStorage.getItem("pending_otp_verification")) ||
    user?.email ||
    "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Clear any leftover modal pointer-events/scroll locks
        if (typeof window !== "undefined") {
          document.body.style.pointerEvents = "";
          document.body.style.overflow = "";
          document.body.removeAttribute("data-scroll-locked");
        }
        navigate({ to: "/login", replace: true });
      } else if (!authService.isEmailVerified(user) || isPendingOtp) {
        // User is unverified or signup OTP verification is pending: strictly redirect to OTP challenge
        const targetEmail = user?.email || pendingEmail;
        navigate({
          to: "/otp",
          search: {
            email: targetEmail,
            purpose: "email_verification",
          },
          replace: true,
        });
      } else if (profile !== undefined && !profile?.onboarding_completed) {
        // Onboarding is incomplete: route strictly to onboarding wizard
        navigate({
          to: "/onboarding",
          replace: true,
        });
      }
    }
  }, [loading, user, profile, isPendingOtp, pendingEmail, navigate]);

  if (
    loading ||
    !user ||
    !authService.isEmailVerified(user) ||
    isPendingOtp ||
    profile === undefined ||
    !profile?.onboarding_completed
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
      <PendingInsulinManager />
    </AppShell>
  );
}
