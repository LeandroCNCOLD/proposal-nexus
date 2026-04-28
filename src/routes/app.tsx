import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, roles, loading } = useAuth();
  const { pathname } = useLocation();
  const [authGuardTimedOut, setAuthGuardTimedOut] = React.useState(false);
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile-access", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("access_status").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  React.useEffect(() => {
    if (!loading) {
      setAuthGuardTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthGuardTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  if ((loading || loadingProfile) && !authGuardTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile?.access_status && profile.access_status !== "active") {
    return <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">Seu acesso está pendente de liberação pelo gestor.</div>;
  }
  const coldProOnly = roles.length > 0 && roles.every((role) => role === "coldpro");
  if (coldProOnly && !pathname.startsWith("/app/coldpro") && !pathname.startsWith("/app/configuracoes")) {
    return <Navigate to="/app/coldpro" />;
  }
  return <AppShell><Outlet /></AppShell>;
}
