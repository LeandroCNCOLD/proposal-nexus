import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSdrNames } from "@/modules/sdr/hooks/use-team-members";
import { lockLead, unlockLead, freezeLead, countMyLocks, MANAGER_FREEZE_PREFIX } from "@/modules/sdr/services";
import { SDR_LOCK_LIMIT } from "@/modules/sdr/types";
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
import {
  Target, Plus, Lock, Unlock, ShieldAlert, ArrowUp, ArrowDown, ArrowUpDown,
  Phone, Mail, Building2, Pencil, MessageCircle, ExternalLink, Save, X,
} from "lucide-react";

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

type CampLead = {
  id: string;
  lead_code: string;
  client_name: string;
  razao_social: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  contact_email: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  value: number | null;
  sdr_status: string | null;
  temperature: string | null;
  sdr_name: string | null;
  closer_name: string | null;
  campanha_id: string | null;
  competitor_status: string | null;
  locked_by_sdr_id: string | null;
  locked_by_sdr_name: string | null;
  last_contact_at: string | null;
  created_at: string;
  internal_note: string | null;
};

// Parse segment + proposals count + proposals total from internal_note (markdown enriched by Conela import)
function parseLeadMeta(note: string | null | undefined) {
  if (!note) return { segmento: null as string | null, propostasCount: 0, propostasTotal: 0 };
  const segM = note.match(/\*\*Segmento:\*\*\s*(.+)/i);
  const segmento = segM ? segM[1].trim() : null;
  const proposalHeaders = note.match(/^#####\s+\d+\./gm) ?? [];
  let propostasTotal = 0;
  const valRegex = /-\s*\*\*Valor:\*\*\s*R\$\s*([\d.,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = valRegex.exec(note)) !== null) {
    const raw = m[1].replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw);
    if (!isNaN(n)) propostasTotal += n;
  }
  return { segmento, propostasCount: proposalHeaders.length, propostasTotal };
}

type SortKey = "client_name" | "state" | "value" | "temperature" | "status" | "last_contact_at";
type SortDir = "asc" | "desc" | null;

