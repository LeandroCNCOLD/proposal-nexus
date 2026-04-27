type Props = {
  result: any;
};

function toFinite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function firstFinite(...values: unknown[]) {
  for (const value of values) {
    const parsed = toFinite(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function formatNumber(value: unknown, decimals = 2) {
  const parsed = toFinite(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(parsed);
}

function formatCurrency(value: unknown) {
  const parsed = toFinite(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

function formatKwh(value: unknown) {
  return toFinite(value) === null ? "—" : `${formatNumber(value, 0)} kWh`;
}

function formatKw(value: unknown) {
  return toFinite(value) === null ? "—" : `${formatNumber(value, 2)} kW`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

export function EnergySummary({ result }: Props) {
  const energy = result?.energySimulation ?? result?.energy_simulation ?? result?.calculation_breakdown?.energySimulation ?? result?.calculation_breakdown?.energy_simulation ?? {};
  const processedMassKgMonth = firstFinite(energy?.processedMassKgMonth, energy?.processed_mass_kg_month, energy?.assumptions?.monthlyProcessedMassKg, energy?.assumptions?.monthly_processed_mass_kg);
  const warnings: string[] = Array.isArray(energy?.warnings) ? energy.warnings.filter(Boolean).map(String) : [];

  return (
    <div className="coldpro-card">
      <h3 className="mb-2 text-sm font-semibold">Energia</h3>
      <div className="coldpro-grid">
        <Metric label="COP" value={formatNumber(firstFinite(result?.cop, result?.COP, result?.copData?.cop, result?.cop_data?.cop, energy?.cop, energy?.assumptions?.cop), 2)} />
        <Metric label="Potência elétrica" value={formatKw(energy?.electricalPowerKW ?? energy?.electrical_power_kw)} />
        <Metric label="Consumo diário" value={formatKwh(energy?.kWhDay ?? energy?.kwh_day)} />
        <Metric label="Consumo mensal" value={formatKwh(energy?.kWhMonth ?? energy?.kwh_month)} />
        <Metric label="Custo mensal" value={formatCurrency(energy?.monthlyCost ?? energy?.monthly_cost)} />
        <Metric label="Custo anual" value={formatCurrency(energy?.annualCost ?? energy?.annual_cost)} />
        <Metric label="Custo/kg" value={toFinite(energy?.costPerKg ?? energy?.cost_per_kg) === null ? "—" : `${formatCurrency(energy?.costPerKg ?? energy?.cost_per_kg)}/kg`} />
        <Metric label="Massa mensal" value={toFinite(processedMassKgMonth) === null ? "—" : `${formatNumber(processedMassKgMonth, 0)} kg`} />
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