import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSellerProposals, type SellerProposal } from "@/hooks/use-seller-proposals";
import { useAuth } from "@/hooks/useAuth";
import { brl, dateBR } from "@/lib/format";
import { STATUS_LABELS, TEMPERATURE_LABELS, type ProposalStatus } from "@/lib/proposal";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, Calendar, DollarSign, Thermometer } from "lucide-react";
import { HandoffLeadsForSeller } from "@/components/sdr/HandoffLeadsForSeller";

export const Route = createFileRoute("/app/vendas/carteira")({
  component: SellerWalletPage,
});

const STATUS_ORDER: ProposalStatus[] = [
  "em_elaboracao", "aguardando_aprovacao", "enviada", "em_negociacao", "ganha", "perdida", "cancelada",
];

function SellerWalletPage() {
  const { user } = useAuth();
  const { data: proposals = [], isLoading } = useSellerProposals();

  const stats = useMemo(() => {
    const open = proposals.filter((p) => !["ganha", "perdida", "cancelada"].includes(p.status));
    const won = proposals.filter((p) => p.status === "ganha");
    const total = open.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
    const wonValue = won.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
    const winRate = proposals.length > 0 ? Math.round((won.length / proposals.length) * 100) : 0;
    return { open: open.length, won: won.length, total, wonValue, winRate, count: proposals.length };
  }, [proposals]);

  const grouped = useMemo(() => {
    const map = new Map<string, SellerProposal[]>();
    for (const p of proposals) {
      const k = p.status;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return STATUS_ORDER.filter((s) => map.has(s)).map((s) => ({ status: s, items: map.get(s)! }));
  }, [proposals]);

  if (!user) return <div className="p-6">Faça login para ver sua carteira.</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Minha Carteira (Vendas)</h1>
        <p className="text-sm text-muted-foreground">
          {user.user_metadata?.full_name ?? user.email} · {stats.count} propostas atribuídas
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Propostas abertas" value={String(stats.open)} />
        <Stat label="Valor em pipeline" value={brl(stats.total)} highlight />
        <Stat label="Ganhas" value={`${stats.won} · ${brl(stats.wonValue)}`} />
        <Stat label="Win rate" value={`${stats.winRate}%`} />
      </div>
      {user?.id && <HandoffLeadsForSeller userId={user.id} />}


      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma proposta atribuída a você como vendedor. Verifique se seu nome no perfil bate com <strong>vendedor</strong> no Nomus, ou peça ao admin para mapear o ID.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ status, items }) => (
            <div key={status}>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {STATUS_LABELS[status]} · {items.length}
              </div>
              <div className="space-y-2">
                {items.map((p) => <ProposalRow key={p.id} p={p} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={"mt-1 " + (highlight ? "text-xl font-bold tabular-nums text-[#0F2D5E]" : "text-lg font-semibold tabular-nums")}>{value}</div>
    </div>
  );
}

function ProposalRow({ p }: { p: SellerProposal }) {
  const clientName = p.clients?.trade_name || p.clients?.name || "—";
  return (
    <Link to="/app/propostas/$id" params={{ id: p.id }} className="block rounded-md border bg-card p-3 hover:border-primary transition">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{p.number ?? "—"}</span>
            <span className="font-semibold text-sm truncate">{p.title}</span>
            {p.nomus_proposal_id && (
              <Badge variant="secondary" className="text-[10px]"><FileText className="h-3 w-3 mr-1" />Nomus</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{clientName}</div>
          <div className="flex gap-3 mt-1 text-xs flex-wrap items-center">
            <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{brl(Number(p.total_value ?? 0))}</span>
            {p.temperature && (
              <span className="inline-flex items-center gap-1">
                <Thermometer className="h-3 w-3" />{TEMPERATURE_LABELS[p.temperature as keyof typeof TEMPERATURE_LABELS] ?? p.temperature}
              </span>
            )}
            {p.next_followup_at && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <Calendar className="h-3 w-3" />Follow-up {dateBR(p.next_followup_at)}
              </span>
            )}
            {p.win_probability != null && <span>{p.win_probability}% prob.</span>}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
