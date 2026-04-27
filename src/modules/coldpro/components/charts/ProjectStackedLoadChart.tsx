import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ColdProProjectConsolidatedResult } from "../../core/projectResultConsolidator";
import { fmtChart, toKW, toTR } from "./chartData";

type Props = { title: string; subtitle?: string; consolidated: ColdProProjectConsolidatedResult };

const stacks = [
  ["transmission", "Transmissão", "var(--chart-1)"],
  ["product", "Produto/processo", "var(--chart-2)"],
  ["air", "Infiltração/umidade", "var(--chart-3)"],
  ["internal", "Internas", "var(--chart-4)"],
  ["defrost", "Degelo/gelo", "var(--chart-5)"],
  ["safety", "Segurança", "var(--destructive)"],
] as const;

export function ProjectStackedLoadChart({ title, subtitle, consolidated }: Props) {
  const data = consolidated.environmentResults.filter((item) => item.summary.requiredKcalH > 0).map((item) => ({
    name: item.environment?.name ?? "Ambiente",
    transmission: item.groupedLoads.transmissionKcalH,
    product: item.groupedLoads.productsAndProcessKcalH,
    air: item.groupedLoads.airAndMoistureKcalH,
    internal: item.groupedLoads.internalLoadsKcalH,
    defrost: item.groupedLoads.defrostAndIceKcalH,
    safety: item.groupedLoads.safetyKcalH,
    total: item.summary.requiredKcalH,
  }));
  if (!data.length) return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">{title}: nenhum ambiente calculado.</div>;
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4>{subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}</div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} fontSize={10} />
            <YAxis tickFormatter={(value) => fmtChart(value, 0)} fontSize={11} />
            <Tooltip formatter={(value: any) => [`${fmtChart(value, 0)} kcal/h · ${fmtChart(toKW(Number(value)), 1)} kW · ${fmtChart(toTR(Number(value)), 2)} TR`, "Carga"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {stacks.map(([key, name, fill]) => <Bar key={key} dataKey={key} name={name} stackId="load" fill={fill} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
