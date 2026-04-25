import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { nomusKickoffSyncProposals } from "@/integrations/nomus/server.functions";

import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl, dateBR } from "@/lib/format";
import { ALL_STATUSES, STATUS_LABELS, type ProposalStatus } from "@/lib/proposal";

export const Route = createFileRoute("/app/propostas/")({ component: ProposalsList });

function ProposalsList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const kickoffSync = useServerFn(nomusKickoffSyncProposals);

  // Estado da sincronização — observa nomus_sync_state.propostas.
  // Quando running=true, faz polling para refletir progresso e parar o spinner
  // assim que o cron concluir, sem travar o botão por toda a duração.
  const { data: syncState } = useQuery({
    queryKey: ["nomus-sync-state", "propostas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("nomus_sync_state")
        .select("running, last_synced_at, total_synced, last_error")
        .eq("entity", "propostas")
        .maybeSingle();
      return data;
    },
    refetchInterval: (query) => (query.state.data?.running ? 4000 : false),
  });

  useEffect(() => {
    if (syncState && !syncState.running && syncState.last_synced_at) {
      queryClient.invalidateQueries({ queryKey: ["proposals-list"] });
    }
  }, [syncState?.running, syncState?.last_synced_at, queryClient]);

  const syncMutation = useMutation({
    mutationFn: async () => kickoffSync(),
    onSuccess: () => {
      toast.success("Sincronização iniciada — atualizando em segundo plano.");
      queryClient.invalidateQueries({ queryKey: ["nomus-sync-state", "propostas"] });
    },
    onError: (err: Error) => toast.error(`Erro ao iniciar sincronização: ${err.message}`),
  });

  const isSyncing = syncMutation.isPending || !!syncState?.running;

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, number, title, status, total_value, valid_until, created_at, updated_at, next_followup_at, closed_at, nomus_id, nomus_synced_at, clients(name, document)")
        .order("nomus_synced_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const nomusIds = rows.map((r) => r.nomus_id).filter(Boolean) as string[];
      const nomusMap = new Map<string, { criada_em_nomus: string | null; data_emissao: string | null; synced_at: string | null; representante_nome: string | null; vendedor_nome: string | null; cliente_nomus_id: string | null; numero: string | null }>();
      if (nomusIds.length > 0) {
        const { data: np } = await supabase
          .from("nomus_proposals")
          .select("nomus_id, criada_em_nomus, data_emissao, synced_at, representante_nome, vendedor_nome, cliente_nomus_id, numero")
          .in("nomus_id", nomusIds);
        (np ?? []).forEach((n) => nomusMap.set(n.nomus_id, {
          criada_em_nomus: n.criada_em_nomus,
          data_emissao: n.data_emissao,
          synced_at: n.synced_at,
          representante_nome: n.representante_nome,
          vendedor_nome: n.vendedor_nome,
          cliente_nomus_id: n.cliente_nomus_id,
          numero: n.numero,
        }));
      }
      // Buscar CNPJ de clientes via nomus_id quando não há clients vinculado
      const clienteNomusIds = Array.from(new Set((Array.from(nomusMap.values()).map((v) => v.cliente_nomus_id).filter(Boolean)) as string[]));
      const cnpjMap = new Map<string, string>();
      if (clienteNomusIds.length > 0) {
        const { data: cs } = await supabase
          .from("clients")
          .select("nomus_id, document")
          .in("nomus_id", clienteNomusIds);
        (cs ?? []).forEach((c) => { if (c.nomus_id && c.document) cnpjMap.set(c.nomus_id, c.document); });
      }
      return rows.map((r) => {
        const nm = r.nomus_id ? nomusMap.get(r.nomus_id) ?? null : null;
        const cnpj = (r.clients as any)?.document ?? (nm?.cliente_nomus_id ? cnpjMap.get(nm.cliente_nomus_id) ?? null : null);
        return { ...r, _nomus: nm, _cnpj: cnpj };
      });
    },
  });

  // Formata CNPJ no padrão 00.000.000/0000-00
  const formatCNPJ = (raw: string | null | undefined) => {
    if (!raw) return "—";
    const d = raw.replace(/\D/g, "");
    if (d.length !== 14) return raw;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
  };

  // Extrai "CN#####" e nome do cliente do título no formato "CN00155 — WEG SOLAR"
  const parseTitle = (title: string | null | undefined) => {
    const t = (title ?? "").trim();
    const m = t.match(/^(CN\d{3,})\s*[—\-–]\s*(.+)$/i);
    if (m) return { cn: m[1].toUpperCase(), client: m[2].trim() };
    const m2 = t.match(/(CN\d{3,})/i);
    return { cn: m2 ? m2[1].toUpperCase() : "", client: t };
  };

  // SLA — semáforo baseado em dias desde a última atividade (updated_at) e follow-up vencido.
  // Status fechados (ganha/perdida/cancelada) ficam em estado neutro (sem cobrança).
  type SLAState = {
    level: "ok" | "warn" | "alert" | "critical" | "neutral";
    label: string;
    days: number;
    detail: string;
  };
  const closedStatuses = new Set(["ganha", "perdida", "cancelada"]);
  const computeSLA = (p: any): SLAState => {
    const now = Date.now();
    const lastActivity = new Date(p.updated_at ?? p.created_at).getTime();
    const days = Math.floor((now - lastActivity) / 86_400_000);

    if (closedStatuses.has(p.status)) {
      return { level: "neutral", label: "Encerrada", days, detail: `Última atualização há ${days}d` };
    }

    const next = p.next_followup_at ? new Date(p.next_followup_at).getTime() : null;
    const followupOverdue = next != null && next < now;
    const overdueDays = followupOverdue && next != null ? Math.floor((now - next) / 86_400_000) : 0;

    if (followupOverdue && overdueDays > 3) {
      return { level: "critical", label: `Follow-up ${overdueDays}d atrasado`, days, detail: `Sem atividade há ${days}d` };
    }
    if (days > 14) return { level: "critical", label: `${days}d sem atividade`, days, detail: "SLA estourado" };
    if (days > 7) return { level: "alert", label: `${days}d sem atividade`, days, detail: "Atenção: contatar cliente" };
    if (days > 3 || followupOverdue) {
      return { level: "warn", label: `${days}d sem atividade`, days, detail: followupOverdue ? `Follow-up vencido há ${overdueDays}d` : "Em risco" };
    }
    return { level: "ok", label: `${days}d`, days, detail: "Dentro do SLA" };
  };
  const slaClasses: Record<SLAState["level"], string> = {
    ok: "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20",
    alert: "bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/20",
    critical: "bg-red-500/10 text-red-600 ring-1 ring-red-500/20",
    neutral: "bg-muted text-muted-foreground ring-1 ring-border",
  };
  const slaDot: Record<SLAState["level"], string> = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    alert: "bg-orange-500",
    critical: "bg-red-500 animate-pulse",
    neutral: "bg-muted-foreground/40",
  };


  // Extrai número da revisão a partir do "numero" do Nomus (ex.: "CN00146 Rev. 02" → 2; "CN00146" → 0)
  const parseRevision = (numero: string | null | undefined) => {
    if (!numero) return 0;
    const m = numero.match(/Rev\.?\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  };

  const proposalNomusIdNumber = (p: any) => Number(p.nomus_id ?? p._nomus?.nomus_id ?? 0) || 0;

  const proposalNumberRank = (p: any) => {
    const numero = String(p._nomus?.numero ?? p.title ?? p.number ?? "");
    const cn = numero.match(/CN\s*0*(\d+)/i);
    const rev = numero.match(/Rev\.?\s*0*(\d+)/i);
    return {
      cn: cn ? Number(cn[1]) || 0 : 0,
      rev: rev ? Number(rev[1]) || 0 : 0,
    };
  };

  const proposalSortTime = (p: any) => {
    const raw = p._nomus?.criada_em_nomus ?? p._nomus?.data_emissao ?? p._nomus?.synced_at ?? p.nomus_synced_at ?? p.created_at;
    const ts = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(ts) ? ts : 0;
  };

  const compareNomusNewestFirst = (a: any, b: any) => {
    const ar = proposalNumberRank(a);
    const br = proposalNumberRank(b);
    if (br.cn !== ar.cn) return br.cn - ar.cn;
    if (br.rev !== ar.rev) return br.rev - ar.rev;
    const idDiff = proposalNomusIdNumber(b) - proposalNomusIdNumber(a);
    return idDiff !== 0 ? idDiff : proposalSortTime(b) - proposalSortTime(a);
  };

  const filtered = useMemo(() => {
    // 1) Aplica filtros de status e busca
    const list = proposals.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      const parsed = parseTitle(p.title);
      return (
        p.number.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        parsed.cn.toLowerCase().includes(q) ||
        parsed.client.toLowerCase().includes(q) ||
        ((p.clients as any)?.name ?? "").toLowerCase().includes(q)
      );
    });

    // 2) Agrupa por base CN##### e mantém apenas a revisão mais alta
    const groups = new Map<string, typeof list>();
    list.forEach((p) => {
      const cn = parseTitle(p.title).cn || p.number;
      const arr = groups.get(cn) ?? [];
      arr.push(p);
      groups.set(cn, arr);
    });

    const latest = Array.from(groups.values()).map((arr) => {
      // Ordena por revisão desc, depois por data desc
      const sorted = [...arr].sort((a, b) => {
        const ra = parseRevision((a as any)._nomus?.numero);
        const rb = parseRevision((b as any)._nomus?.numero);
        if (rb !== ra) return rb - ra;
        return compareNomusNewestFirst(a, b);
      });
      const head = sorted[0] as any;
      head._revisions = sorted; // todas as revisões da família
      head._currentRevision = parseRevision(head._nomus?.numero);
      head._totalRevisions = sorted.length;
      return head;
    });

    // 3) Ordena pela data real do Nomus (mais recente primeiro)
    return latest.sort(compareNomusNewestFirst);
  }, [proposals, search, statusFilter]);

  return (
    <>
      <PageHeader
        title="Propostas"
        subtitle={`${filtered.length} de ${proposals.length} propostas`}
        actions={
          <>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={isSyncing}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Sincronizando..." : "Buscar do Nomus"}
            </Button>
            <Button asChild className="bg-[image:var(--gradient-primary)]"><Link to="/app/propostas/nova"><Plus className="mr-1.5 h-4 w-4" /> Nova proposta</Link></Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número, título ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Representante</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Criada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">Nenhuma proposta encontrada.</TableCell></TableRow>
            ) : filtered.map((p) => {
              const parsed = parseTitle(p.title);
              const displayNumber = parsed.cn || p.number;
              const displayClient = (p.clients as any)?.name ?? parsed.client ?? "—";
              const cnpj = formatCNPJ((p as any)._cnpj);
              const representante = (p as any)._nomus?.representante_nome ?? "—";
              const vendedor = (p as any)._nomus?.vendedor_nome ?? "—";
              const currentRev = (p as any)._currentRevision ?? 0;
              const totalRevs = (p as any)._totalRevisions ?? 1;
              const sla = computeSLA(p);
              return (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Link to="/app/propostas/$id" params={{ id: p.id }} className="hover:text-primary">{displayNumber}</Link>
                    {totalRevs > 1 && (
                      <span
                        title={`${totalRevs} revisões — exibindo a mais recente (Rev. ${String(currentRev).padStart(2, "0")})`}
                        className="inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold"
                      >
                        Rev. {String(currentRev).padStart(2, "0")} · {totalRevs}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium max-w-xs truncate">
                  <Link to="/app/propostas/$id" params={{ id: p.id }}>{displayClient}</Link>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground whitespace-nowrap">{cnpj}</TableCell>
                <TableCell className="text-sm">{representante}</TableCell>
                <TableCell className="text-sm">{vendedor}</TableCell>
                <TableCell><StatusBadge status={p.status as ProposalStatus} /></TableCell>
                <TableCell>
                  <span
                    title={`${sla.detail}${p.next_followup_at ? ` · próx. follow-up ${dateBR(p.next_followup_at)}` : ""}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${slaClasses[sla.level]}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${slaDot[sla.level]}`} />
                    {sla.label}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">{brl(Number(p.total_value ?? 0))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateBR(p.valid_until)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateBR((p as any)._nomus?.criada_em_nomus ?? (p as any)._nomus?.data_emissao ?? p.created_at)}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
