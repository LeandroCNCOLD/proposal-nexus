import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtChart } from "./chartData";

type Props = { title: string; normalized: ColdProNormalizedResult };

export function SimulationMatrixChart({ title, normalized }: Props) {
  const t = normalized.tunnelValidation;
  const hasData = t.airVelocityMS > 0 && t.airTempC != null && (t.coreTimeMin > 0 || t.powerKW > 0);
  const data = hasData ? [{ velocity: t.airVelocityMS, temp: t.airTempC, time: t.coreTimeMin || t.powerKW, status: t.status }] : [];
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3"><h4 className="text-sm font-semibold">{title}</h4><p className="text-xs text-muted-foreground">Temperatura do ar x velocidade do ar no ponto calculado.</p></div>
      {data.length ? (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="velocity" name="Velocidade" unit=" m/s" fontSize={11} />
              <YAxis dataKey="temp" name="Temperatura" unit=" °C" fontSize={11} />
              <ZAxis dataKey="time" range={[120, 520]} />
              <Tooltip formatter={(value: any, name: any) => [fmtChart(value, 1), name]} />
              <Scatter data={data} fill="var(--primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Execute a simulação operacional para visualizar a matriz temperatura x velocidade.</div>}
    </section>
  );
}
