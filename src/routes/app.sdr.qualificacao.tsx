import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Target, Plus, ExternalLink, Lock } from "lucide-react";
import { brl, dateBR } from "@/lib/format";

export const Route = createFileRoute("/app/sdr/qualificacao")({
  component: QualificacaoPage,
});

type Campanha = {
  id: string;
  nome: string;
  descricao: string | null;
  concorrente: string | null;
  fonte: string;
  cor: string;
  icone: string;
  ativo: boolean;
  readonly: boolean;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string;
};

type CampanhaLead = {
  id: string; lead_code: string; client_name: string; razao_social: string | null;
  contact_name: string | null; city: string | null; state: string | null;
  value: number | null; sdr_status: string | null; temperature: string | null;
  sdr_name: string | null; campanha_id: string | null;
};

const FONTES = ["cnsync", "feira", "site", "indicacao", "outbound", "concorrente", "outro"] as const;

function QualificacaoPage() {
  const { user, hasAnyRole, hasRole } = useAuth();
  const canManage = hasAnyRole(["admin", "gerente_comercial", "diretoria"]);
  const isSdr = hasRole("sdr");
  const allowed = canManage || isSdr;
  const qc = useQueryClient();
  const [filterCampanha, setFilterCampanha] = useState<string>("all");
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: campanhas = [], isLoading: loadingCamp } = useQuery({
    queryKey: ["crm-campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campanhas" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Campanha[];
    },
    enabled: allowed,
  });

  const { data: leads = [], isLoading: loadingLeads } = useQuery({
    queryKey: ["sdr-leads-campanha", filterCampanha],
    queryFn: async () => {
      let q = supabase
        .from("sdr_leads")
        .select("id, lead_code, client_name, razao_social, contact_name, city, state, value, sdr_status, temperature, sdr_name, campanha_id")
        .eq("lead_tipo" as never, "campanha" as never)
        .order("created_at" as never, { ascending: false })
        .limit(500);
      if (filterCampanha !== "all") q = q.eq("campanha_id" as never, filterCampanha as never);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CampanhaLead[];
    },
    enabled: allowed,
  });

  const ativasParaFiltro = useMemo(
    () => campanhas.filter((c) => c.ativo),
    [campanhas],
  );

  if (!user) return <div className="p-6">Faça login para acessar.</div>;
  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">Apenas SDRs e gestores podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
            <Target className="h-6 w-6" /> Qualificação por Campanha
          </h1>
          <p className="text-sm text-muted-foreground">
            Leads originados de campanhas ativas (concorrentes, feiras, outbound, indicação).
            {" "}Histórico CNSync e leads já no Nomus não aparecem aqui.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setNovoOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        )}
      </div>

      {/* Campanhas */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Campanhas ({campanhas.length})
        </h2>
        {loadingCamp ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : campanhas.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">
            Nenhuma campanha cadastrada. {canManage && "Crie a primeira pelo botão acima."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campanhas.map((c) => {
              const total = leads.filter((l) => l.campanha_id === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilterCampanha(c.id)}
                  className={`text-left rounded-xl border bg-card p-3 hover:border-primary transition ${
                    filterCampanha === c.id ? "border-primary ring-2 ring-primary/20" : ""
                  }`}
                  style={{ borderLeft: `4px solid ${c.cor}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg">{c.icone}</span>
                      <span className="font-semibold text-sm truncate">{c.nome}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.readonly && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {!c.ativo && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                    </div>
                  </div>
                  {c.concorrente && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      vs. <strong>{c.concorrente}</strong>
                    </div>
                  )}
                  {c.descricao && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.descricao}</div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-[11px]">
                    <span className="text-muted-foreground">{c.fonte}</span>
                    <span className="font-mono font-semibold">{total} lead{total !== 1 ? "s" : ""}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filtro + Leads */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Leads de campanha {filterCampanha !== "all" && `· ${campanhas.find((c) => c.id === filterCampanha)?.nome ?? ""}`}
          </h2>
          <Select value={filterCampanha} onValueChange={setFilterCampanha}>
            <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {ativasParaFiltro.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadingLeads ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando leads…</div>
        ) : leads.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            Nenhum lead nesta campanha ainda. Leads importados como <code>lead_tipo='campanha'</code> aparecem aqui.
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <Link
                key={l.id}
                to="/app/sdr/leads/$id"
                params={{ id: l.id }}
                className="block rounded-md border bg-card p-3 hover:border-primary transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{l.lead_code}</Badge>
                      <span className="font-semibold text-sm truncate">{l.client_name}</span>
                      {l.temperature && <Badge className="text-[10px]" variant="secondary">{l.temperature}</Badge>}
                      {l.sdr_status && <Badge className="text-[10px]" variant="outline">{l.sdr_status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      {l.contact_name && <span>{l.contact_name}</span>}
                      {(l.city || l.state) && <span>· {[l.city, l.state].filter(Boolean).join("/")}</span>}
                      <span>· {brl(Number(l.value ?? 0))}</span>
                      {l.sdr_name && <span>· SDR: {l.sdr_name}</span>}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <NovaCampanhaDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["crm-campanhas"] })}
      />
    </div>
  );
}

function NovaCampanhaDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [concorrente, setConcorrente] = useState("");
  const [fonte, setFonte] = useState<string>("concorrente");
  const [cor, setCor] = useState("#0F2D5E");
  const [icone, setIcone] = useState("🎯");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (nome.trim().length < 2) return toast.error("Informe o nome da campanha.");
    setSaving(true);
    const { error } = await supabase.from("crm_campanhas" as never).insert({
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      concorrente: concorrente.trim() || null,
      fonte,
      cor,
      icone,
      ativo,
      readonly: false,
      data_inicio: new Date().toISOString().slice(0, 10),
    } as never);
    setSaving(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Campanha criada");
    onCreated();
    onOpenChange(false);
    setNome(""); setDescricao(""); setConcorrente("");
    setFonte("concorrente"); setCor("#0F2D5E"); setIcone("🎯"); setAtivo(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha de leads</DialogTitle>
          <DialogDescription>
            Use para agrupar leads de uma fonte específica (concorrente, feira, indicação, etc.).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Conela 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fonte</Label>
              <Select value={fonte} onValueChange={setFonte}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Concorrente (opcional)</Label>
              <Input value={concorrente} onChange={(e) => setConcorrente(e.target.value)} placeholder="Conela, etc." />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
              placeholder="Contexto, objetivo, lista de origem…" />
          </div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <Label>Cor</Label>
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value)}
                className="h-9 w-full rounded border" />
            </div>
            <div className="space-y-1">
              <Label>Ícone</Label>
              <Input value={icone} onChange={(e) => setIcone(e.target.value)} maxLength={2} />
            </div>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={ativo} onCheckedChange={setAtivo} id="ativa" />
              <Label htmlFor="ativa" className="cursor-pointer">Ativa</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar campanha"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// silence unused imports in some builds
void dateBR;
