import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { inviteNewUser } from "@/lib/user-admin.functions";

export const Route = createFileRoute("/app/configuracoes/")({ component: SettingsPage });

const MANAGER_ROLES: AppRole[] = ["admin", "gerente_comercial", "diretoria"];

const ASSIGNABLE_ROLES: AppRole[] = [
  "vendedor",
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
                Cadastre um novo usuário e atribua o nível de acesso de acordo com a função.
              </p>
            </div>
            {canManage && <NewUserDialog />}
          </div>
          {!canManage && (
            <p className="text-xs text-muted-foreground">
              Apenas administradores, diretoria e gerência comercial podem cadastrar novos usuários.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function NewUserDialog() {
  const invite = useServerFn(inviteNewUser);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("vendedor");
  const [password, setPassword] = useState("");

  const reset = () => {
    setFullName("");
    setEmail("");
    setRole("vendedor");
    setPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Nome e e-mail são obrigatórios.");
      return;
    }
    if (password && password.length < 8) {
      toast.error("Senha deve ter ao menos 8 caracteres (ou deixe em branco para enviar convite).");
      return;
    }
    setSubmitting(true);
    try {
      await invite({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          password: password || null,
        },
      });
      toast.success(
        password
          ? "Usuário criado com sucesso."
          : "Convite enviado por e-mail.",
      );
      reset();
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar usuário.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar novo usuário</DialogTitle>
          <DialogDescription>
            Defina o nível de acesso. Deixe a senha em branco para enviar um convite por e-mail.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">Nome completo</Label>
            <Input
              id="new-user-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">E-mail</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">Nível de acesso</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger id="new-user-role">
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-pass">Senha inicial (opcional)</Label>
            <Input
              id="new-user-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Em branco = enviar convite por e-mail"
              minLength={8}
              maxLength={72}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
