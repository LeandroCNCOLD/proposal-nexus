import { createFileRoute, Outlet, Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { getAllowedModulePaths, isAppRouteAllowed } from "@/lib/module-access";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, roles, loading } = useAuth();
  const { pathname } = useLocation();
  const [authGuardTimedOut, setAuthGuardTimedOut] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile-access", user?.id],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("access_status, must_change_password")
          .eq("id", user!.id)
          .single()
      ).data,
    enabled: !!user,
  });
  const { data: moduleAccess = [], isLoading: loadingModuleAccess } = useQuery({
    queryKey: ["role-module-access"],
    queryFn: async () =>
      (await supabase.from("role_module_access").select("role, module_key, module_path, allowed"))
        .data ?? [],
    enabled: !!user,
  });
  const accessGuardLoading = loading || loadingProfile || loadingModuleAccess;

  React.useEffect(() => {
    if (!accessGuardLoading) {
      setAuthGuardTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setAuthGuardTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, [accessGuardLoading]);

  if (accessGuardLoading && !authGuardTimedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (profile?.access_status && profile.access_status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
        Seu acesso está pendente de liberação pelo gestor.
      </div>
    );
  }
  if (profile?.must_change_password) {
    const submitPasswordChange = async (event: React.FormEvent) => {
      event.preventDefault();
      setPasswordError(null);
      if (newPassword.length < 8)
        return setPasswordError("A nova senha deve ter pelo menos 8 caracteres.");
      if (newPassword !== confirmPassword) return setPasswordError("As senhas não conferem.");
      setChangingPassword(true);
      const { error: passwordUpdateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (passwordUpdateError) {
        setChangingPassword(false);
        return setPasswordError(passwordUpdateError.message);
      }
      const { error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);
      setChangingPassword(false);
      if (profileUpdateError) return setPasswordError(profileUpdateError.message);
      window.location.reload();
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <form
          onSubmit={submitPasswordChange}
          className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]"
        >
          <h1 className="text-xl font-semibold tracking-tight">Troque sua senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você recebeu uma senha provisória. Defina uma nova senha para continuar.
          </p>
          <div className="mt-6 space-y-4">
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              type="password"
              autoComplete="new-password"
              placeholder="Nova senha"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              type="password"
              autoComplete="new-password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <button
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={changingPassword}
              type="submit"
            >
              {changingPassword ? "Salvando..." : "Salvar nova senha"}
            </button>
          </div>
        </form>
      </div>
    );
  }
  if (!isAppRouteAllowed(pathname, roles, moduleAccess)) {
    const fallbackPath =
      getAllowedModulePaths(roles, moduleAccess).find((path) => path !== "*") ??
      "/app/configuracoes";
    // Guard against infinite redirect: if fallback resolves to the same path
    // or to another disallowed path, render a friendly message instead.
    if (fallbackPath === pathname || !isAppRouteAllowed(fallbackPath, roles, moduleAccess)) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-muted-foreground">
          Você não tem permissão para acessar nenhum módulo. Solicite liberação ao gestor.
        </div>
      );
    }
    return <Navigate to={fallbackPath} />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
