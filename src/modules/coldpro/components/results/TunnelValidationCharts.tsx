import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtColdProChart } from "./chartUtils";

function MiniBar({ title, data, unit }: { title: string; data: { name: string; value: number }[]; unit: string }) {
  const visible = data.some((item) => item.value > 0);
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {visible ? (
        <div className="h-40">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(value: number) => [`${fmtColdProChart(value, 2)} ${unit}`, title]} />
              <Bar dataKey="value" fill="var(--primary)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="text-sm text-muted-foreground">Dados indisponíveis.</div>}
    </div>
  );
}

export function TunnelValidationCharts({ normalized }: { normalized: ColdProNormalizedResult }) {
  const t = normalized.tunnelValidation;
  if (!t.tunnelProcessKcalH && !t.availableTimeMin && !t.calculatedAirflowM3H) return null;

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Validação térmica do túnel</h4>
          <p className="text-xs text-muted-foreground">Status: {t.status}</p>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{fmtColdProChart(t.tunnelProcessKcalH, 0)} kcal/h</span>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <MiniBar title="Tempo estimado vs disponível" unit="min" data={[{ name: "Estimado", value: t.coreTimeMin }, { name: "Disponível", value: t.availableTimeMin }]} />
        <MiniBar title="h base vs h efetivo" unit="W/m²K" data={[{ name: "Base", value: t.hBaseWM2K }, { name: "Efetivo", value: t.hEffectiveWM2K }]} />
        <MiniBar title="Vazão estimada vs informada" unit="m³/h" data={[{ name: "Estimada", value: t.calculatedAirflowM3H }, { name: "Informada", value: t.informedAirflowM3H }]} />
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <span className="rounded-md bg-muted/30 p-2">Velocidade: <b>{fmtColdProChart(t.airVelocityMS, 2)} m/s</b></span>
        <span className="rounded-md bg-muted/30 p-2">Exposição: <b>{fmtColdProChart(t.exposureFactor, 2)}</b></span>
        <span className="rounded-md bg-muted/30 p-2">Penetração: <b>{fmtColdProChart(t.penetrationFactor, 2)}</b></span>
        <span className="rounded-md bg-muted/30 p-2">Dimensão térmica: <b>{fmtColdProChart(t.characteristicDimensionM, 3)} m</b></span>
      </div>
      {t.warnings.length ? <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">{t.warnings.join(" ")}</div> : null}
    </div>
  );
}
