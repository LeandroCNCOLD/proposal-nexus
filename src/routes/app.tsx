import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const [authGuardTimedOut, setAuthGuardTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      setAuthGuardTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthGuardTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  if (loading && !authGuardTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <AppShell><Outlet /></AppShell>;
}
