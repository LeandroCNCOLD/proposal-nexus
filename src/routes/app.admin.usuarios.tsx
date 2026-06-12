import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Trash2, Users as UsersIcon, ShieldCheck, UserCog, Lock, Pencil,
  Copy, Sparkles, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NewUserWizard } from "@/components/admin/NewUserWizard";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useIsManager } from "@/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/proposal";
import {
  listAppUsers,
  updateUserFull,
  deleteAppUser,
  setUserPassword,
} from "@/lib/user-admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/admin/usuarios")({
  component: UsersAdminPage,
});

const ALL_ASSIGNABLE: AppRole[] = [
  "sdr", "vendedor", "marketing", "gerente_comercial", "engenharia",
  "orcamentista", "administrativo", "diretoria", "admin",
];
const GERENTE_ASSIGNABLE: AppRole[] = ["sdr", "vendedor", "marketing"];

const ROLE_COLORS: Record<string, string> = {
  sdr: "bg-blue-500",
  vendedor: "bg-emerald-500",
  gerente_comercial: "bg-purple-500",
  diretoria: "bg-amber-500",
  admin: "bg-rose-500",
  engenharia: "bg-cyan-500",
  orcamentista: "bg-indigo-500",
  administrativo: "bg-slate-500",
  marketing: "bg-pink-500",
};

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function generateStrongPassword(length = 14) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: length - required.length }, () => pick(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
}

type UserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  createdAt: string | null;
  accessStatus: "active" | "inactive";
  mustChangePassword: boolean;
  roles: AppRole[];
};

