export type CopEstimateInput = {
  evapTempC?: number | null;
  condTempC?: number | null;
  efficiency?: number | null;
};

export type EnergyCalculationInput = {
  coolingLoadKW?: number | null;
  COP?: number | null;
  hoursPerDay?: number | null;
  daysPerMonth?: number | null;
  energyCostPerKWh?: number | null;
  massPerDay?: number | null;
};

export type EnergyCalculationResult = {
  powerInputKW: number;
  powerKW: number;
  dailyConsumptionKWh: number;
  monthlyConsumptionKWh: number;
  monthlyKWh: number;
  monthlyCost: number;
  costPerKg: number;
  warnings: string[];
};

const ABSOLUTE_ZERO_C = -273.15;
const DEFAULT_COP_EFFICIENCY = 0.45;

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function celsiusToKelvin(valueC: number): number {
  return valueC - ABSOLUTE_ZERO_C;
}

export function estimateCOP(
  evapTempC: number | null | undefined,
  condTempC: number | null | undefined,
  efficiency = DEFAULT_COP_EFFICIENCY,
): number {
  const evapK = celsiusToKelvin(Number(evapTempC));
  const condK = celsiusToKelvin(Number(condTempC));
  const safeEfficiency = positiveNumber(efficiency) || DEFAULT_COP_EFFICIENCY;
  if (!Number.isFinite(evapK) || !Number.isFinite(condK) || evapK <= 0 || condK <= evapK) return 0;
  return round((evapK / (condK - evapK)) * safeEfficiency);
}

export function calculateEnergy(input: EnergyCalculationInput): EnergyCalculationResult {
  const coolingLoadKW = positiveNumber(input.coolingLoadKW);
  const cop = positiveNumber(input.COP);
  const hoursPerDay = positiveNumber(input.hoursPerDay);
  const daysPerMonth = positiveNumber(input.daysPerMonth);
  const energyCostPerKWh = positiveNumber(input.energyCostPerKWh);
  const massPerDay = positiveNumber(input.massPerDay);
  const warnings: string[] = [];

  if (coolingLoadKW <= 0) warnings.push("Carga térmica ausente ou inválida.");
  if (cop <= 0) warnings.push("COP ausente ou inválido.");
  if (hoursPerDay <= 0) warnings.push("Horas por dia ausentes ou inválidas.");
  if (daysPerMonth <= 0) warnings.push("Dias por mês ausentes ou inválidos.");
  if (energyCostPerKWh <= 0) warnings.push("Custo de energia ausente ou inválido.");
  if (massPerDay <= 0) warnings.push("Massa diária ausente ou inválida; custo por kg será zero.");

  const powerInputKW = cop > 0 ? coolingLoadKW / cop : 0;
  const dailyConsumptionKWh = powerInputKW * hoursPerDay;
  const monthlyConsumptionKWh = dailyConsumptionKWh * daysPerMonth;
  const monthlyCost = monthlyConsumptionKWh * energyCostPerKWh;
  const monthlyMassKg = massPerDay * daysPerMonth;
  const costPerKg = monthlyMassKg > 0 ? monthlyCost / monthlyMassKg : 0;

  return {
    powerInputKW: round(powerInputKW),
    powerKW: round(powerInputKW),
    dailyConsumptionKWh: round(dailyConsumptionKWh),
    monthlyConsumptionKWh: round(monthlyConsumptionKWh),
    monthlyKWh: round(monthlyConsumptionKWh),
    monthlyCost: round(monthlyCost, 2),
    costPerKg: round(costPerKg, 4),
    warnings,
  };
}
