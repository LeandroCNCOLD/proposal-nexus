import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Save, Search, Shield, UserCog } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";
import { PERMISSION_MODULES, DEFAULT_ROLE_PACKAGES } from "@/lib/permissions";
import {
  listRoleTemplates,
  setRoleTemplate,
  listUserOverrides,
  setUserOverrides,
} from "@/lib/permissions.functions";
import { listAppUsers } from "@/lib/user-admin.functions";

export const Route = createFileRoute("/app/configuracoes/permissoes")({
  component: PermissionsPage,
});

const MANAGE_ROLES: AppRole[] = ["admin", "diretoria", "gerente_comercial"];
const EDITABLE_ROLES: AppRole[] = [
  "vendedor",
  "sdr",
  "marketing",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "diretoria",
  "administrativo",
  "admin",
];

function PermissionsPage() {
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(MANAGE_ROLES);

  return (
    <>
      <PageHeader
        title="Permissões"
        subtitle="Defina o que cada perfil pode fazer e libere ou bloqueie acessos por usuário"
      />
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/configuracoes">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar às configurações
          </Link>
        </Button>
      </div>

      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          Sem permissão para gerenciar permissões.
        </p>
      ) : (
        <Tabs defaultValue="roles" className="space-y-4">
          <TabsList>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" /> Perfis (modelos)
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <UserCog className="h-4 w-4" /> Por usuário
            </TabsTrigger>
          </TabsList>
          <TabsContent value="roles">
            <RoleTemplatesPanel />
          </TabsContent>
          <TabsContent value="users">
            <UserOverridesPanel />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function RoleTemplatesPanel() {
  const fetchTpls = useServerFn(listRoleTemplates);
  const save = useServerFn(setRoleTemplate);
  const qc = useQueryClient();
  const [role, setRole] = useState<AppRole>("sdr");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["role-templates"],
    queryFn: () => fetchTpls(),
  });

  useEffect(() => {
    const list = (templates?.[role] ?? []) as string[];
    // Se não há nada salvo para esse perfil, sugere o pacote padrão
    const initial = list.length > 0 ? list : (DEFAULT_ROLE_PACKAGES[role] ?? []);
    setSelected(new Set(initial));
  }, [role, templates]);


  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const toggleModule = (moduleKey: string, on: boolean) => {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)!;
    const next = new Set(selected);
    for (const p of mod.permissions) {
      if (on) next.add(p.key);
      else next.delete(p.key);
    }
    setSelected(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ data: { role, permissionKeys: Array.from(selected) } });
      toast.success(`Modelo do perfil ${ROLE_LABELS[role]} atualizado.`);
      qc.invalidateQueries({ queryKey: ["role-templates"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label>Perfil</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EDITABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={saving || isLoading} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar modelo"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PERMISSION_MODULES.map((mod) => {
          const total = mod.permissions.length;
          const active = mod.permissions.filter((p) => selected.has(p.key)).length;
          const allOn = active === total;
          return (
            <div key={mod.key} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{mod.label}</h3>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => toggleModule(mod.key, !allOn)}
                >
                  {allOn ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              <ul className="space-y-2">
                {mod.permissions.map((p) => (
                  <li key={p.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`tpl-${p.key}`}
                      checked={selected.has(p.key)}
                      onCheckedChange={() => toggle(p.key)}
                    />
                    <label
                      htmlFor={`tpl-${p.key}`}
                      className="text-sm leading-tight"
                    >
                      {p.label}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {p.key}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Effect = "inherit" | "grant" | "revoke";

function UserOverridesPanel() {
  const fetchUsers = useServerFn(listAppUsers);
  const fetchOver = useServerFn(listUserOverrides);
  const save = useServerFn(setUserOverrides);
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const [state, setState] = useState<Map<string, Effect>>(new Map());
  const [saving, setSaving] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => fetchUsers(),
  });

  const filteredUsers = useMemo(() => {
    const list = users ?? [];
    if (roleFilter === "all") return list;
    return list.filter((u) => (u.roles ?? []).includes(roleFilter));
  }, [users, roleFilter]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["user-overrides", userId],
    queryFn: () => fetchOver({ data: { userId } }),
    enabled: !!userId,
  });

  const inherited = useMemo(
    () => new Set(detail?.inherited ?? []),
    [detail],
  );

  useEffect(() => {
    const m = new Map<string, Effect>();
    for (const o of detail?.overrides ?? []) {
      m.set(o.permission_key, o.effect);
    }
    setState(m);
  }, [detail]);

  const getEffect = (key: string): Effect => state.get(key) ?? "inherit";

  const cycle = (key: string) => {
    const current = getEffect(key);
    const isInherited = inherited.has(key);
    // Para herdadas: inherit -> revoke -> inherit
    // Para não herdadas: inherit -> grant -> inherit
    const next: Effect =
      current !== "inherit" ? "inherit" : isInherited ? "revoke" : "grant";
    const m = new Map(state);
    if (next === "inherit") m.delete(key);
    else m.set(key, next);
    setState(m);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const overrides = Array.from(state.entries()).map(([k, e]) => ({
        permissionKey: k,
        effect: e as "grant" | "revoke",
      }));
      await save({ data: { userId, overrides } });
      toast.success("Permissões do usuário atualizadas.");
      qc.invalidateQueries({ queryKey: ["user-overrides", userId] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const isEffective = (key: string) => {
    const eff = getEffect(key);
    if (eff === "grant") return true;
    if (eff === "revoke") return false;
    return inherited.has(key);
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label>Usuário</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {(users ?? []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName ?? u.email ?? u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSave} disabled={!userId || saving || isLoading} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar liberações"}
        </Button>
      </div>

      {!userId ? (
        <p className="text-sm text-muted-foreground">
          Selecione um usuário para gerenciar suas permissões.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Perfis do usuário:{" "}
            {(detail?.roles ?? []).map((r) => ROLE_LABELS[r]).join(", ") || "—"}.
            Marque <span className="font-medium text-emerald-600">liberar</span>{" "}
            para conceder algo extra ou{" "}
            <span className="font-medium text-destructive">bloquear</span> para
            tirar uma permissão herdada do perfil.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {PERMISSION_MODULES.map((mod) => (
              <div key={mod.key} className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">{mod.label}</h3>
                <ul className="space-y-2">
                  {mod.permissions.map((p) => {
                    const eff = getEffect(p.key);
                    const inh = inherited.has(p.key);
                    const effective = isEffective(p.key);
                    return (
                      <li
                        key={p.key}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="text-sm leading-tight">
                          <div>{p.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inh ? "Herdada do perfil" : "Não herdada"} ·{" "}
                            <span
                              className={
                                effective
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                              }
                            >
                              {effective ? "Ativa" : "Inativa"}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => cycle(p.key)}
                          className={
                            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition " +
                            (eff === "grant"
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                              : eff === "revoke"
                                ? "border-destructive bg-destructive/10 text-destructive"
                                : "border-border bg-muted/40 text-muted-foreground")
                          }
                        >
                          {eff === "grant"
                            ? "Liberado"
                            : eff === "revoke"
                              ? "Bloqueado"
                              : "Herdado"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
