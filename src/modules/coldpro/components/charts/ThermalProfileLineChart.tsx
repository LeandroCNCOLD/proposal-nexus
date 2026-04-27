import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtChart } from "./chartData";

type Props = { title: string; normalized: ColdProNormalizedResult };

export function ThermalProfileLineChart({ title, normalized }: Props) {
  const p = normalized.temperatureProfile;
  if (!p.hasData) return <section className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">Perfil térmico indisponível: faltam temperatura inicial, final, ponto de congelamento ou tempo estimado.</section>;
  const data = [
    { stage: "Entrada", temp: p.inletTempC },
    { stage: "Congelamento", temp: p.freezingTempC },
    { stage: "Saída", temp: p.outletTempC },
  ];
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4><p className="text-xs text-muted-foreground">Evolução estimada da temperatura do produto no processo.</p></div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="stage" fontSize={11} />
            <YAxis tickFormatter={(value) => `${fmtChart(value, 0)}°C`} fontSize={11} />
            <Tooltip formatter={(value: any) => [`${fmtChart(value, 1)} °C`, "Temperatura"]} />
            <ReferenceLine y={p.airTempC} stroke="var(--destructive)" strokeDasharray="4 4" label="Ar" />
            <Line type="monotone" dataKey="temp" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
