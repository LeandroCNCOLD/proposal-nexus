import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/proposal";
import { PERMISSION_MODULES, DEFAULT_ROLE_PACKAGES } from "@/lib/permissions";
import { inviteNewUser } from "@/lib/user-admin.functions";
import { listRoleTemplates } from "@/lib/permissions.functions";

const ALL_ASSIGNABLE_ROLES: AppRole[] = [
  "sdr",
  "vendedor",
  "marketing",
  "gerente_comercial",
  "engenharia",
  "orcamentista",
  "administrativo",
  "diretoria",
  "admin",
];

const GERENTE_ASSIGNABLE_ROLES: AppRole[] = ["sdr", "vendedor", "marketing"];

type Step = 1 | 2 | 3 | 4;

export function NewUserWizard() {
  const { roles: callerRoles } = useAuth();
  const isAdminLike = callerRoles.some((r) => r === "admin" || r === "diretoria");
  const ASSIGNABLE_ROLES: AppRole[] = isAdminLike ? ALL_ASSIGNABLE_ROLES : GERENTE_ASSIGNABLE_ROLES;

  const invite = useServerFn(inviteNewUser);
  const fetchTpls = useServerFn(listRoleTemplates);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Etapa 1 — dados
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Etapa 2 — perfil base
  const [role, setRole] = useState<AppRole>("sdr");

  // Etapa 3 — permissões selecionadas
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const { data: templates } = useQuery({
    queryKey: ["role-templates"],
    queryFn: () => fetchTpls(),
    enabled: open,
  });

  // Ao entrar na etapa 3 (ou trocar role), inicializa com o template salvo ou o pacote padrão.
  useEffect(() => {
    if (step !== 3) return;
    const saved = templates?.[role];
    const base = saved && saved.length > 0 ? saved : DEFAULT_ROLE_PACKAGES[role] ?? [];
    setSelected(new Set(base));
  }, [step, role, templates]);

  const reset = () => {
    setStep(1);
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("sdr");
    setSelected(new Set());
    setFilter("");
  };

  const baselineForRole = useMemo(() => {
    const saved = templates?.[role];
    return new Set(saved && saved.length > 0 ? saved : DEFAULT_ROLE_PACKAGES[role] ?? []);
  }, [templates, role]);

  const overrides = useMemo(() => {
    const grants: string[] = [];
    const revokes: string[] = [];
    for (const k of selected) if (!baselineForRole.has(k)) grants.push(k);
    for (const k of baselineForRole) if (!selected.has(k)) revokes.push(k);
    return { grants, revokes };
  }, [selected, baselineForRole]);

  const togglePerm = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const toggleModule = (modKey: string, on: boolean) => {
    const mod = PERMISSION_MODULES.find((m) => m.key === modKey)!;
    const next = new Set(selected);
    for (const p of mod.permissions) {
      if (on) next.add(p.key); else next.delete(p.key);
    }
    setSelected(next);
  };

  const canAdvance1 = fullName.trim().length > 1 && /.+@.+\..+/.test(email) && (!password || password.length >= 8);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ovs = [
        ...overrides.grants.map((k) => ({ permissionKey: k, effect: "grant" as const })),
        ...overrides.revokes.map((k) => ({ permissionKey: k, effect: "revoke" as const })),
      ];
      await invite({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          password: password || null,
          overrides: ovs,
        },
      });
      toast.success(password ? "Usuário criado com sucesso." : "Convite enviado por e-mail.");
      qc.invalidateQueries({ queryKey: ["app-users"] });
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao cadastrar usuário.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredModules = useMemo(() => {
    if (!filter.trim()) return PERMISSION_MODULES;
    const q = filter.toLowerCase();
    return PERMISSION_MODULES
      .map((m) => ({
        ...m,
        permissions: m.permissions.filter(
          (p) =>
            p.label.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            m.label.toLowerCase().includes(q),
        ),
      }))
      .filter((m) => m.permissions.length > 0);
  }, [filter]);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Cadastrar novo usuário</DialogTitle>
          <DialogDescription>
            Assistente em 4 etapas — defina dados, perfil base e ajuste acessos por módulo antes de salvar.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wiz-name">Nome completo</Label>
              <Input id="wiz-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-email">E-mail</Label>
              <Input id="wiz-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wiz-pass">Senha inicial (opcional)</Label>
              <Input id="wiz-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Em branco = enviar convite por e-mail" minLength={8} maxLength={72} />
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Em branco, o usuário recebe um convite por e-mail.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione o perfil base. As permissões padrão deste perfil serão pré-marcadas na próxima etapa — você pode ajustar tudo livremente.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {ASSIGNABLE_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={
                    "flex items-start gap-3 rounded-lg border p-3 text-left transition " +
                    (role === r ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/40")
                  }
                >
                  <div className={"mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border " + (role === r ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30")}>
                    {role === r && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{ROLE_LABELS[r]}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {(templates?.[r] ?? DEFAULT_ROLE_PACKAGES[r] ?? []).length} permissões padrão
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <strong>{selected.size}</strong> permissões selecionadas · perfil base: <strong>{ROLE_LABELS[role]}</strong>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-8 pl-7" placeholder="Buscar permissão..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-lg border">
              <div className="grid gap-3 p-3 md:grid-cols-2">
                {filteredModules.map((mod) => {
                  const total = mod.permissions.length;
                  const active = mod.permissions.filter((p) => selected.has(p.key)).length;
                  const allOn = active === total;
                  return (
                    <div key={mod.key} className="rounded-md border bg-card/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">{mod.label}</h3>
                          <p className="text-[10px] text-muted-foreground">{active}/{total} ativas</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => toggleModule(mod.key, !allOn)}
                        >
                          {allOn ? "Desmarcar" : "Marcar tudo"}
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {mod.permissions.map((p) => (
                          <li key={p.key} className="flex items-start gap-2">
                            <Checkbox
                              id={`wiz-${p.key}`}
                              checked={selected.has(p.key)}
                              onCheckedChange={() => togglePerm(p.key)}
                            />
                            <label htmlFor={`wiz-${p.key}`} className="text-xs leading-tight cursor-pointer">
                              {p.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><strong>{fullName}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">E-mail</span><strong>{email}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Perfil</span><strong>{ROLE_LABELS[role]}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Acesso</span><strong>{password ? "Senha definida" : "Convite por e-mail"}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total de permissões</span><strong>{selected.size}</strong></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-950/20">
                <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">+ Liberações extras ({overrides.grants.length})</h4>
                {overrides.grants.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhuma — usuário fica com o padrão do perfil.</p>
                ) : (
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto text-[11px]">
                    {overrides.grants.map((k) => <li key={k}>• {k}</li>)}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:bg-rose-950/20">
                <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2">− Bloqueios ({overrides.revokes.length})</h4>
                {overrides.revokes.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhum bloqueio sobre o padrão.</p>
                ) : (
                  <ul className="space-y-0.5 max-h-32 overflow-y-auto text-[11px]">
                    {overrides.revokes.map((k) => <li key={k}>• {k}</li>)}
                  </ul>
                )}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> As liberações/bloqueios serão salvos como overrides individuais e podem ser ajustados depois em <strong>Permissões &gt; Por usuário</strong>.
            </p>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          {step < 4 ? (
            <Button
              type="button"
              disabled={step === 1 ? !canAdvance1 : false}
              onClick={() => setStep((s) => ((s + 1) as Step))}
            >
              Avançar <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Cadastrando..." : "Concluir cadastro"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const items: Array<{ n: Step; label: string }> = [
    { n: 1, label: "Dados" },
    { n: 2, label: "Perfil base" },
    { n: 3, label: "Acessos por módulo" },
    { n: 4, label: "Revisar" },
  ];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {items.map((it, i) => {
        const done = step > it.n;
        const active = step === it.n;
        return (
          <li key={it.n} className="flex items-center gap-2 flex-1">
            <div className={
              "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold shrink-0 " +
              (done ? "border-primary bg-primary text-primary-foreground"
                : active ? "border-primary text-primary"
                  : "border-muted-foreground/30 text-muted-foreground")
            }>
              {done ? <Check className="h-3 w-3" /> : it.n}
            </div>
            <span className={active || done ? "font-medium" : "text-muted-foreground"}>{it.label}</span>
            {i < items.length - 1 && <div className="flex-1 h-px bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
