import { safeNumber } from "../core/units";

export type MonthlyEnergySimulationInput = {
  coolingLoadKW?: number | null;
  cop?: number | null;
  operatingHoursPerDay?: number | null;
  operatingDaysPerMonth?: number | null;
  energyCostPerKWh?: number | null;
  processedMassKgPerDay?: number | null;
};

export type MonthlyEnergySimulationResult = {
  electricalPowerKW: number;
  kWhDay: number;
  kWhMonth: number;
  monthlyCost: number;
  annualCost: number;
  costPerKg: number;
  warnings: string[];
  assumptions: Record<string, unknown>;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = safeNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown): number {
  const parsed = finiteNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
}

function roundEnergy(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}

export function simulateMonthlyEnergyConsumption(input: MonthlyEnergySimulationInput): MonthlyEnergySimulationResult {
  const coolingLoadKW = positiveNumber(input?.coolingLoadKW);
  const cop = positiveNumber(input?.cop);
  const operatingHoursPerDay = positiveNumber(input?.operatingHoursPerDay);
  const operatingDaysPerMonth = positiveNumber(input?.operatingDaysPerMonth);
  const energyCostPerKWh = positiveNumber(input?.energyCostPerKWh);
  const processedMassKgPerDay = positiveNumber(input?.processedMassKgPerDay);
  const warnings: string[] = [];

  if (coolingLoadKW <= 0) warnings.push("Carga térmica ausente ou inválida; consumo calculado como zero.");
  if (cop <= 0) warnings.push("COP ausente ou inválido; potência elétrica calculada como zero para evitar divisão inválida.");
  if (operatingHoursPerDay <= 0) warnings.push("Horas de operação por dia ausentes ou inválidas.");
  if (operatingHoursPerDay > 24) warnings.push("Horas de operação por dia acima de 24; revisar premissa operacional.");
  if (operatingDaysPerMonth <= 0) warnings.push("Dias de operação por mês ausentes ou inválidos.");
  if (operatingDaysPerMonth > 31) warnings.push("Dias de operação por mês acima de 31; revisar premissa operacional.");
  if (energyCostPerKWh <= 0) warnings.push("Tarifa de energia ausente ou inválida; custo calculado como zero.");
  if (processedMassKgPerDay <= 0) warnings.push("Massa processada por dia ausente ou inválida; custo por kg calculado como zero.");

  const electricalPowerKW = cop > 0 ? coolingLoadKW / cop : 0;
  const kWhDay = electricalPowerKW * operatingHoursPerDay;
  const kWhMonth = kWhDay * operatingDaysPerMonth;
  const monthlyCost = kWhMonth * energyCostPerKWh;
  const annualCost = monthlyCost * 12;
  const monthlyProcessedMassKg = processedMassKgPerDay * operatingDaysPerMonth;
  const costPerKg = monthlyProcessedMassKg > 0 ? monthlyCost / monthlyProcessedMassKg : 0;

  const result = {
    electricalPowerKW: roundEnergy(electricalPowerKW),
    kWhDay: roundEnergy(kWhDay),
    kWhMonth: roundEnergy(kWhMonth),
    monthlyCost: roundCurrency(monthlyCost),
    annualCost: roundCurrency(annualCost),
    costPerKg: roundCurrency(costPerKg),
    warnings: Array.from(new Set(warnings)),
    assumptions: {
      formula: "potência elétrica = carga térmica / COP; kWh/dia = potência elétrica × horas/dia; kWh/mês = kWh/dia × dias/mês.",
      coolingLoadKW,
      cop,
      operatingHoursPerDay,
      operatingDaysPerMonth,
      energyCostPerKWh,
      processedMassKgPerDay,
      monthlyProcessedMassKg: roundEnergy(monthlyProcessedMassKg),
    },
  };

  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, typeof value === "number" && !Number.isFinite(value) ? 0 : value])) as MonthlyEnergySimulationResult;
}