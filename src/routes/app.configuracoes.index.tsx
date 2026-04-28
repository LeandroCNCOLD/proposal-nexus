import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "@/lib/proposal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes/")({ component: SettingsPage });

const MANAGER_ROLES: AppRole[] = ["admin", "gerente_comercial", "diretoria"];
const ACCESS_ROLES: AppRole[] = ["admin", "diretoria", "gerente_comercial", "engenharia", "orcamentista", "administrativo", "vendedor", "coldpro"];

const ACCESS_STATUS_LABELS: Record<string, string> = {
  active: "Liberado",
  pending: "Pendente",
  blocked: "Bloqueado",
};

function SettingsPage() {
  const { user, roles, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canManageAccess = hasAnyRole(MANAGER_ROLES);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", suggested_role: "coldpro" as AppRole });
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["access-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, access_status, access_source, nomus_user_id, blocked_reason").order("full_name")).data ?? [],
    enabled: canManageAccess,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["access-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("id, user_id, role")).data ?? [],
    enabled: canManageAccess,
  });

  const { data: accessQueue = [] } = useQuery({
    queryKey: ["user-access-queue"],
    queryFn: async () => (await supabase.from("user_access_queue").select("*").order("created_at", { ascending: false })).data ?? [],
    enabled: canManageAccess,
  });

  const rolesByUser = useMemo(() => {
    const grouped = new Map<string, AppRole[]>();
    for (const item of userRoles) grouped.set(item.user_id, [...(grouped.get(item.user_id) ?? []), item.role]);
    return grouped;
  }, [userRoles]);

  const refreshAccess = () => {
    qc.invalidateQueries({ queryKey: ["access-profiles"] });
    qc.invalidateQueries({ queryKey: ["access-user-roles"] });
    qc.invalidateQueries({ queryKey: ["user-access-queue"] });
  };

  const addPendingUser = async () => {
    if (!newUser.full_name.trim() || !newUser.email.trim()) return toast.error("Informe nome e e-mail.");
    const { error } = await supabase.from("user_access_queue").upsert({
      full_name: newUser.full_name.trim(),
      email: newUser.email.trim().toLowerCase(),
      source: "manual",
      status: "pending",
      suggested_role: newUser.suggested_role,
    }, { onConflict: "email" });
    if (error) return toast.error(error.message);
    setNewUser({ full_name: "", email: "", suggested_role: "coldpro" });
    refreshAccess();
    toast.success("Usuário colocado como pendente para liberação.");
  };

  const updateProfileStatus = async (profileId: string, access_status: "active" | "blocked" | "pending") => {
    const { error } = await supabase.from("profiles").update({ access_status, blocked_reason: access_status === "blocked" ? "Bloqueado pelo gestor" : null }).eq("id", profileId);
    if (error) return toast.error(error.message);
    refreshAccess();
    toast.success(access_status === "active" ? "Acesso liberado." : access_status === "blocked" ? "Acesso bloqueado." : "Acesso marcado como pendente.");
  };

  const toggleRole = async (profileId: string, role: AppRole, checked: boolean) => {
    const currentRole = userRoles.find((item) => item.user_id === profileId && item.role === role);
    const { error } = checked
      ? await supabase.from("user_roles").insert({ user_id: profileId, role })
      : currentRole
        ? await supabase.from("user_roles").delete().eq("id", currentRole.id)
        : { error: null };
    if (error) return toast.error(error.message);
    refreshAccess();
  };

  const updateQueueStatus = async (queueId: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await supabase.from("user_access_queue").update({ status, approved_by: status === "approved" ? user?.id : null, approved_at: status === "approved" ? new Date().toISOString() : null }).eq("id", queueId);
    if (error) return toast.error(error.message);
    refreshAccess();
    toast.success(status === "approved" ? "Pré-liberação aprovada." : status === "rejected" ? "Pré-liberação rejeitada." : "Pré-liberação voltou para pendente.");
  };

  return (
    <>
      <PageHeader title="Configurações" subtitle="Sua conta e perfis do sistema" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-4 text-sm font-semibold">Minha conta</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd>{profile?.full_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Perfis</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {ROLE_LABELS[role]}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="mb-2 text-sm font-semibold">Gestão de perfis</h2>
          <p className="text-xs text-muted-foreground">
            A gestão de perfis de outros usuários (atribuição de papéis) está disponível para administradores e será implementada em próxima iteração.
          </p>
        </div>
      </div>
    </>
  );
}