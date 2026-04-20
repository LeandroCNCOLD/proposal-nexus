import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, DollarSign, Trophy, Clock, AlertTriangle, Target, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { brl, dateBR, num } from "@/lib/format";
import { STATUS_GROUPS, STATUS_LABELS, type ProposalStatus } from "@/lib/proposal";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const { data: proposals = [] } = useQuery({
    queryKey: ["dashboard-proposals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, number, title, status, total_value, closed_value, sent_at, valid_until, created_at, next_followup_at, clients(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = proposals.length;
  const totalValue = proposals.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
  const won = proposals.filter((p) => p.status === "ganha");
  const lost = proposals.filter((p) => (STATUS_GROUPS.perdida as readonly string[]).includes(p.status));
  const active = proposals.filter((p) => (STATUS_GROUPS.ativa as readonly string[]).includes(p.status));
  const wonValue = won.reduce((s, p) => s + Number(p.closed_value ?? p.total_value ?? 0), 0);
  const activeValue = active.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
  const conversion = won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;
  const ticket = won.length > 0 ? wonValue / won.length : 0;
  const today = new Date();
  const overdue = active.filter((p) => p.valid_until && new Date(p.valid_until) < today).length;
  const stale = active.filter((p) => p.next_followup_at && new Date(p.next_followup_at) < today).length;

  const statusCounts = Object.keys(STATUS_LABELS).reduce<Record<string, number>>((acc, s) => {
    acc[s] = proposals.filter((p) => p.status === s).length; return acc;
  }, {});
  const chartData = Object.entries(statusCounts).filter(([, c]) => c > 0).map(([s, c]) => ({
    status: STATUS_LABELS[s as ProposalStatus], count: c, key: s,
  }));

  const recent = proposals.slice(0, 6);

  return (
    <>
      <PageHeader
        title="Dashboard executivo"
        subtitle="Visão consolidada do funil de propostas e performance comercial"
        actions={<Button asChild className="bg-[image:var(--gradient-primary)]"><Link to="/app/propostas/nova"><Plus className="mr-1.5 h-4 w-4" /> Nova proposta</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Propostas no funil" value={num(total)} hint={`${active.length} ativas`} icon={<FileText className="h-4 w-4" />} accent="primary" />
        <StatCard label="Valor proposto" value={brl(totalValue)} hint={`${brl(activeValue)} em aberto`} icon={<DollarSign className="h-4 w-4" />} accent="info" />
        <StatCard label="Valor ganho" value={brl(wonValue)} hint={`${won.length} propostas fechadas`} icon={<Trophy className="h-4 w-4" />} accent="success" />
        <StatCard label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} hint={`Ticket médio ${brl(ticket)}`} icon={<Target className="h-4 w-4" />} accent="primary" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard label="Propostas vencidas" value={num(overdue)} hint="Requerem ação imediata" icon={<AlertTriangle className="h-4 w-4" />} accent="destructive" />
        <StatCard label="Sem follow-up" value={num(stale)} hint="Follow-up em atraso" icon={<Clock className="h-4 w-4" />} accent="warning" />
        <StatCard label="Perdidas" value={num(lost.length)} hint={`${brl(lost.reduce((s,p)=>s+Number(p.total_value??0),0))} em valor`} icon={<AlertTriangle className="h-4 w-4" />} accent="destructive" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Distribuição por status</h2>
            <span className="text-xs text-muted-foreground">{total} propostas</span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Sem propostas ainda — crie a primeira para começar.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
                <XAxis dataKey="status" angle={-30} textAnchor="end" tick={{ fontSize: 10 }} interval={0} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={d.key === "ganha" ? "var(--success)" : ["perdida","vencida","cancelada"].includes(d.key) ? "var(--destructive)" : "var(--primary-glow)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recentes</h2>
            <Link to="/app/propostas" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma proposta ainda.</div>
          ) : (
            <div className="space-y-3">
              {recent.map((p) => (
                <Link key={p.id} to="/app/propostas/$id" params={{ id: p.id }}
                  className="block rounded-lg border bg-secondary/30 p-3 hover:bg-secondary transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-mono text-muted-foreground">{p.number}</div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 text-sm font-medium truncate">{p.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {(p.clients as any)?.name ?? "Sem cliente"} · {brl(Number(p.total_value ?? 0))} · {dateBR(p.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
