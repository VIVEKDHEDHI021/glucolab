import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/frontend/lib/auth-context";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    navigate({
      to: user ? "/dashboard" : "/login",
      replace: true,
    });
  }, [loading, user, navigate]);

  return <div className="min-h-screen bg-background" />;
}