function UsersAdminPage() {
  const isManager = useIsManager();
  const { loading, roles: callerRoles } = useAuth();
  const isAdminLike = callerRoles.some((r) => r === "admin" || r === "diretoria");
  const ASSIGNABLE = isAdminLike ? ALL_ASSIGNABLE : GERENTE_ASSIGNABLE;

  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAppUsers);
  const updateUser = useServerFn(updateUserFull);
  const removeUser = useServerFn(deleteAppUser);
  const updatePassword = useServerFn(setUserPassword);

  const [search, setSearch] = useState("");

  // Edit modal state
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("sdr");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Password modal state
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; label: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => fetchUsers(),
    enabled: isManager,
  });

  const stats = useMemo(() => {
    const total = users.length;
    const sdrs = users.filter((u) => u.roles.includes("sdr")).length;
    const closers = users.filter((u) => u.roles.includes("vendedor")).length;
    const managers = users.filter((u) =>
      u.roles.some((r) => ["admin", "diretoria", "gerente_comercial"].includes(r)),
    ).length;
    return { total, sdrs, closers, managers };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.fullName || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  if (loading) return null;
  if (!isManager) return <Navigate to="/app" />;

  const openEdit = (u: UserRow) => {
    setEditTarget(u);
    setEditName(u.fullName || "");
    setEditEmail(u.email || "");
    const currentPrimary = u.roles[0];
    // Se o role atual não estiver na lista do gerente, força "sdr" como ponto de partida
    setEditRole(currentPrimary && ASSIGNABLE.includes(currentPrimary) ? currentPrimary : ASSIGNABLE[0]);
    setEditActive(u.accessStatus !== "inactive");
  };

  const onSaveEdit = async () => {
    if (!editTarget) return;
    const name = editName.trim();
    const email = editEmail.trim().toLowerCase();
    if (name.length < 2) { toast.error("Nome inválido."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Email inválido."); return; }
    setSavingEdit(true);
    try {
      await updateUser({
        data: {
          userId: editTarget.id,
          fullName: name,
          email,
          role: editRole,
          accessStatus: editActive ? "active" : "inactive",
        },
      });
      toast.success("Usuário atualizado.");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar usuário.");
    } finally {
      setSavingEdit(false);
    }
  };

  const onDelete = async (userId: string) => {
    try {
      await removeUser({ data: { userId } });
      toast.success("Usuário removido.");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover usuário.");
    }
  };


  const openPasswordModal = (id: string, label: string) => {
    setPasswordTarget({ id, label });
    setNewPassword("");
    setConfirmPassword("");
    setForceChange(true);
    setShowPassword(false);
  };

  const onGeneratePassword = async () => {
    const pwd = generateStrongPassword(14);
    setNewPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
    try {
      await navigator.clipboard.writeText(pwd);
      toast.success("Senha gerada e copiada para a área de transferência.");
    } catch {
      toast.success("Senha gerada — copie manualmente.");
    }
  };

  const onCopyPassword = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      toast.success("Senha copiada.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const onSavePassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) { toast.error("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não conferem."); return; }
    setSavingPassword(true);
    try {
      await updatePassword({
        data: { userId: passwordTarget.id, password: newPassword, forceChange },
      });
      toast.success(
        forceChange
          ? `Nova senha definida para ${passwordTarget.label}. O usuário deverá trocá-la no próximo acesso.`
          : `Nova senha definida para ${passwordTarget.label}.`,
      );
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao definir senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title="Gestão de Usuários"
        subtitle="Cadastre e gerencie o time CN Cold"
        actions={<NewUserWizard />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de usuários" value={stats.total.toString()} icon={<UsersIcon className="h-4 w-4" />} />
        <StatCard label="SDRs" value={stats.sdrs.toString()} icon={<UserCog className="h-4 w-4" />} />
        <StatCard label="Closers / Vendedores" value={stats.closers.toString()} icon={<UserCog className="h-4 w-4" />} />
        <StatCard label="Gestores / Diretoria" value={stats.managers.toString()} icon={<ShieldCheck className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-2 p-3 border-b">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="max-w-sm h-9"
          />
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "usuário" : "usuários"}
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
            ) : filtered.map((u) => {
              const primary = u.roles[0];
              const colorClass = primary ? ROLE_COLORS[primary] || "bg-slate-500" : "bg-slate-400";
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`${colorClass} text-white text-xs font-semibold`}>
                          {initials(u.fullName, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="font-medium">{u.fullName || "—"}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem perfil</span>
                      ) : u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {ROLE_LABELS[r] || r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.accessStatus === "inactive" ? (
                      <Badge variant="destructive" className="text-[10px]">Inativo</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-600">Ativo</Badge>
                    )}
                    {u.mustChangePassword && (
                      <span title="Usuário deve trocar a senha no próximo acesso" className="ml-1 inline-flex items-center">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar usuário"
                        onClick={() => openEdit(u as UserRow)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Definir nova senha (manual)"
                        onClick={() => openPasswordModal(u.id, u.fullName || u.email || u.id)}
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                      {isAdminLike && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Remover usuário">
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {u.fullName || u.email}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O usuário perderá acesso ao sistema imediatamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(u.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal unificado de edição */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize nome, email, perfil principal e status de acesso.
              {!isAdminLike && (
                <span className="block mt-1 text-amber-600">
                  Como Gerente Comercial você só pode atribuir os perfis: SDR, Vendedor e Marketing.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nome completo</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil principal</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Usuário ativo</div>
                <div className="text-xs text-muted-foreground">
                  Inativos não conseguem fazer login no sistema.
                </div>
              </div>
              <Switch checked={editActive} onCheckedChange={setEditActive} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingEdit}>Cancelar</Button>
            </DialogClose>
            <Button onClick={onSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de senha — com gerador e forçar troca */}
      <Dialog
        open={!!passwordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null);
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir nova senha</DialogTitle>
            <DialogDescription>
              Defina manualmente uma nova senha para <strong>{passwordTarget?.label}</strong>.
              Use o botão <em>Gerar senha</em> para criar uma senha forte automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onGeneratePassword}>
                <Sparkles className="h-3.5 w-3.5" /> Gerar senha aleatória
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onCopyPassword} disabled={!newPassword}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={forceChange}
                onCheckedChange={(v) => setForceChange(!!v)}
              />
              <span>
                <span className="font-medium">Forçar troca de senha no próximo acesso</span>
                <span className="block text-muted-foreground">
                  O usuário será redirecionado para a tela de troca de senha logo após o login.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={savingPassword}>Cancelar</Button>
            </DialogClose>
            <Button onClick={onSavePassword} disabled={savingPassword}>
              {savingPassword ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
