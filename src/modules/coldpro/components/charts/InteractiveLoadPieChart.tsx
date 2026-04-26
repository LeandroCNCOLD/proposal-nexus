import * as React from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { COLDPRO_CHART_COLORS, compactSmallSlices, fmtChart, pct, toKW, toTR, type ColdProChartDatum } from "./chartData";

type Props = {
  title: string;
  subtitle?: string;
  data: ColdProChartDatum[];
  total?: number;
};

export function InteractiveLoadPieChart({ title, subtitle, data, total }: Props) {
  const chartTotal = total ?? data.reduce((sum, item) => sum + item.value, 0);
  const rows = compactSmallSlices(data, chartTotal);
  const [activeName, setActiveName] = React.useState(rows[0]?.name ?? "");
  const active = rows.find((item) => item.name === activeName) ?? rows[0];

  if (!rows.length || chartTotal <= 0) return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">{title}: dados indisponíveis.</div>;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative h-80 min-w-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="84%" paddingAngle={2} onClick={(entry) => setActiveName(String(entry.name))}>
                {rows.map((item, index) => <Cell key={item.name} fill={COLDPRO_CHART_COLORS[index % COLDPRO_CHART_COLORS.length]} opacity={!active || active.name === item.name ? 1 : 0.45} />)}
              </Pie>
              <Tooltip formatter={(value: any, name: any) => [`${fmtChart(value, 0)} kcal/h · ${fmtChart(toKW(Number(value)), 1)} kW · ${fmtChart(toTR(Number(value)), 2)} TR · ${fmtChart(pct(Number(value), chartTotal), 1)}%`, name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} onClick={(entry: any) => setActiveName(String(entry.value))} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold tabular-nums">{fmtChart(chartTotal, 0)}</div>
              <div className="text-[11px] text-muted-foreground">kcal/h · {fmtChart(toKW(chartTotal), 1)} kW · {fmtChart(toTR(chartTotal), 2)} TR</div>
            </div>
          </div>
        </div>
        {active ? (
          <aside className="rounded-lg border bg-muted/20 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Selecionado</div>
            <div className="mt-1 text-base font-semibold">{active.name}</div>
            <div className="mt-3 space-y-1 text-sm">
              <div><b>{fmtChart(active.value, 0)}</b> kcal/h</div>
              <div><b>{fmtChart(toKW(active.value), 1)}</b> kW</div>
              <div><b>{fmtChart(toTR(active.value), 2)}</b> TR</div>
              <div><b>{fmtChart(pct(active.value, chartTotal), 1)}%</b> do total</div>
            </div>
            {active.description ? <p className="mt-3 text-xs text-muted-foreground">{active.description}</p> : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
