type Props = {
  result: any;
  selection?: any | null;
};

function toFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: unknown, decimals = 2) {
  const parsed = toFinite(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(parsed);
}

function formatCurrency(value: unknown) {
  const parsed = toFinite(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

function formatKw(value: unknown) {
  return toFinite(value) === null ? "—" : `${formatNumber(value, 2)} kW`;
}

function equipmentName(item: any) {
  return String(item?.equipmentName ?? item?.equipment_name ?? item?.equipment?.model ?? item?.equipment?.name ?? item?.model ?? item?.name ?? "—");
}

export function EquipmentOptimizationSummary({ result, selection }: Props) {
  const optimization = result?.equipmentOptimization ?? result?.equipment_optimization ?? result?.optimization ?? result?.calculation_breakdown?.equipmentOptimization ?? result?.calculation_breakdown?.equipment_optimization ?? {};
  const explicitRanking = Array.isArray(optimization?.ranking) ? optimization.ranking : [];
  const ranking = explicitRanking.length ? explicitRanking : selection ? [selection] : [];
  const bestEquipment = optimization?.bestEquipment ?? optimization?.best_equipment ?? ranking[0] ?? null;
  const warnings: string[] = Array.from(new Set([
    ...(Array.isArray(optimization?.warnings) ? optimization.warnings : []),
    ...(Array.isArray(bestEquipment?.warnings) ? bestEquipment.warnings : []),
    ...(Array.isArray(selection?.curve_metadata?.warnings) ? selection.curve_metadata.warnings : []),
  ].filter(Boolean).map(String)));

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Otimização de equipamento</h3>
        <div className="text-sm text-muted-foreground">Melhor equipamento: <b className="text-foreground">{equipmentName(bestEquipment)}</b></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">Ranking</th>
              <th className="py-2 pr-3 font-medium">Equipamento</th>
              <th className="py-2 pr-3 font-medium">Margem</th>
              <th className="py-2 pr-3 font-medium">Custo mensal</th>
              <th className="py-2 pr-3 font-medium">Score final</th>
              <th className="py-2 pr-3 font-medium">Potência</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length ? ranking.map((item: any, index: number) => (
              <tr key={`${equipmentName(item)}-${index}`} className="border-b last:border-0">
                <td className="py-2 pr-3 tabular-nums">{index + 1}</td>
                <td className="py-2 pr-3 font-medium text-foreground">{equipmentName(item)}</td>
                <td className="py-2 pr-3 tabular-nums">{toFinite(item?.capacityMarginPercent ?? item?.capacity_margin_percent ?? item?.surplus_percent) === null ? "—" : `${formatNumber(item?.capacityMarginPercent ?? item?.capacity_margin_percent ?? item?.surplus_percent, 2)}%`}</td>
                <td className="py-2 pr-3 tabular-nums">{formatCurrency(item?.estimatedMonthlyCost ?? item?.estimated_monthly_cost ?? item?.monthlyCost ?? item?.monthly_cost)}</td>
                <td className="py-2 pr-3 tabular-nums">{formatNumber(item?.scores?.final ?? item?.finalScore ?? item?.final_score ?? item?.score ?? item?.curve_metadata?.score, 2)}</td>
                <td className="py-2 pr-3 tabular-nums">{formatKw(item?.estimatedElectricalPowerKW ?? item?.estimated_electrical_power_kw ?? item?.total_power_kw)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">—</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {warnings.length ? (
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          {warnings.map((warning, i) => (
            <div key={i} className="rounded-md border bg-muted/20 p-2">{warning}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}