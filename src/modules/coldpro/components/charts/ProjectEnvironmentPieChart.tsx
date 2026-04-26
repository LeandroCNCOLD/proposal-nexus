import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { COLDPRO_CHART_COLORS, fmtChart, pct, toKW, toTR, type ColdProChartDatum } from "./chartData";

type Props = { title: string; subtitle?: string; data: ColdProChartDatum[]; onOpenEnvironment?: (id: string) => void };

export function ProjectEnvironmentPieChart({ title, subtitle, data, onOpenEnvironment }: Props) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const rows = data.filter((item) => item.value > 0);
  const [activeId, setActiveId] = React.useState(rows[0]?.id ?? rows[0]?.name ?? "");
  const active = rows.find((item) => (item.id ?? item.name) === activeId) ?? rows[0];
  if (!rows.length) return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">{title}: nenhum ambiente calculado.</div>;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4>{subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}</div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%" paddingAngle={2} onClick={(entry) => setActiveId(String(entry.id ?? entry.name))}>
                {rows.map((item, index) => <Cell key={item.id ?? item.name} fill={COLDPRO_CHART_COLORS[index % COLDPRO_CHART_COLORS.length]} opacity={!active || (active.id ?? active.name) === (item.id ?? item.name) ? 1 : 0.45} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${fmtChart(value, 0)} kcal/h · ${fmtChart(toKW(Number(value)), 1)} kW · ${fmtChart(toTR(Number(value)), 2)} TR · ${fmtChart(pct(Number(value), total), 1)}%`, name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {active ? <aside className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Ambiente</div><div className="mt-1 text-base font-semibold">{active.name}</div><div className="mt-2 text-sm"><b>{fmtChart(active.value, 0)}</b> kcal/h<br /><b>{fmtChart(pct(active.value, total), 1)}%</b> do projeto</div>{active.id && onOpenEnvironment ? <button type="button" onClick={() => onOpenEnvironment(active.id!)} className="mt-3 rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Abrir ambiente</button> : null}</aside> : null}
      </div>
    </section>
  );
}
