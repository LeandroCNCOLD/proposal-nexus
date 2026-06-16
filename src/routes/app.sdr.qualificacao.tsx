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
          "id, lead_code, client_name, razao_social, contact_name, contact_phone, contact_email, cnpj, city, state, value, sdr_status, temperature, sdr_name, closer_name, campanha_id, competitor_status, locked_by_sdr_id, locked_by_sdr_name, last_contact_at, created_at, internal_note",
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
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <SortableTh label="Cliente / Contato" sk="client_name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="UF" sk="state" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden lg:table-cell" />
                <SortableTh label="Valor" sk="value" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                <SortableTh label="Temp." sk="temperature" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortableTh label="Últ. contato" sk="last_contact_at" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden xl:table-cell" />
                <SortableTh label="Carteira" sk="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <th className="px-3 py-2 text-right">Ações</th>
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
                const camp = campanhas.find((c) => c.id === l.campanha_id);
                return (
                  <tr key={l.id} className={`border-t hover:bg-muted/30 ${mine ? "bg-blue-50/40" : frozen ? "bg-red-50/40" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="font-mono text-[10px] w-fit">{l.lead_code}</Badge>
                        {camp && (
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <span>{camp.icone}</span>{camp.nome}
                          </span>
                        )}
                        {l.competitor_status === "cliente_ativo" && (
                          <Badge className="text-[9px] bg-purple-100 text-purple-800 w-fit" variant="secondary">já cliente concorrente</Badge>
                        )}
                        {l.competitor_status === "nunca_fechou" && (
                          <Badge className="text-[9px] bg-slate-100 text-slate-700 w-fit" variant="secondary">prospect</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to="/app/sdr/leads/$id" params={{ id: l.id }}
                        className="font-semibold text-[#0F2D5E] hover:underline inline-flex items-center gap-1"
                      >
                        {l.client_name}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                        {l.contact_name && <span>{l.contact_name}</span>}
                        {l.contact_phone && (
                          <a href={`tel:${l.contact_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                            <Phone className="h-3 w-3" />{l.contact_phone}
                          </a>
                        )}
                        {l.contact_email && (
                          <a href={`mailto:${l.contact_email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                            <Mail className="h-3 w-3" />{l.contact_email}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {(l.city || l.state) && (
                        <span className="text-xs inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 opacity-60" />{[l.city, l.state].filter(Boolean).join("/")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtBRL(Number(l.value ?? 0))}</td>
                    <td className="px-3 py-2">
                      {l.temperature && (
                        <Badge className={`text-[10px] ${TEMP_COLORS[l.temperature] ?? ""}`}>{l.temperature}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 hidden xl:table-cell text-xs text-muted-foreground">
                      {fmtDate(l.last_contact_at)}
                    </td>
                    <td className="px-3 py-2">
                      {frozen ? (
                        <Badge className="text-[10px] bg-red-100 text-red-800"><ShieldAlert className="h-3 w-3 mr-1" />Bloqueado</Badge>
                      ) : mine ? (
                        <Badge className="text-[10px] bg-blue-100 text-blue-800">Minha</Badge>
                      ) : otherSdr ? (
                        <Badge className="text-[10px] bg-orange-100 text-orange-800" variant="secondary">{lockName || "outro"}</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-green-100 text-green-800">Disponível</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-1">
                        {available && (
                          <Button size="sm" variant="default" disabled={!canPick || lockMut.isPending}
                            onClick={() => lockMut.mutate(l.id)}>
                            <Lock className="h-3 w-3 mr-1" />Pegar
                          </Button>
                        )}
                        {mine && (
                          <Button size="sm" variant="outline" disabled={unlockMut.isPending}
                            onClick={() => unlockMut.mutate(l.id)}>
                            <Unlock className="h-3 w-3 mr-1" />Devolver
                          </Button>
                        )}
                        {frozen && canManage && (
                          <Button size="sm" variant="outline" disabled={unlockMut.isPending}
                            onClick={() => unlockMut.mutate(l.id)}>
                            <Unlock className="h-3 w-3 mr-1" />Desbloquear
                          </Button>
                        )}
                        {!frozen && canManage && (
                          <Button size="sm" variant="ghost" disabled={freezeMut.isPending}
                            onClick={() => freezeMut.mutate(l.id)}>
                            <ShieldAlert className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
