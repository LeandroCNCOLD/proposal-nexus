import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { fmtColdProChart, toKW } from "./chartUtils";

export function LoadBreakdownBarChart({ normalized }: { normalized: ColdProNormalizedResult }) {
  const total = normalized.summary.requiredKcalH || 1;
  const l = normalized.loadDistribution;
  const data = [
    ["Transmissão", l.environmentKcalH],
    ["Produto", l.productKcalH],
    ["Túnel/processo", l.tunnelProcessKcalH],
    ["Embalagem", l.packagingKcalH],
    ["Respiração", l.respirationKcalH],
    ["Desumidificação", l.dehumidificationKcalH],
    ["Processos especiais", l.specialProcessesKcalH],
    ["Infiltração", l.infiltrationKcalH],
    ["Pessoas", l.peopleKcalH],
    ["Iluminação", l.lightingKcalH],
    ["Motores", l.motorsKcalH],
    ["Ventiladores", l.fansKcalH],
    ["Degelo", l.defrostKcalH],
    ["Impacto gelo", l.iceImpactKcalH],
    ["Outras", l.otherKcalH],
    ["Segurança", l.safetyKcalH],
  ].map(([name, value]) => ({ name, value: Number(value) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);

  if (!data.length) return null;

  return (
    <div className="rounded-xl border bg-background p-4">
      <h4 className="mb-3 text-sm font-semibold">Ranking por componente</h4>
      <div className="h-[360px] w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis type="number" tickFormatter={(value) => fmtColdProChart(value, 0)} fontSize={11} />
            <YAxis dataKey="name" type="category" width={118} fontSize={11} />
            <Tooltip formatter={(value: number) => [`${fmtColdProChart(value, 0)} kcal/h · ${fmtColdProChart(toKW(value), 1)} kW · ${fmtColdProChart((value / total) * 100, 1)}%`, "Carga"]} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
