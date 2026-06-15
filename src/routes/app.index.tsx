import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, DollarSign, Trophy, Clock, AlertTriangle, Target, Plus, TrendingUp, Percent, BarChart2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ActivitiesDashboardCard } from "@/components/activities/ActivitiesDashboardCard";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { brl, dateBR, num } from "@/lib/format";
import { STATUS_GROUPS, STATUS_LABELS, type ProposalStatus } from "@/lib/proposal";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/app/")({ component: Dashboard });

type WeightedPipelineRow = {
  total_leads: number | null;
  pipeline_bruto: number | null;
  pipeline_ponderado: number | null;
  pct_realizacao: number | null;
  valor_muito_quente: number | null;
  valor_quente: number | null;
  valor_morno: number | null;
  valor_frio: number | null;
  probabilidade_media: number | null;
  closer_name: string | null;
  leads_com_closer: number | null;
};

type ForecastRow = {
  mes: string | null;
  propostas: number | null;
  valor_previsto: number | null;
  probabilidade_media: number | null;
  valor_ponderado: number | null;
  closer_name: string | null;
};


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

  const { data: weighted = [] } = useQuery({
    queryKey: ["crm-pipeline-ponderado"],
    queryFn: async (): Promise<WeightedPipelineRow[]> => {
      const { data, error } = await supabase.from("crm_pipeline_ponderado" as never).select("*");
      if (error) throw error;
      return (data ?? []) as unknown as WeightedPipelineRow[];
    },
  });

  const { data: forecast = [] } = useQuery({
    queryKey: ["crm-forecast-mensal"],
    queryFn: async (): Promise<ForecastRow[]> => {
      const { data, error } = await supabase.from("crm_forecast_mensal" as never).select("*").limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ForecastRow[];
    },
  });

  // ROLLUP: total row has closer_name = null
  const totalRow = weighted.find((r) => r.closer_name === null) ?? null;
  const byCloser = weighted.filter((r) => r.closer_name !== null);

  // Forecast — próximos 3 meses agregados
  const nowMonthIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const forecastByMonth = new Map<string, { propostas: number; valor: number; pond: number; probs: number[] }>();
  for (const r of forecast) {
    if (!r.mes || r.mes < nowMonthIso) continue;
    const key = r.mes;
    const acc = forecastByMonth.get(key) ?? { propostas: 0, valor: 0, pond: 0, probs: [] };
    acc.propostas += Number(r.propostas ?? 0);
    acc.valor += Number(r.valor_previsto ?? 0);
    acc.pond += Number(r.valor_ponderado ?? 0);
    if (r.probabilidade_media != null) acc.probs.push(Number(r.probabilidade_media));
    forecastByMonth.set(key, acc);
  }
  const forecast3Months = Array.from(forecastByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3)
    .map(([mes, v]) => ({
      mes,
      ...v,
      probMedia: v.probs.length ? v.probs.reduce((s, x) => s + x, 0) / v.probs.length : 0,
    }));



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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Propostas no funil" value={num(total)} hint={`${active.length} ativas`} icon={<FileText className="h-4 w-4" />} accent="primary" />
        <StatCard label="Valor proposto" value={brl(totalValue)} hint={`${brl(activeValue)} em aberto`} icon={<DollarSign className="h-4 w-4" />} accent="info" />
        <StatCard label="Valor ganho" value={brl(wonValue)} hint={`${won.length} propostas fechadas`} icon={<Trophy className="h-4 w-4" />} accent="success" />
        <StatCard label="Taxa de conversão" value={`${conversion.toFixed(1)}%`} hint={`Ticket médio ${brl(ticket)}`} icon={<Target className="h-4 w-4" />} accent="primary" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <StatCard label="Propostas vencidas" value={num(overdue)} hint="Requerem ação imediata" icon={<AlertTriangle className="h-4 w-4" />} accent="destructive" />
        <StatCard label="Sem follow-up" value={num(stale)} hint="Follow-up em atraso" icon={<Clock className="h-4 w-4" />} accent="warning" />
        <StatCard label="Perdidas" value={num(lost.length)} hint={`${brl(lost.reduce((s,p)=>s+Number(p.total_value??0),0))} em valor`} icon={<AlertTriangle className="h-4 w-4" />} accent="destructive" />
      </div>

      {/* Pipeline Ponderado (Melhoria 4) */}
      {totalRow && (
        <section className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#0F2D5E]" />
            <h2 className="text-sm font-bold text-[#0F2D5E]">Pipeline Ponderado — Funil SDR/Closer</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pipeline Bruto"
              value={brl(Number(totalRow.pipeline_bruto ?? 0))}
              hint={`${num(Number(totalRow.total_leads ?? 0))} leads ativos`}
              icon={<DollarSign className="h-4 w-4" />}
              accent="info"
            />
            <StatCard
              label="Pipeline Ponderado"
              value={brl(Number(totalRow.pipeline_ponderado ?? 0))}
              hint="valor real estimado (valor × prob.)"
              icon={<TrendingUp className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Probabilidade Média"
              value={`${Number(totalRow.probabilidade_media ?? 0).toFixed(1)}%`}
              hint={`Realização ${Number(totalRow.pct_realizacao ?? 0).toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              accent="primary"
            />
            <StatCard
              label="Propostas Ativas"
              value={num(Number(totalRow.total_leads ?? 0))}
              hint={`${num(Number(totalRow.leads_com_closer ?? 0))} com Closer`}
              icon={<FileText className="h-4 w-4" />}
              accent="info"
            />
          </div>

          {/* Composição por temperatura */}
          {(() => {
            const mq = Number(totalRow.valor_muito_quente ?? 0);
            const q = Number(totalRow.valor_quente ?? 0);
            const m = Number(totalRow.valor_morno ?? 0);
            const f = Number(totalRow.valor_frio ?? 0);
            const sum = mq + q + m + f;
            if (sum <= 0) return null;
            const segs = [
              { label: "Muito Quente", v: mq, color: "bg-red-500" },
              { label: "Quente", v: q, color: "bg-orange-500" },
              { label: "Morno", v: m, color: "bg-amber-400" },
              { label: "Frio", v: f, color: "bg-blue-400" },
            ];
            return (
              <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)]">
                <div className="text-xs font-semibold mb-2">Composição do pipeline por temperatura</div>
                <div className="flex h-3 rounded overflow-hidden">
                  {segs.map((s) => (
                    <div key={s.label} className={s.color} style={{ width: `${(s.v / sum) * 100}%` }} title={`${s.label}: ${brl(s.v)}`} />
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {segs.map((s) => (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded ${s.color}`} />
                      <span className="text-muted-foreground">{s.label}:</span>
                      <span className="font-semibold">{brl(s.v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Forecast próximos 3 meses */}
          {forecast3Months.length > 0 && (
            <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)]">
              <div className="text-xs font-semibold mb-2">Forecast — próximos 3 meses</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left border-b">
                      <th className="py-1.5 pr-2">Mês</th>
                      <th className="py-1.5 px-2 text-center">Propostas</th>
                      <th className="py-1.5 px-2 text-right">Valor Previsto</th>
                      <th className="py-1.5 px-2 text-right">Prob. Média</th>
                      <th className="py-1.5 pl-2 text-right">Ponderado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast3Months.map((r) => (
                      <tr key={r.mes} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">
                          {new Date(r.mes).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </td>
                        <td className="py-1.5 px-2 text-center">{num(r.propostas)}</td>
                        <td className="py-1.5 px-2 text-right">{brl(r.valor)}</td>
                        <td className="py-1.5 px-2 text-right">{r.probMedia.toFixed(1)}%</td>
                        <td className="py-1.5 pl-2 text-right font-semibold text-[#0F2D5E]">{brl(r.pond)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Por Closer */}
          {byCloser.length > 0 && (
            <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)]">
              <div className="text-xs font-semibold mb-2">Pipeline por Closer</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left border-b">
                      <th className="py-1.5 pr-2">Closer</th>
                      <th className="py-1.5 px-2 text-center">Propostas</th>
                      <th className="py-1.5 px-2 text-right">Bruto</th>
                      <th className="py-1.5 px-2 text-right">Ponderado</th>
                      <th className="py-1.5 pl-2 text-right">Prob. Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCloser.map((r) => (
                      <tr key={r.closer_name} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{r.closer_name}</td>
                        <td className="py-1.5 px-2 text-center">{num(Number(r.total_leads ?? 0))}</td>
                        <td className="py-1.5 px-2 text-right">{brl(Number(r.pipeline_bruto ?? 0))}</td>
                        <td className="py-1.5 px-2 text-right font-semibold text-[#0F2D5E]">{brl(Number(r.pipeline_ponderado ?? 0))}</td>
                        <td className="py-1.5 pl-2 text-right">{Number(r.probabilidade_media ?? 0).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-3">
        <ActivitiesDashboardCard />
      </div>




      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)] lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Distribuição por status</h2>
            <span className="text-xs text-muted-foreground">{total} propostas</span>
          </div>
          {chartData.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sem propostas ainda — crie a primeira para começar.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
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

        <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-sm)]">
          <div className="mb-3 flex items-center justify-between">
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
