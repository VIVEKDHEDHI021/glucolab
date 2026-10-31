import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { authService } from "@/backend/services/authService";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/signup",
        replace: true,
      });
    } else if (profile !== undefined) {
      const isReturningOrCompleted =
        authService.isReturningUser(user, profile) ||
        Boolean(profile?.onboarding_completed) ||
        Boolean(user?.user_metadata?.onboarding_completed) ||
        (typeof window !== "undefined" &&
          (localStorage.getItem(`glucolab_onboarding_completed_${user.id}`) === "true" ||
           localStorage.getItem(`glucolab_has_logged_in_${user.id}`) === "true"));

      if (isReturningOrCompleted) {
        authService.markUserAsLoggedIn(user);
        navigate({
          to: "/dashboard",
          replace: true,
        });
      } else {
        navigate({
          to: "/onboarding",
          replace: true,
        });
      }
    }
  }, [loading, user, profile, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-14 w-14 rounded-2xl overflow-hidden animate-pulse border border-border/40 shadow-sm p-1 bg-card">
        <img src="/icon/icon.png" alt="GlucoLab" className="h-full w-full object-contain" />
      </div>
    </div>
  );
}
