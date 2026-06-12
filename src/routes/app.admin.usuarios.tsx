import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Trash2, Users as UsersIcon, ShieldCheck, UserCog, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogTitle, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NewUserWizard } from "@/components/admin/NewUserWizard";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useIsManager } from "@/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/proposal";
import { listAppUsers, setUserPrimaryRole, deleteAppUser, setUserPassword, setUserEmail } from "@/lib/user-admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/admin/usuarios")({
  component: UsersAdminPage,
});

const ASSIGNABLE: AppRole[] = [
  "sdr", "vendedor", "gerente_comercial", "engenharia",
  "orcamentista", "administrativo", "diretoria", "admin",
];

const ROLE_COLORS: Record<string, string> = {
  sdr: "bg-blue-500",
  vendedor: "bg-emerald-500",
  gerente_comercial: "bg-purple-500",
  diretoria: "bg-amber-500",
  admin: "bg-rose-500",
  engenharia: "bg-cyan-500",
  orcamentista: "bg-indigo-500",
  administrativo: "bg-slate-500",
};

function initials(name?: string | null, email?: string | null) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function UsersAdminPage() {
  const isManager = useIsManager();
  const { loading } = useAuth();
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAppUsers);
  const updateRole = useServerFn(setUserPrimaryRole);
  const removeUser = useServerFn(deleteAppUser);
  const updatePassword = useServerFn(setUserPassword);
  const updateEmail = useServerFn(setUserEmail);

  const [search, setSearch] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; label: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [emailTarget, setEmailTarget] = useState<{ id: string; label: string; current: string | null } | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

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

  const onChangeRole = async (userId: string, role: AppRole) => {
    try {
      await updateRole({ data: { userId, role } });
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar perfil.");
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

  const onResetPassword = async (email: string | null) => {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Email de redefinição enviado para ${email}.`);
  };

  const onSavePassword = async () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSavingPassword(true);
    try {
      await updatePassword({ data: { userId: passwordTarget.id, password: newPassword } });
      toast.success(`Nova senha definida para ${passwordTarget.label}.`);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao definir senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  const onSaveEmail = async () => {
    if (!emailTarget) return;
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email inválido.");
      return;
    }
    setSavingEmail(true);
    try {
      await updateEmail({ data: { userId: emailTarget.id, email } });
      toast.success(`Email atualizado para ${email}.`);
      setEmailTarget(null);
      setNewEmail("");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar email.");
    } finally {
      setSavingEmail(false);
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
              <TableHead>Perfil principal</TableHead>
              <TableHead>Perfis</TableHead>
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
                    <Select value={primary || ""} onValueChange={(v) => onChangeRole(u.id, v as AppRole)}>
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue placeholder="Definir perfil..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
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
                  <TableCell className="text-xs text-muted-foreground">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Definir nova senha (manual)"
                        onClick={() => {
                          setPasswordTarget({ id: u.id, label: u.fullName || u.email || u.id });
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Enviar email de redefinição de senha"
                        onClick={() => onResetPassword(u.email)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
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
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

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
              Defina manualmente uma nova senha para{" "}
              <strong>{passwordTarget?.label}</strong>. O usuário poderá entrar imediatamente
              com a nova senha. Comunique-a por um canal seguro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
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
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
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
