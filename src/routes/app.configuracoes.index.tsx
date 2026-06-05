import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listAppUsers,
  setUserPrimaryRole,
  deleteAppUser,
} from "@/lib/user-admin.functions";
import { NewUserWizard } from "@/components/admin/NewUserWizard";

export const Route = createFileRoute("/app/configuracoes/")({ component: SettingsPage });

const MANAGER_ROLES: AppRole[] = ["admin", "gerente_comercial", "diretoria"];

const ASSIGNABLE_ROLES: AppRole[] = [
  "vendedor",
  "sdr",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "diretoria",
  "administrativo",
  "admin",
];

function SettingsPage() {
  const { user, roles, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(MANAGER_ROLES);
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).single()).data,
    enabled: !!user,
  });

  return (
    <>
      <PageHeader title="Configurações" subtitle="Sua conta e perfis do sistema" />
      <div className="space-y-6">
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
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Gestão de usuários</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cadastre um novo usuário e atribua o nível de acesso.
                </p>
              </div>
              {canManage && <NewUserWizard />}
            </div>
            {!canManage && (
              <p className="text-xs text-muted-foreground">
                Apenas administradores, diretoria e gerência comercial podem cadastrar novos usuários.
              </p>
            )}
            {canManage && (
              <Button asChild variant="outline" size="sm" className="mt-3 gap-2">
                <Link to="/app/configuracoes/permissoes">
                  <ShieldCheck className="h-4 w-4" /> Gerenciar permissões por módulo
                </Link>
              </Button>
            )}
          </div>
        </div>

        {canManage && <UsersTable currentUserId={user?.id ?? ""} />}
      </div>
    </>
  );
}

function UsersTable({ currentUserId }: { currentUserId: string }) {
  const list = useServerFn(listAppUsers);
  const setRole = useServerFn(setUserPrimaryRole);
  const remove = useServerFn(deleteAppUser);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => list(),
  });

  const handleRoleChange = async (userId: string, role: AppRole) => {
    try {
      await setRole({ data: { userId, role } });
      toast.success("Nível atualizado.");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar nível.");
    }
  };

  const handleDelete = async (userId: string, name: string) => {
    if (!confirm(`Remover ${name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await remove({ data: { userId } });
      toast.success("Usuário removido.");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover usuário.");
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
      <div className="border-b px-6 py-4">
        <h2 className="text-sm font-semibold">Usuários cadastrados</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isLoading ? "Carregando..." : `${data?.length ?? 0} usuário(s)`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Nome</th>
              <th className="px-6 py-3 text-left font-medium">E-mail</th>
              <th className="px-6 py-3 text-left font-medium">Nível de acesso</th>
              <th className="px-6 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => {
              const primary = (u.roles[0] ?? "vendedor") as AppRole;
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t">
                  <td className="px-6 py-3">{u.fullName ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                  <td className="px-6 py-3">
                    <Select
                      value={primary}
                      onValueChange={(v) => handleRoleChange(u.id, v as AppRole)}
                    >
                      <SelectTrigger className="h-8 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={isSelf}
                      onClick={() => handleDelete(u.id, u.fullName ?? u.email ?? "usuário")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
