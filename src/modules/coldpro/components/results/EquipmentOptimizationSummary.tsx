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
    <div className="coldpro-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Otimização de equipamento</h3>
        <div className="text-sm text-muted-foreground">Melhor equipamento: <b className="text-foreground">{equipmentName(bestEquipment)}</b></div>
      </div>
      <div className="overflow-x-auto">
        <table className="coldpro-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Equipamento</th>
              <th>Margem</th>
              <th>Custo mensal</th>
              <th>Score</th>
              <th>Potência</th>
            </tr>
          </thead>
          <tbody>
            {ranking.length ? ranking.map((item: any, index: number) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{equipmentName(item)}</td>
                <td>
                  {item?.capacityMarginPercent != null
                    ? `${formatNumber(item.capacityMarginPercent, 2)}%`
                    : "—"}
                </td>
                <td>{formatCurrency(item?.estimatedMonthlyCost)}</td>
                <td>{formatNumber(item?.scores?.final, 2)}</td>
                <td>{formatKw(item?.estimatedElectricalPowerKW)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>—</td>
              </tr>
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