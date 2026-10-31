import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/frontend/lib/auth-context";

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
      if (profile?.onboarding_completed) {
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

  return <div className="min-h-screen bg-background" />;
}