const FONTES = ["cnsync", "feira", "site", "indicacao", "outbound", "concorrente", "outro"] as const;
const TEMPS = ["Frio", "Morno", "Quente", "Muito Quente"];
const TEMP_COLORS: Record<string, string> = {
  Frio: "bg-blue-100 text-blue-800",
  Morno: "bg-yellow-100 text-yellow-800",
  Quente: "bg-orange-100 text-orange-800",
  "Muito Quente": "bg-red-100 text-red-800",
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

function SortableTh({
  label, sk, sortKey, sortDir, onClick, align, className,
}: {
  label: string; sk: SortKey; sortKey: SortKey | null; sortDir: SortDir;
  onClick: (k: SortKey) => void; align?: "right" | "center"; className?: string;
}) {
  const active = sortKey === sk;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-3 py-2 cursor-pointer select-none whitespace-nowrap ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className ?? ""}`}
      onClick={() => onClick(sk)}
    >
      <span className="inline-flex items-center gap-1">
        {label} <Icon className="w-3 h-3 opacity-60" />
      </span>
    </th>
  );
}

function QualificacaoPage() {
  const { user, hasAnyRole, hasRole } = useAuth();
  const canManage = hasAnyRole(["admin", "gerente_comercial", "diretoria"]);
  const isSdr = hasRole("sdr");
  const allowed = canManage || isSdr;
  const qc = useQueryClient();
  const { names: sdrNames } = useSdrNames();

  const [filterCampanha, setFilterCampanha] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [uf, setUf] = useState("");
  const [minValue, setMinValue] = useState("");
  const [temp, setTemp] = useState("");
  const [sdrFilter, setSdrFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "mine" | "others" | "frozen">("all");
  const [competitorFilter, setCompetitorFilter] = useState<"all" | "cliente_ativo" | "nunca_fechou">("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [editLead, setEditLead] = useState<CampLead | null>(null);

  const sdrName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SDR";

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
    queryKey: ["sdr-leads-campanha"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sdr_leads")
        .select(
          "id, lead_code, client_name, razao_social, contact_name, contact_phone, contact_mobile, contact_email, cnpj, city, state, value, sdr_status, temperature, sdr_name, closer_name, campanha_id, competitor_status, locked_by_sdr_id, locked_by_sdr_name, last_contact_at, created_at, internal_note",
        )
        .eq("lead_tipo" as never, "campanha" as never)
        .order("value", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as CampLead[];
    },
    enabled: allowed,
    refetchInterval: 30_000,
  });

  const { data: myLockCount = 0 } = useQuery({
    queryKey: ["my-lock-count", user?.id],
    queryFn: () => (user ? countMyLocks(user.id) : Promise.resolve(0)),
    enabled: !!user,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["sdr-leads-campanha"] });
    qc.invalidateQueries({ queryKey: ["my-lock-count"] });
    qc.invalidateQueries({ queryKey: ["my-wallet"] });
    qc.invalidateQueries({ queryKey: ["proposal-bank"] });
  };

  const lockMut = useMutation({
    mutationFn: (id: string) => lockLead(id, user!.id, sdrName),
    onSuccess: () => { toast.success("Lead na sua carteira."); invalidateAll(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível pegar."),
  });
  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockLead(id),
    onSuccess: () => { toast.success("Devolvido ao banco."); invalidateAll(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao devolver."),
  });
  const freezeMut = useMutation({
    mutationFn: (id: string) => freezeLead(id, user!.id, sdrName),
    onSuccess: () => { toast.success("Bloqueado pelo gestor."); invalidateAll(); },
    onError: () => toast.error("Falha ao bloquear."),
  });

  const toggleSort = (k: SortKey) => {
    if (sortKey !== k) { setSortKey(k); setSortDir("asc"); return; }
    if (sortDir === "asc") { setSortDir("desc"); return; }
    setSortKey(null); setSortDir(null);
  };

  const filtered = useMemo(() => {
    const tempOrder: Record<string, number> = { Frio: 0, Morno: 1, Quente: 2, "Muito Quente": 3 };
    let out = leads.filter((l) => {
      if (filterCampanha !== "all" && l.campanha_id !== filterCampanha) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !l.client_name?.toLowerCase().includes(s) &&
          !l.lead_code?.toLowerCase().includes(s) &&
          !l.contact_name?.toLowerCase().includes(s)
        ) return false;
      }
      if (uf && (l.state ?? "") !== uf.toUpperCase()) return false;
      if (minValue && Number(l.value ?? 0) < Number(minValue)) return false;
      if (temp && l.temperature !== temp) return false;
      if (sdrFilter) {
        const lockName = l.locked_by_sdr_name?.replace(MANAGER_FREEZE_PREFIX, "").replace(/^\s*\(|\)\s*$/g, "") ?? "";
        if (l.sdr_name !== sdrFilter && lockName !== sdrFilter) return false;
      }
      if (competitorFilter !== "all" && l.competitor_status !== competitorFilter) return false;
      const frozen = !!l.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX);
      if (statusFilter === "frozen" && !frozen) return false;
      if (statusFilter === "available" && (l.locked_by_sdr_id || frozen)) return false;
      if (statusFilter === "mine" && l.locked_by_sdr_id !== user?.id) return false;
      if (statusFilter === "others" && (!l.locked_by_sdr_id || l.locked_by_sdr_id === user?.id || frozen)) return false;
      return true;
    });
    if (sortKey && sortDir) {
      const statusVal = (l: CampLead) => {
        const frozen = !!l.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX);
        if (frozen) return 3;
        if (l.locked_by_sdr_id === user?.id) return 1;
        if (l.locked_by_sdr_id) return 2;
        return 0;
      };
      const getVal = (l: CampLead): string | number => {
        switch (sortKey) {
          case "client_name": return (l.client_name ?? "").toLowerCase();
          case "state": return l.state ?? "";
          case "value": return Number(l.value ?? 0);
          case "temperature": return tempOrder[l.temperature ?? ""] ?? -1;
          case "status": return statusVal(l);
          case "last_contact_at": return new Date(l.last_contact_at ?? 0).getTime();
        }
      };
      out = [...out].sort((a, b) => {
        const va = getVal(a), vb = getVal(b);
        if (va < vb) return sortDir === "asc" ? -1 : 1;
        if (va > vb) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return out;
  }, [leads, filterCampanha, search, uf, minValue, temp, sdrFilter, statusFilter, competitorFilter, sortKey, sortDir, user?.id]);

  const summary = useMemo(() => {
    let total = filtered.length;
    let mine = 0, others = 0, available = 0, frozen = 0, pipeline = 0;
    for (const l of filtered) {
      const isFrozen = !!l.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX);
      if (isFrozen) frozen++;
      else if (l.locked_by_sdr_id === user?.id) mine++;
      else if (l.locked_by_sdr_id) others++;
      else available++;
      pipeline += Number(l.value ?? 0);
    }
    return { total, mine, others, available, frozen, pipeline };
  }, [filtered, user?.id]);

  if (!user) return <div className="p-6">Faça login para acessar.</div>;
  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">Apenas SDRs e gestores podem acessar esta área.</p>
      </div>
    );
  }

  const lockRemaining = SDR_LOCK_LIMIT - myLockCount;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
            <Target className="h-6 w-6" /> Qualificação por Campanha
          </h1>
          <p className="text-sm text-muted-foreground">
            Banco de leads de campanhas (concorrentes, feiras, outbound, indicação). Histórico CNSync e leads já no Nomus não aparecem aqui.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Carteira: {myLockCount}/{SDR_LOCK_LIMIT}
          </Badge>
          {canManage && (
            <Button onClick={() => setNovoOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" /> Nova campanha
            </Button>
          )}
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setFilterCampanha("all")}
              className={`text-left rounded-xl border bg-card p-3 hover:border-primary transition ${
                filterCampanha === "all" ? "border-primary ring-2 ring-primary/20" : ""
              }`}
            >
              <div className="font-semibold text-sm">Todas as campanhas</div>
              <div className="text-[11px] text-muted-foreground mt-1">{leads.length} leads</div>
            </button>
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

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Total</div><div className="font-bold">{summary.total}</div></div>
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Disponíveis</div><div className="font-bold text-green-700">{summary.available}</div></div>
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Minha carteira</div><div className="font-bold text-blue-700">{summary.mine}</div></div>
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Outros SDRs</div><div className="font-bold text-orange-700">{summary.others}</div></div>
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Bloqueados</div><div className="font-bold text-red-700">{summary.frozen}</div></div>
        <div className="rounded-md border bg-card p-2"><div className="text-xs text-muted-foreground">Pipeline</div><div className="font-bold">{fmtBRL(summary.pipeline)}</div></div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center bg-muted/30 p-3 rounded-md">
        <Input placeholder="Buscar cliente, código ou contato" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
        <Input placeholder="UF" value={uf} onChange={(e) => setUf(e.target.value)} className="w-20" maxLength={2} />
        <Input placeholder="Valor mín." type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} className="w-32" />
        <Select value={temp || "__all__"} onValueChange={(v) => setTemp(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Temperatura" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas temperaturas</SelectItem>
            {TEMPS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sdrFilter || "__all__"} onValueChange={(v) => setSdrFilter(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="SDR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos SDRs</SelectItem>
            {sdrNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Carteira" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda carteira</SelectItem>
            <SelectItem value="available">Disponíveis</SelectItem>
            <SelectItem value="mine">Minha carteira</SelectItem>
            <SelectItem value="others">De outros SDRs</SelectItem>
            <SelectItem value="frozen">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={competitorFilter} onValueChange={(v) => setCompetitorFilter(v as typeof competitorFilter)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Concorrente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="cliente_ativo">Já cliente concorrente</SelectItem>
            <SelectItem value="nunca_fechou">Prospect (nunca fechou)</SelectItem>
          </SelectContent>
        </Select>
        {(search || uf || minValue || temp || sdrFilter || statusFilter !== "all" || competitorFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setUf(""); setMinValue(""); setTemp(""); setSdrFilter("");
            setStatusFilter("all"); setCompetitorFilter("all");
          }}>Limpar filtros</Button>
        )}
      </div>

      {/* Tabela */}
      {loadingLeads ? (
        <div className="text-center py-12 text-muted-foreground">Carregando leads…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado com os filtros atuais.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-muted/40 border-b">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <SortableTh label="Cliente" sk="client_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="px-2 py-2" />
                  <th className="px-2 py-2 text-left font-medium">Contato</th>
                  <SortableTh label="UF" sk="state" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="px-2 py-2" />
                  <th className="px-2 py-2 text-center font-medium">Prop.</th>
                  <SortableTh label="Cotado" sk="value" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" className="px-2 py-2" />
                  <SortableTh label="Temp." sk="temperature" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="px-2 py-2" />
                  <SortableTh label="Carteira" sk="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="px-2 py-2" />
                  <th className="px-2 py-2 text-right font-medium sticky right-0 bg-muted/40 shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.1)]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const frozen = !!l.locked_by_sdr_name?.startsWith(MANAGER_FREEZE_PREFIX);
                  const mine = l.locked_by_sdr_id === user.id;
                  const otherSdr = !!l.locked_by_sdr_id && !mine && !frozen;
                  const available = !l.locked_by_sdr_id && !frozen;
                  const lockName = l.locked_by_sdr_name?.replace(MANAGER_FREEZE_PREFIX, "").replace(/^\s*\(|\)\s*$/g, "") ?? "";
                  const canPick = available && lockRemaining > 0;
                  const meta = parseLeadMeta(l.internal_note);
                  const total = meta.propostasTotal > 0 ? meta.propostasTotal : Number(l.value ?? 0);
                  const hasWhats = !!(l.contact_mobile || l.contact_phone);
                  const rowBg = mine ? "bg-primary/5" : frozen ? "bg-destructive/5" : "bg-card";
                  return (
                    <tr
                      key={l.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${mine ? "bg-primary/5" : frozen ? "bg-destructive/5" : ""}`}
                    >
                      {/* Cliente */}
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-start gap-2 min-w-0 max-w-[280px]">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link
                                to="/app/sdr/leads/$id"
                                params={{ id: l.id }}
                                className="font-semibold text-foreground hover:text-primary truncate text-[13px] leading-tight"
                                title={l.client_name}
                              >
                                {l.client_name}
                              </Link>
                              {l.competitor_status === "cliente_ativo" && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">Conc.</Badge>
                              )}
                              {l.competitor_status === "nunca_fechou" && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1">Prospect</Badge>
                              )}
                            </div>
                            {l.cnpj && (
                              <div className="text-[10px] text-muted-foreground font-mono truncate">{l.cnpj}</div>
                            )}
                            {meta.segmento && (
                              <div className="text-[10px] text-muted-foreground truncate" title={meta.segmento}>{meta.segmento}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contato */}
                      <td className="px-2 py-2 align-top max-w-[240px]">
                        <div className="space-y-0.5 min-w-0">
                          {l.contact_name && (
                            <div className="text-[12px] text-foreground truncate" title={l.contact_name}>{l.contact_name}</div>
                          )}
                          {l.contact_phone && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <a href={`tel:${l.contact_phone}`} className="text-foreground hover:text-primary truncate">{l.contact_phone}</a>
                              {hasWhats && (
                                <a
                                  href={`https://wa.me/55${(l.contact_mobile || l.contact_phone || "").replace(/\D/g, "")}`}
                                  target="_blank" rel="noreferrer" title="WhatsApp"
                                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-green-500/15 text-green-600 hover:bg-green-500/25"
                                >
                                  <MessageCircle className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          )}
                          {l.contact_email && (
                            <a href={`mailto:${l.contact_email}`}
                              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary truncate"
                              title={l.contact_email}>
                              <Mail className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{l.contact_email}</span>
                            </a>
                          )}
                          {!l.contact_name && !l.contact_phone && !l.contact_email && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* UF / Cidade */}
                      <td className="px-2 py-2 align-top whitespace-nowrap text-[11px] text-muted-foreground">
                        <div className="font-semibold text-foreground">{l.state || "—"}</div>
                        {l.city && <div className="truncate max-w-[110px]" title={l.city}>{l.city}</div>}
                      </td>

                      {/* Propostas */}
                      <td className="px-2 py-2 align-top text-center font-semibold tabular-nums text-[13px]">
                        {meta.propostasCount || 0}
                      </td>

                      {/* Total Cotado */}
                      <td className="px-2 py-2 align-top text-right font-mono font-semibold tabular-nums text-[12px] whitespace-nowrap">
                        {total > 0 ? fmtBRL(total) : <span className="text-muted-foreground font-normal">—</span>}
                      </td>

                      {/* Temperatura */}
                      <td className="px-2 py-2 align-top">
                        {l.temperature ? (
                          <Badge className={`text-[10px] ${TEMP_COLORS[l.temperature] ?? ""}`}>{l.temperature}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Carteira */}
                      <td className="px-2 py-2 align-top">
                        {frozen ? (
                          <Badge variant="destructive" className="text-[10px]"><ShieldAlert className="h-3 w-3 mr-1" />Bloq.</Badge>
                        ) : mine ? (
                          <Badge className="text-[10px] bg-primary/15 text-primary hover:bg-primary/15">Minha</Badge>
                        ) : otherSdr ? (
                          <Badge variant="secondary" className="text-[10px] max-w-[80px] truncate" title={lockName}>{lockName || "outro"}</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">Livre</Badge>
                        )}
                      </td>

                      {/* Ações — sticky */}
                      <td className={`px-2 py-2 align-top text-right sticky right-0 ${rowBg} shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.15)]`}>
                        <div className="inline-flex gap-1 items-center">
                          {available && (
                            <Button size="sm" variant="default" disabled={!canPick || lockMut.isPending}
                              onClick={() => lockMut.mutate(l.id)} className="h-7 px-2 text-[11px]">
                              <Lock className="h-3 w-3 mr-1" />Pegar
                            </Button>
                          )}
                          {mine && (
                            <Button size="sm" variant="outline" disabled={unlockMut.isPending}
                              onClick={() => unlockMut.mutate(l.id)} className="h-7 px-2 text-[11px]">
                              <Unlock className="h-3 w-3 mr-1" />Devolver
                            </Button>
                          )}
                          {frozen && canManage && (
                            <Button size="sm" variant="outline" disabled={unlockMut.isPending}
                              onClick={() => unlockMut.mutate(l.id)} className="h-7 px-2 text-[11px]" title="Liberar">
                              <Unlock className="h-3 w-3" />
                            </Button>
                          )}
                          {!frozen && canManage && !mine && (
                            <Button size="sm" variant="ghost" disabled={freezeMut.isPending}
                              onClick={() => freezeMut.mutate(l.id)} className="h-7 w-7 p-0" title="Bloquear">
                              <ShieldAlert className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditLead(l)} className="h-7 w-7 p-0" title="Editar lead">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Link to="/app/sdr/leads/$id" params={{ id: l.id }} title="Abrir lead completo"
                            className="grid h-7 w-7 place-items-center rounded-md hover:bg-muted">
                            <ExternalLink className="h-3 w-3 opacity-70" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>{filtered.length} lead{filtered.length !== 1 ? "s" : ""} exibido{filtered.length !== 1 ? "s" : ""}</span>
            <span>Pipeline total: <strong className="text-foreground font-mono">{fmtBRL(summary.pipeline)}</strong></span>
          </div>
        </div>
      )}

      <NovaCampanhaDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["crm-campanhas"] })}
      />

      <EditLeadDialog
        lead={editLead}
        onOpenChange={(open) => !open && setEditLead(null)}
        onSaved={invalidateAll}
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
      fonte, cor, icone, ativo, readonly: false,
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

