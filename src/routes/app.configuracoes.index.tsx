import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, Search, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "@/lib/proposal";
import { nomusSyncRepresentatives, nomusSyncSellers } from "@/integrations/nomus/server.functions";
import { useServerFn } from "@tanstack/react-start";
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
  const syncSellers = useServerFn(nomusSyncSellers);
  const syncRepresentatives = useServerFn(nomusSyncRepresentatives);
  const canManageAccess = hasAnyRole(MANAGER_ROLES);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", suggested_role: "coldpro" as AppRole });
  const [accessSearch, setAccessSearch] = useState("");
  const [importingNomus, setImportingNomus] = useState(false);
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

  const searchTerm = accessSearch.trim().toLowerCase();
  const filteredAccessQueue = useMemo(() => {
    if (!searchTerm) return accessQueue;
    return accessQueue.filter((item) => [item.full_name, item.email, item.source, item.nomus_user_id].filter(Boolean).some((value) => String(value).toLowerCase().includes(searchTerm)));
  }, [accessQueue, searchTerm]);
  const filteredProfiles = useMemo(() => {
    if (!searchTerm) return allProfiles;
    return allProfiles.filter((item) => [item.full_name, item.email, item.access_source, item.nomus_user_id].filter(Boolean).some((value) => String(value).toLowerCase().includes(searchTerm)));
  }, [allProfiles, searchTerm]);

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

  const importNomusUsers = async () => {
    setImportingNomus(true);
    try {
      await Promise.all([syncSellers({}), syncRepresentatives({})]);
      const [{ data: sellers }, { data: representatives }] = await Promise.all([
        supabase.from("nomus_sellers").select("nomus_id, name, email").not("email", "is", null),
        supabase.from("nomus_representatives").select("nomus_id, name, email").not("email", "is", null),
      ]);
      const byEmail = new Map<string, { full_name: string; email: string; source: string; nomus_user_id: string | null; suggested_role: AppRole; status: string }>();
      for (const item of [...(sellers ?? []), ...(representatives ?? [])]) {
        if (!item.email) continue;
        byEmail.set(item.email.toLowerCase(), {
          full_name: item.name,
          email: item.email.toLowerCase(),
          source: "nomus",
          nomus_user_id: item.nomus_id,
          suggested_role: "vendedor",
          status: "pending",
        });
      }
      if (byEmail.size === 0) return toast.info("Nenhum usuário com e-mail encontrado no Nomus.");
      const { error } = await supabase.from("user_access_queue").upsert([...byEmail.values()], { onConflict: "email" });
      if (error) return toast.error(error.message);
      refreshAccess();
      toast.success(`${byEmail.size} usuário(s) do Nomus enviados para liberação.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao buscar usuários no Nomus.");
    } finally {
      setImportingNomus(false);
    }
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
      <div className="grid gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
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
                  <Badge key={role} variant="secondary">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        <section className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Gestão de perfis e usuários</h2>
              <p className="mt-1 text-xs text-muted-foreground">Usuários do Nomus entram pendentes; gestor libera acesso e define perfis.</p>
            </div>
            <Badge variant={canManageAccess ? "default" : "outline"}>{canManageAccess ? "Gestor" : "Sem gestão"}</Badge>
          </div>
          {!canManageAccess ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Seu perfil atual não permite liberar acessos.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-lg border bg-background/40 p-4 md:grid-cols-[1fr_1fr_180px_auto]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input value={newUser.full_name} onChange={(event) => setNewUser((value) => ({ ...value, full_name: event.target.value }))} placeholder="Nome do usuário" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input value={newUser.email} onChange={(event) => setNewUser((value) => ({ ...value, email: event.target.value }))} placeholder="email@empresa.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Perfil inicial</Label>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={newUser.suggested_role} onChange={(event) => setNewUser((value) => ({ ...value, suggested_role: event.target.value as AppRole }))}>
                    {ACCESS_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={addPendingUser}><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button>
                </div>
              </div>

              <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Pendentes de liberação</h3>
                <Button size="sm" variant="outline" onClick={importNomusUsers}><RefreshCw className="mr-2 h-3.5 w-3.5" />Importar Nomus</Button>
              </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Origem</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {accessQueue.length === 0 ? <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Nenhuma liberação pendente.</TableCell></TableRow> : accessQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><div className="font-medium">{item.full_name}</div><div className="text-xs text-muted-foreground">{item.email}</div></TableCell>
                        <TableCell className="capitalize">{item.source}</TableCell>
                        <TableCell>{ROLE_LABELS[item.suggested_role]}</TableCell>
                        <TableCell><Badge variant={item.status === "pending" ? "outline" : item.status === "approved" ? "default" : "secondary"}>{item.status === "pending" ? "Pendente" : item.status === "approved" ? "Aprovado" : "Rejeitado"}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => updateQueueStatus(item.id, item.status === "approved" ? "pending" : "approved")}>{item.status === "approved" ? "Reabrir" : "Aprovar"}</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Usuários com login</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Acesso</TableHead><TableHead>Perfis</TableHead><TableHead className="text-right">Controle</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {allProfiles.map((item) => {
                      const assignedRoles = rolesByUser.get(item.id) ?? [];
                      return (
                        <TableRow key={item.id}>
                          <TableCell><div className="font-medium">{item.full_name}</div><div className="text-xs text-muted-foreground">{item.email ?? "—"}</div></TableCell>
                          <TableCell><Badge variant={item.access_status === "active" ? "default" : item.access_status === "pending" ? "outline" : "destructive"}>{ACCESS_STATUS_LABELS[item.access_status] ?? item.access_status}</Badge></TableCell>
                          <TableCell><div className="flex max-w-xl flex-wrap gap-1.5">{ACCESS_ROLES.map((role) => <label key={role} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><input type="checkbox" checked={assignedRoles.includes(role)} onChange={(event) => toggleRole(item.id, role, event.target.checked)} />{ROLE_LABELS[role]}</label>)}</div></TableCell>
                          <TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="icon" variant="outline" onClick={() => updateProfileStatus(item.id, "active")}><CheckCircle2 className="h-4 w-4" /></Button><Button size="icon" variant="outline" onClick={() => updateProfileStatus(item.id, "blocked")}><XCircle className="h-4 w-4" /></Button></div></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}