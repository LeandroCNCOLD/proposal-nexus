import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtColdProChart } from "./chartUtils";

export function TemperatureProfileLineChart({ normalized }: { normalized: ColdProNormalizedResult }) {
  const p = normalized.temperatureProfile;
  const t = normalized.tunnelValidation;
  if (!p.hasData) {
    return <div className="rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground">Perfil térmico indisponível: faltam temperatura inicial, final, ponto de congelamento ou tempo estimado.</div>;
  }
  const total = t.coreTimeMin || t.availableTimeMin || 60;
  const data = [
    { name: "Entrada", min: 0, temp: p.inletTempC },
    { name: "Congelamento", min: Math.round(total * 0.35), temp: p.freezingTempC },
    { name: "Saída", min: Math.round(total * 0.85), temp: p.outletTempC },
    { name: "Ar túnel", min: Math.round(total), temp: p.airTempC },
  ];
  return (
    <div className="rounded-xl border bg-background p-4">
      <h4 className="mb-3 text-sm font-semibold">Perfil térmico conceitual</h4>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis unit="°C" fontSize={11} />
            <Tooltip formatter={(value: any) => [`${fmtColdProChart(value, 1)} °C`, "Temperatura"]} labelFormatter={(_, payload) => payload?.[0]?.payload ? `${payload[0].payload.name} · ${payload[0].payload.min} min` : ""} />
            <Line type="monotone" dataKey="temp" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
