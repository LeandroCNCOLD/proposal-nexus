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
        .select("id, number, title, status, total_value, valid_until, created_at, nomus_id, clients(name, document)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const nomusIds = rows.map((r) => r.nomus_id).filter(Boolean) as string[];
      const nomusMap = new Map<string, { criada_em_nomus: string | null; data_emissao: string | null; representante_nome: string | null; vendedor_nome: string | null; cliente_nomus_id: string | null }>();
      if (nomusIds.length > 0) {
        const { data: np } = await supabase
          .from("nomus_proposals")
          .select("nomus_id, criada_em_nomus, data_emissao, representante_nome, vendedor_nome, cliente_nomus_id")
          .in("nomus_id", nomusIds);
        (np ?? []).forEach((n) => nomusMap.set(n.nomus_id, {
          criada_em_nomus: n.criada_em_nomus,
          data_emissao: n.data_emissao,
          representante_nome: n.representante_nome,
          vendedor_nome: n.vendedor_nome,
          cliente_nomus_id: n.cliente_nomus_id,
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

  const filtered = useMemo(() => {
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
    // Ordena pela data real do Nomus (criada_em_nomus / data_emissao), mais recente primeiro
    return [...list].sort((a, b) => {
      const da = (a as any)._nomus?.criada_em_nomus ?? (a as any)._nomus?.data_emissao ?? a.created_at;
      const db = (b as any)._nomus?.criada_em_nomus ?? (b as any)._nomus?.data_emissao ?? b.created_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
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
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Criada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Nenhuma proposta encontrada.</TableCell></TableRow>
            ) : filtered.map((p) => {
              const parsed = parseTitle(p.title);
              const displayNumber = parsed.cn || p.number;
              const displayClient = (p.clients as any)?.name ?? parsed.client ?? "—";
              const cnpj = formatCNPJ((p as any)._cnpj);
              const representante = (p as any)._nomus?.representante_nome ?? "—";
              const vendedor = (p as any)._nomus?.vendedor_nome ?? "—";
              return (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs">
                  <Link to="/app/propostas/$id" params={{ id: p.id }} className="hover:text-primary">{displayNumber}</Link>
                </TableCell>
                <TableCell className="font-medium max-w-xs truncate">
                  <Link to="/app/propostas/$id" params={{ id: p.id }}>{displayClient}</Link>
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground whitespace-nowrap">{cnpj}</TableCell>
                <TableCell className="text-sm">{representante}</TableCell>
                <TableCell className="text-sm">{vendedor}</TableCell>
                <TableCell><StatusBadge status={p.status as ProposalStatus} /></TableCell>
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