// =========================================================
// EditLeadDialog — quick rich edit modal matching reference
// =========================================================
function EditLeadDialog({
  lead, onOpenChange, onSaved,
}: {
  lead: CampLead | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const open = !!lead;
  const [form, setForm] = useState<Partial<CampLead>>({});
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");

  // Reset form when lead changes
  useMemo(() => {
    if (lead) {
      setForm({
        client_name: lead.client_name,
        razao_social: lead.razao_social,
        cnpj: lead.cnpj,
        contact_name: lead.contact_name,
        contact_phone: lead.contact_phone,
        contact_mobile: lead.contact_mobile,
        contact_email: lead.contact_email,
        city: lead.city,
        state: lead.state,
        temperature: lead.temperature,
      });
      setNotes("");
    }
  }, [lead?.id]);

  const meta = parseLeadMeta(lead?.internal_note);

  const save = async () => {
    if (!lead) return;
    setSaving(true);
    // Append new notes to internal_note above the auto-imported section
    const baseNote = lead.internal_note ?? "";
    const finalNote = notes.trim()
      ? `**Nota SDR (${new Date().toLocaleDateString("pt-BR")}):** ${notes.trim()}\n\n${baseNote}`
      : baseNote;
    const { error } = await supabase
      .from("sdr_leads")
      .update({
        client_name: form.client_name ?? lead.client_name,
        razao_social: form.razao_social ?? null,
        cnpj: form.cnpj ?? null,
        contact_name: form.contact_name ?? null,
        contact_phone: form.contact_phone ?? null,
        contact_mobile: form.contact_mobile ?? null,
        contact_email: form.contact_email ?? null,
        city: form.city ?? null,
        state: (form.state ?? null) as never,
        temperature: form.temperature ?? null,
        internal_note: finalNote,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", lead.id);
    setSaving(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Lead atualizado");
    onSaved();
    onOpenChange(false);
  };

  if (!lead) return null;

  // Extract proposals as cards from internal_note
  const propostaBlocks: { titulo: string; data: string; valor: string; resumo: string }[] = [];
  if (lead.internal_note) {
    const parts = lead.internal_note.split(/^#####\s+\d+\.\s*/m).slice(1);
    for (const part of parts) {
      const firstLine = part.split("\n")[0]?.trim() ?? "";
      const dataM = part.match(/\*\*Data:\*\*\s*(.+)/);
      const valorM = part.match(/\*\*Valor:\*\*\s*(R\$\s*[\d.,]+)/);
      const pagM = part.match(/\*\*Pagamento:\*\*\s*(.+)/);
      propostaBlocks.push({
        titulo: firstLine,
        data: dataM?.[1].trim() ?? "—",
        valor: valorM?.[1].trim() ?? "—",
        resumo: pagM?.[1].trim() ?? "",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg truncate">{lead.client_name}</DialogTitle>
              <DialogDescription className="text-xs">
                {meta.propostasCount} proposta{meta.propostasCount !== 1 ? "s" : ""}
                {meta.propostasTotal > 0 && ` · ${fmtBRL(meta.propostasTotal)} cotado`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contato rápido */}
        {(form.contact_phone || form.contact_mobile) && (
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Contato rápido</Label>
            <div className="flex flex-wrap gap-2">
              {form.contact_phone && (
                <a href={`tel:${form.contact_phone}`}
                  className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm hover:border-primary">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />{form.contact_phone}
                </a>
              )}
              {(form.contact_mobile || form.contact_phone) && (
                <a
                  href={`https://wa.me/55${(form.contact_mobile || form.contact_phone || "").replace(/\D/g, "")}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400 px-3 py-1.5 text-sm hover:bg-green-500/15">
                  <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                </a>
              )}
            </div>
          </div>
        )}

        {/* Form em grid 2 colunas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome / Fantasia" value={form.client_name ?? ""} onChange={(v) => setForm({ ...form, client_name: v })} />
          <Field label="Razão Social" value={form.razao_social ?? ""} onChange={(v) => setForm({ ...form, razao_social: v })} />
          <Field label="CNPJ" value={form.cnpj ?? ""} onChange={(v) => setForm({ ...form, cnpj: v })} mono />
          <Field label="Segmento" value={meta.segmento ?? ""} readOnly placeholder="—" />
          <Field label="Contato (Nome)" value={form.contact_name ?? ""} onChange={(v) => setForm({ ...form, contact_name: v })} />
          <Field label="Cargo" value="" placeholder="Gestor do projeto" onChange={() => {}} />
          <Field label="Telefone" value={form.contact_phone ?? ""} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          <Field label="WhatsApp" value={form.contact_mobile ?? ""} onChange={(v) => setForm({ ...form, contact_mobile: v })} />
          <Field label="E-mail" value={form.contact_email ?? ""} onChange={(v) => setForm({ ...form, contact_email: v })} className="sm:col-span-2" />
          <Field label="Cidade" value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} />
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">UF</Label>
            <Input maxLength={2} value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Temperatura</Label>
            <Select value={form.temperature ?? "__none__"} onValueChange={(v) => setForm({ ...form, temperature: v === "__none__" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não definida</SelectItem>
                {TEMPS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notas de prospecção */}
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Adicionar nota de prospecção</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Será adicionada ao histórico interno…"
          />
        </div>

        {/* Histórico de propostas */}
        {propostaBlocks.length > 0 && (
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Histórico de propostas ({propostaBlocks.length})
            </Label>
            <div className="space-y-2">
              {propostaBlocks.map((p, i) => (
                <div key={i} className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{p.titulo}</div>
                      <div className="text-[11px] text-muted-foreground">{p.data}</div>
                      {p.resumo && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.resumo}</div>
                      )}
                    </div>
                    <div className="font-mono font-semibold text-sm whitespace-nowrap">{p.valor}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />{saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, readOnly, placeholder, mono, className,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className={mono ? "font-mono text-sm" : ""}
      />
    </div>
  );
}
