import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtChart, pct, unitLabel, unitValue, type ColdProChartDatum } from "./chartData";

type Unit = "kcal" | "kw" | "tr";

type Props = {
  title: string;
  subtitle?: string;
  data: ColdProChartDatum[];
  total?: number;
  defaultExpanded?: boolean;
};

export function LoadRankingBarChart({ title, subtitle, data, total, defaultExpanded = false }: Props) {
  const [unit, setUnit] = React.useState<Unit>("kcal");
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const chartTotal = total ?? data.reduce((sum, item) => sum + item.value, 0);
  const sorted = data.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const visible = expanded ? sorted : sorted.slice(0, 8);
  const chartData = visible.map((item) => ({ ...item, displayValue: unitValue(item.value, unit), percent: pct(item.value, chartTotal) }));

  if (!chartData.length) return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">{title}: dados indisponíveis.</div>;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex rounded-md border p-0.5 text-xs">
          {(["kcal", "kw", "tr"] as Unit[]).map((item) => (
            <button key={item} type="button" onClick={() => setUnit(item)} className={`rounded px-2 py-1 ${unit === item ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{unitLabel(item)}</button>
          ))}
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 18, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tickFormatter={(value) => fmtChart(value, unit === "kcal" ? 0 : 1)} fontSize={11} />
            <YAxis dataKey="name" type="category" width={120} fontSize={11} />
            <Tooltip formatter={(_, __, props: any) => [`${fmtChart(props.payload.value, 0)} kcal/h · ${fmtChart(unitValue(props.payload.value, "kw"), 1)} kW · ${fmtChart(unitValue(props.payload.value, "tr"), 2)} TR · ${fmtChart(props.payload.percent, 1)}%`, "Carga"]} />
            <Bar dataKey="displayValue" fill="var(--primary)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {sorted.length > 8 ? <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">{expanded ? "Mostrar top 8" : "Mostrar todos"}</button> : null}
    </section>
  );
}
