import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { fmtChart, toKW, toTR } from "./chartData";

type Props = { title: string; subtitle?: string; requiredKcalH: number; capacityKcalH: number; surplusPercent?: number };

export function CapacityComparisonChart({ title, subtitle, requiredKcalH, capacityKcalH, surplusPercent }: Props) {
  const data = [{ name: "Carga requerida", value: requiredKcalH }, { name: "Capacidade", value: capacityKcalH }].filter((item) => item.value > 0);
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div><h4 className="text-sm font-semibold">{title}</h4>{subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}</div>
        {surplusPercent != null ? <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Sobra {fmtChart(surplusPercent, 1)}%</span> : null}
      </div>
      {data.length >= 2 ? (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis tickFormatter={(value) => fmtChart(value, 0)} fontSize={11} />
              <Tooltip formatter={(value: any) => [`${fmtChart(value, 0)} kcal/h · ${fmtChart(toKW(Number(value)), 1)} kW · ${fmtChart(toTR(Number(value)), 2)} TR`, "Valor"]} />
              <ReferenceLine y={requiredKcalH} stroke="var(--destructive)" strokeDasharray="4 4" />
              <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Compare após calcular a carga e selecionar capacidade.</div>}
    </section>
  );
}
