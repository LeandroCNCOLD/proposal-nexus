import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtColdProChart } from "./chartUtils";

function statusText(surplus: number) {
  if (surplus < 0) return "Crítico";
  if (surplus < 5) return "Atenção";
  if (surplus <= 20) return "Adequado";
  if (surplus > 30) return "Possível superdimensionamento";
  return "Sobra alta";
}

export function EquipmentCapacityChart({ normalized }: { normalized: ColdProNormalizedResult }) {
  const e = normalized.equipment;
  const data = [
    { name: "Carga requerida", value: e.requiredCapacityKcalH || normalized.summary.requiredKcalH },
    { name: "Capacidade selecionada", value: e.totalCapacityKcalH },
  ].filter((item) => item.value > 0);

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Capacidade requerida vs equipamento</h4>
          <p className="text-xs text-muted-foreground">{e.selectedModel ? `${e.quantity || 1} × ${e.selectedModel}` : "Nenhum equipamento selecionado"}</p>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{statusText(e.surplusPercent)} · {fmtColdProChart(e.surplusPercent, 2)}%</span>
      </div>
      {data.length ? (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis tickFormatter={(value) => fmtColdProChart(value, 0)} fontSize={11} />
              <Tooltip formatter={(value: number) => [`${fmtColdProChart(value, 0)} kcal/h`, "Capacidade"]} />
              <ReferenceLine y={normalized.summary.requiredKcalH} stroke="hsl(var(--destructive))" strokeDasharray="4 4" />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Selecione um equipamento para comparar capacidade.</div>}
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
        <span>Vazão: <b>{fmtColdProChart(e.airflowM3H, 0)} m³/h</b></span>
        <span>Trocas/h: <b>{fmtColdProChart(e.airChangesPerHour, 1)}</b></span>
        <span>Potência: <b>{fmtColdProChart(e.estimatedPowerKW, 1)} kW</b></span>
        <span>COP: <b>{e.cop ? fmtColdProChart(e.cop, 2) : "—"}</b></span>
      </div>
    </div>
  );
}
