import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COLDPRO_CHART_COLORS, fmtChart, toKW, toTR, type ColdProChartDatum } from "./chartData";

type Props = { title: string; subtitle?: string; components: ColdProChartDatum[]; subtotal: number; safety: number; total: number };

export function LoadWaterfallChart({ title, subtitle, components, subtotal, safety, total }: Props) {
  let running = 0;
  const rows = components.filter((item) => item.value > 0).map((item) => {
    const row = { name: item.name, base: running, value: item.value, raw: item.value, kind: "component" };
    running += item.value;
    return row;
  });
  const data = [...rows, { name: "Subtotal", base: 0, value: subtotal, raw: subtotal, kind: "subtotal" }, { name: "Segurança", base: subtotal, value: safety, raw: safety, kind: "safety" }, { name: "Total", base: 0, value: total, raw: total, kind: "total" }];
  if (!data.some((item) => item.raw > 0)) return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">{title}: dados indisponíveis.</div>;

  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4>{subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}</div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" angle={-28} textAnchor="end" interval={0} fontSize={10} />
            <YAxis tickFormatter={(value) => fmtChart(value, 0)} fontSize={11} />
            <Tooltip formatter={(_, __, props: any) => [`${fmtChart(props.payload.raw, 0)} kcal/h · ${fmtChart(toKW(props.payload.raw), 1)} kW · ${fmtChart(toTR(props.payload.raw), 2)} TR`, "Carga"]} />
            <Bar dataKey="base" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a" radius={[6, 6, 0, 0]}>
              {data.map((item, index) => <Cell key={item.name} fill={item.kind === "total" ? "var(--primary)" : item.kind === "safety" ? "var(--destructive)" : COLDPRO_CHART_COLORS[index % COLDPRO_CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
