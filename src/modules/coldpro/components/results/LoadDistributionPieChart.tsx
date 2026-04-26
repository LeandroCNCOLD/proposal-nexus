import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { CHART_COLORS, fmtColdProChart } from "./chartUtils";

export function LoadDistributionPieChart({ normalized }: { normalized: ColdProNormalizedResult }) {
  const total = normalized.summary.requiredKcalH || 1;
  const data = [
    { name: "Ambiente / transmissão", value: normalized.groupedLoads.transmissionKcalH },
    { name: "Produto + túnel/processo", value: normalized.groupedLoads.productsAndProcessKcalH },
    { name: "Ar, infiltração e umidade", value: normalized.groupedLoads.airAndMoistureKcalH },
    { name: "Cargas internas", value: normalized.groupedLoads.internalLoadsKcalH },
    { name: "Degelo e gelo", value: normalized.groupedLoads.defrostAndIceKcalH },
    { name: "Segurança", value: normalized.groupedLoads.safetyKcalH },
    { name: "Outros", value: normalized.groupedLoads.otherKcalH },
  ].filter((item) => item.value > 0);

  if (!data.length) return <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Distribuição indisponível.</div>;

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold">Distribuição visual de cargas</h4>
        <p className="text-xs text-muted-foreground">Túnel/processo é agrupado com produto/processo.</p>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="82%" paddingAngle={2}>
              {data.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number) => [`${fmtColdProChart(value, 0)} kcal/h (${fmtColdProChart((value / total) * 100, 1)}%)`, "Carga"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
