import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/trocar-senha")({
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);
      toast.success("Senha atualizada com sucesso.");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-[#0F2D5E]">Trocar senha</h1>
          <p className="text-xs text-muted-foreground">
            Defina uma nova senha para continuar. Esta etapa é obrigatória no primeiro acesso ou quando um gestor solicitar a troca.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-pass">Nova senha</Label>
          <Input
            id="new-pass"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            maxLength={72}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pass">Confirmar senha</Label>
          <Input
            id="confirm-pass"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            maxLength={72}
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
