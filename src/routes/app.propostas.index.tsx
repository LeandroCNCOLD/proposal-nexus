import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Plus, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { nomusSyncProposalsFull } from "@/integrations/nomus/server.functions";

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

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
      const res = await fetch(
        "/_serverFn/" + btoa(JSON.stringify({
          file: "/@id/src/integrations/nomus/server.functions.ts?tss-serverfn-split",
          export: "nomusSyncProposalsFull_createServerFn_handler",
        })),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
      }
      return res.json();
    },
    onSuccess: (res: any) => {
      toast.success(`Sincronização concluída: ${res?.synced ?? 0} propostas`);
      queryClient.invalidateQueries({ queryKey: ["proposals-list"] });
    },
    onError: (err: any) => toast.error(`Erro ao sincronizar: ${err?.message ?? "desconhecido"}`),
  });

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, number, title, status, total_value, valid_until, created_at, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => proposals.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.number.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || ((p.clients as any)?.name ?? "").toLowerCase().includes(q);
  }), [proposals, search, statusFilter]);

  return (
    <>
      <PageHeader
        title="Propostas"
        subtitle={`${filtered.length} de ${proposals.length} propostas`}
        actions={
          <>
            <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Sincronizando..." : "Buscar do Nomus"}
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

      <div className="rounded-xl border bg-card shadow-[var(--shadow-sm)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Número</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Criada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Nenhuma proposta encontrada.</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs">
                  <Link to="/app/propostas/$id" params={{ id: p.id }} className="hover:text-primary">{p.number}</Link>
                </TableCell>
                <TableCell className="font-medium max-w-xs truncate">
                  <Link to="/app/propostas/$id" params={{ id: p.id }}>{p.title}</Link>
                </TableCell>
                <TableCell className="text-sm">{(p.clients as any)?.name ?? "—"}</TableCell>
                <TableCell><StatusBadge status={p.status as ProposalStatus} /></TableCell>
                <TableCell className="text-right tabular-nums font-medium">{brl(Number(p.total_value ?? 0))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateBR(p.valid_until)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{dateBR(p.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
