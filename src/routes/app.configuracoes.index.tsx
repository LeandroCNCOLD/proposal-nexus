import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, EyeOff, RefreshCw, Search, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "@/lib/proposal";
import { APP_MODULES, MODULE_ACCESS_DESCRIPTION, roleCanAccessPath, type RoleModuleAccess } from "@/lib/module-access";
import { approveUserAccessQueueItem, nomusImportInternalUsersToAccessQueue, resetUserTemporaryPassword } from "@/integrations/nomus/server.functions";
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
  const importInternalUsers = useServerFn(nomusImportInternalUsersToAccessQueue);
  const approvePendingUser = useServerFn(approveUserAccessQueueItem);
  const resetTemporaryPassword = useServerFn(resetUserTemporaryPassword);
  const canManageAccess = hasAnyRole(MANAGER_ROLES);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", suggested_role: "coldpro" as AppRole });
  const [accessSearch, setAccessSearch] = useState("");
  const [temporaryPasswords, setTemporaryPasswords] = useState<Record<string, string>>({});
  const [profileTemporaryPasswords, setProfileTemporaryPasswords] = useState<Record<string, string>>({});
  const [importingNomus, setImportingNomus] = useState(false);
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["access-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email, access_status, access_source, nomus_user_id, blocked_reason, must_change_password").order("full_name")).data ?? [],
    enabled: canManageAccess,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["access-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("id, user_id, role")).data ?? [],
    enabled: canManageAccess,
  });

  const { data: moduleAccess = [] } = useQuery<RoleModuleAccess[]>({
    queryKey: ["role-module-access"],
    queryFn: async () => (await supabase.from("role_module_access").select("role, module_key, module_path, allowed")).data ?? [],
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
    qc.invalidateQueries({ queryKey: ["role-module-access"] });
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
      const result = await importInternalUsers({});
      if (!result.ok) return toast.error(result.error);
      refreshAccess();
      if (result.count === 0) toast.info(result.message);
      else toast.success(result.message);
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

  const toggleModuleAccess = async (role: AppRole, module: (typeof APP_MODULES)[number], allowed: boolean) => {
    const { error } = await supabase.from("role_module_access").upsert({ role, module_key: module.key, module_path: module.path, allowed }, { onConflict: "role,module_key" });
    if (error) return toast.error(error.message);
    refreshAccess();
    toast.success(allowed ? "Acesso liberado para este perfil." : "Acesso removido deste perfil.");
  };

  const updateQueueStatus = async (queueId: string, status: "approved" | "rejected" | "pending") => {
    if (status === "approved") {
      const temporaryPassword = temporaryPasswords[queueId]?.trim() ?? "";
      if (temporaryPassword.length < 8) return toast.error("Informe uma senha provisória com pelo menos 8 caracteres.");
      const result = await approvePendingUser({ data: { queueId, temporaryPassword } });
      if (!result.ok) return toast.error(result.error);
      setTemporaryPasswords((current) => {
        const next = { ...current };
        delete next[queueId];
        return next;
      });
      refreshAccess();
      toast.success(result.message);
      return;
    }
    const { error } = await supabase.from("user_access_queue").update({ status, approved_by: null, approved_at: null }).eq("id", queueId);
    if (error) return toast.error(error.message);
    refreshAccess();
    toast.success(status === "rejected" ? "Pré-liberação rejeitada." : "Pré-liberação voltou para pendente.");
  };

  const resetProfilePassword = async (profileId: string) => {
    const temporaryPassword = profileTemporaryPasswords[profileId]?.trim() ?? "";
    if (temporaryPassword.length < 8) return toast.error("Informe uma senha provisória com pelo menos 8 caracteres.");
    const result = await resetTemporaryPassword({ data: { profileId, temporaryPassword } });
    if (!result.ok) return toast.error(result.error);
    setProfileTemporaryPasswords((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    refreshAccess();
    toast.success(result.message);
  };

  return (
    <>
      <PageHeader title="Configurações" subtitle="Perfis, módulos liberados e senhas provisórias dos usuários" />
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
              <h2 className="text-sm font-semibold">Gestão de usuários, perfis e módulos</h2>
              <p className="mt-1 text-xs text-muted-foreground">Ao marcar um perfil, o sistema libera automaticamente os módulos correspondentes para o usuário.</p>
            </div>
            <Badge variant={canManageAccess ? "default" : "outline"}>{canManageAccess ? "Gestor" : "Sem gestão"}</Badge>
          </div>
          {!canManageAccess ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Seu perfil atual não permite liberar acessos.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-2 rounded-lg border bg-background/40 p-4 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1.5 md:min-w-[340px]">
                  <Label className="text-xs">Buscar usuário</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-8" value={accessSearch} onChange={(event) => setAccessSearch(event.target.value)} placeholder="Nome, e-mail, origem ou ID Nomus" />
                  </div>
                </div>
                <Button variant="outline" onClick={importNomusUsers} disabled={importingNomus}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${importingNomus ? "animate-spin" : ""}`} />
                  {importingNomus ? "Buscando usuários internos" : "Buscar usuários internos no Nomus"}
                </Button>
              </div>

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

              <div className="grid gap-2 rounded-lg border bg-background/40 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {ACCESS_ROLES.map((role) => (
                  <div key={role} className="rounded-md border bg-card p-3">
                    <div className="text-xs font-semibold">{ROLE_LABELS[role]}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{MODULE_ACCESS_DESCRIPTION[role]}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-background/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matriz de acesso por módulo</h3>
                  <Badge variant="outline">{APP_MODULES.length} módulos</Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-44">Módulo</TableHead>
                        {ACCESS_ROLES.map((role) => <TableHead key={role} className="min-w-32 text-center">{ROLE_LABELS[role]}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {APP_MODULES.map((module) => (
                        <TableRow key={module.key}>
                          <TableCell className="font-medium">{module.label}</TableCell>
                          {ACCESS_ROLES.map((role) => {
                            const allowed = roleCanAccessPath(role, module.path, moduleAccess);
                            return (
                              <TableCell key={`${module.key}-${role}`} className="text-center">
                                <button type="button" onClick={() => toggleModuleAccess(role, module, !allowed)} className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors hover:opacity-100 ${allowed ? "border-success/30 bg-success/10 text-success hover:bg-success/20" : "border-destructive/20 bg-destructive/5 text-destructive/70 opacity-70 hover:bg-destructive/10"}`} title={allowed ? "Clique para remover o acesso" : "Clique para liberar o acesso"} aria-label={allowed ? `Remover acesso de ${ROLE_LABELS[role]} ao módulo ${module.label}` : `Liberar acesso de ${ROLE_LABELS[role]} ao módulo ${module.label}`}>
                                  {allowed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                </button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> Pendentes de liberação</h3>
                <Badge variant="outline">{filteredAccessQueue.length} registro(s)</Badge>
              </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Origem</TableHead><TableHead>Perfil</TableHead><TableHead>Status</TableHead><TableHead>Senha provisória</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredAccessQueue.length === 0 ? <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">Nenhuma liberação encontrada.</TableCell></TableRow> : filteredAccessQueue.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><div className="font-medium">{item.full_name}</div><div className="text-xs text-muted-foreground">{item.email}</div></TableCell>
                        <TableCell className="capitalize">{item.source}</TableCell>
                        <TableCell>{ROLE_LABELS[item.suggested_role]}</TableCell>
                        <TableCell><Badge variant={item.status === "pending" ? "outline" : item.status === "approved" ? "default" : "secondary"}>{item.status === "pending" ? "Pendente" : item.status === "approved" ? "Aprovado" : "Rejeitado"}</Badge></TableCell>
                        <TableCell><Input type="password" autoComplete="new-password" disabled={item.status === "approved"} value={temporaryPasswords[item.id] ?? ""} onChange={(event) => setTemporaryPasswords((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Mín. 8 caracteres" /></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => updateQueueStatus(item.id, item.status === "approved" ? "pending" : "approved")}>{item.status === "approved" ? "Reabrir" : "Aprovar"}</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Usuários com login</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Acesso</TableHead><TableHead>Perfis / módulos liberados</TableHead><TableHead>Senha provisória</TableHead><TableHead className="text-right">Controle</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredProfiles.map((item) => {
                      const assignedRoles = rolesByUser.get(item.id) ?? [];
                      return (
                        <TableRow key={item.id}>
                          <TableCell><div className="font-medium">{item.full_name}</div><div className="text-xs text-muted-foreground">{item.email ?? "—"}</div></TableCell>
                          <TableCell><div className="flex flex-col items-start gap-1"><Badge variant={item.access_status === "active" ? "default" : item.access_status === "pending" ? "outline" : "destructive"}>{ACCESS_STATUS_LABELS[item.access_status] ?? item.access_status}</Badge>{item.must_change_password && <Badge variant="outline">Troca pendente</Badge>}</div></TableCell>
                          <TableCell><div className="flex max-w-xl flex-wrap gap-1.5">{ACCESS_ROLES.map((role) => <label key={role} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><input type="checkbox" checked={assignedRoles.includes(role)} onChange={(event) => toggleRole(item.id, role, event.target.checked)} />{ROLE_LABELS[role]}</label>)}</div></TableCell>
                          <TableCell><div className="flex min-w-56 gap-2"><Input type="password" autoComplete="new-password" value={profileTemporaryPasswords[item.id] ?? ""} onChange={(event) => setProfileTemporaryPasswords((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Nova provisória" /><Button size="sm" variant="outline" onClick={() => resetProfilePassword(item.id)}>Resetar</Button></div></TableCell>
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