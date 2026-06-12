import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { FollowupReminder } from "@/modules/sdr/components/FollowupReminder";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [authGuardTimedOut, setAuthGuardTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!loading) {
      setAuthGuardTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthGuardTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const { data: mustChange } = useQuery({
    queryKey: ["must-change-password", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .maybeSingle();
      return !!data?.must_change_password;
    },
  });

  if (loading && !authGuardTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (mustChange && pathname !== "/trocar-senha") return <Navigate to="/trocar-senha" />;
  return <AppShell><Outlet /><FollowupReminder /></AppShell>;
}

