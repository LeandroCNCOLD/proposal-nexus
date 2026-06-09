import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMarketingDashboard } from "@/lib/marketing-leads.functions";

export const Route = createFileRoute("/app/marketing/")({
  component: MarketingDashboardPage,
});

const STATUS_LABELS: Record<string, string> = {
  novo: "Novos",
  em_analise: "Em análise",
  tentando_contato: "Tentando contato",
  qualificado: "Qualificados",
  convertido: "Convertidos",
  descartado: "Descartados",
};

function MarketingDashboardPage() {
  const fn = useServerFn(getMarketingDashboard);
  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "dashboard"],
    queryFn: () => fn({ data: undefined as never }),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando KPIs…</div>;
  if (!data) return <div className="p-6 text-muted-foreground">Sem dados.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
        <Kpi label="Total de leads" value={data.total} />
        <Kpi label="Novos hoje" value={data.novosHoje} highlight />
        <Kpi label="Últimos 7 dias" value={data.novosSemana} />
        <Kpi label="Taxa de conversão" value={`${data.taxaConversao.toFixed(1)}%`} />
        <Kpi label="SLA médio (1ª resposta)" value={data.slaMedioMin == null ? "—" : `${data.slaMedioMin.toFixed(0)} min`} />
      </div>

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#0F2D5E] mb-3">Por status</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <div key={k} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-xl font-bold">{data.porStatus[k] ?? 0}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#0F2D5E] mb-3">Por origem</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(data.porOrigem).map(([k, v]) => (
            <div key={k} className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground capitalize">{k}</div>
              <div className="text-xl font-bold">{v}</div>
            </div>
          ))}
          {Object.keys(data.porOrigem).length === 0 && <div className="text-xs text-muted-foreground">Sem dados.</div>}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "bg-amber-50 border-amber-200" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold text-[#0F2D5E]">{value}</div>
    </div>
  );
}
