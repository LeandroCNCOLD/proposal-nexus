import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/proposal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/perfil")({
  component: MyProfilePage,
});

function MyProfilePage() {
  const { user, roles } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const qc = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil atualizado.");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    }
  };

  const initial = (fullName || user?.email || "?")[0]?.toUpperCase() ?? "?";

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <PageHeader title="Meu perfil" subtitle="Atualize seus dados e senha." />

      <div className="rounded-lg border bg-card p-6 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">{initial}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-base font-semibold">{fullName || user?.email}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">Sem perfil definido</span>
                  ) : roles.map((r) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">{ROLE_LABELS[r] || r}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Nome completo</Label>
                <Input id="p-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" value={user?.email || ""} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Telefone</Label>
                <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <ChangePasswordDialog />
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar alterações
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (pwd.length < 8) return toast.error("Senha deve ter no mínimo 8 caracteres.");
    if (pwd !== confirm) return toast.error("As senhas não coincidem.");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada.");
      setPwd(""); setConfirm(""); setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><KeyRound className="h-4 w-4" /> Alterar minha senha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>Mínimo 8 caracteres.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="np">Nova senha</Label>
            <Input id="np" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np2">Confirmar nova senha</Label>
            <Input id="np2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
