/**
 * MELHORIA 2.3 / 4.3 — Análise de Sensibilidade "What-If"
 *
 * Permite ao vendedor mostrar ao cliente o impacto de variar um parâmetro
 * (ex: espessura do isolamento) na carga térmica e no custo de energia.
 *
 * Uso:
 *   const analysis = runSensitivityAnalysis({
 *     baseEnv: currentEnv,
 *     parameter: "wall_thickness_mm",
 *     values: [75, 100, 125, 150, 200],
 *     calculateFn: (env) => calculateColdProLoad({ env, ... }),
 *     energyCostBRL_kWh: 0.85,
 *     cop: 2.5,
 *   });
 */

export interface SensitivityPoint {
  parameterValue: number | string;
  totalKcalH: number;
  totalKw: number;
  totalTR: number;
  annualEnergyKwh: number;
  annualCostBRL: number;
  savingVsBaseKcalH: number;
  savingVsBaseBRL: number;
  savingPercent: number;
}

export interface SensitivityAnalysisInput<TEnv = Record<string, unknown>> {
  /** Ambiente base (valores atuais) */
  baseEnv: TEnv;
  /** Campo a variar (ex: "wall_thickness_mm") */
  parameter: string;
  /** Valores a testar */
  values: Array<number | string>;
  /** Função de cálculo que recebe o ambiente modificado e retorna a carga total em kcal/h */
  calculateFn: (env: TEnv) => number;
  /** Custo da energia elétrica em R$/kWh */
  energyCostBRL_kWh?: number;
  /** COP do sistema de refrigeração */
  cop?: number;
  /** Horas de operação por ano */
  operationHoursYear?: number;
}

export interface SensitivityAnalysisResult {
  parameter: string;
  baseValue: number | string;
  baseLoadKcalH: number;
  points: SensitivityPoint[];
  bestPoint: SensitivityPoint;
  worstPoint: SensitivityPoint;
  maxSavingBRL: number;
  maxSavingPercent: number;
}

const KCAL_H_TO_KW = 1 / 860;
const KCAL_H_TO_TR = 1 / 3024;

/**
 * Executa a análise de sensibilidade variando um parâmetro do ambiente.
 */
export function runSensitivityAnalysis<TEnv extends Record<string, unknown>>(
  input: SensitivityAnalysisInput<TEnv>,
): SensitivityAnalysisResult {
  const {
    baseEnv,
    parameter,
    values,
    calculateFn,
    energyCostBRL_kWh = 0.85,
    cop = 2.5,
    operationHoursYear = 8760,
  } = input;

  const baseLoadKcalH = calculateFn(baseEnv);
  const baseAnnualKwh = (baseLoadKcalH * KCAL_H_TO_KW / cop) * operationHoursYear;
  const baseAnnualCostBRL = baseAnnualKwh * energyCostBRL_kWh;

  const points: SensitivityPoint[] = values.map((value) => {
    const modifiedEnv = { ...baseEnv, [parameter]: value } as TEnv;
    const totalKcalH = calculateFn(modifiedEnv);
    const totalKw = totalKcalH * KCAL_H_TO_KW;
    const totalTR = totalKcalH * KCAL_H_TO_TR;
    const annualEnergyKwh = (totalKw / cop) * operationHoursYear;
    const annualCostBRL = annualEnergyKwh * energyCostBRL_kWh;
    const savingVsBaseKcalH = baseLoadKcalH - totalKcalH;
    const savingVsBaseBRL = baseAnnualCostBRL - annualCostBRL;
    const savingPercent = baseLoadKcalH > 0 ? (savingVsBaseKcalH / baseLoadKcalH) * 100 : 0;

    return {
      parameterValue: value,
      totalKcalH: Math.round(totalKcalH),
      totalKw: Math.round(totalKw * 10) / 10,
      totalTR: Math.round(totalTR * 10) / 10,
      annualEnergyKwh: Math.round(annualEnergyKwh),
      annualCostBRL: Math.round(annualCostBRL),
      savingVsBaseKcalH: Math.round(savingVsBaseKcalH),
      savingVsBaseBRL: Math.round(savingVsBaseBRL),
      savingPercent: Math.round(savingPercent * 10) / 10,
    };
  });

  const sortedByLoad = [...points].sort((a, b) => a.totalKcalH - b.totalKcalH);
  const bestPoint = sortedByLoad[0];
  const worstPoint = sortedByLoad[sortedByLoad.length - 1];
  const maxSavingBRL = Math.max(...points.map((p) => p.savingVsBaseBRL));
  const maxSavingPercent = Math.max(...points.map((p) => p.savingPercent));

  return {
    parameter,
    baseValue: baseEnv[parameter] as number | string,
    baseLoadKcalH: Math.round(baseLoadKcalH),
    points,
    bestPoint,
    worstPoint,
    maxSavingBRL,
    maxSavingPercent: Math.round(maxSavingPercent * 10) / 10,
  };
}

/**
 * Parâmetros pré-definidos para análise de sensibilidade rápida.
 */
export const SENSITIVITY_PRESETS = [
  {
    id: "wall_insulation",
    label: "Espessura do isolamento (parede)",
    parameter: "wall_thickness_mm",
    values: [75, 100, 125, 150, 200],
    unit: "mm",
  },
  {
    id: "compressor_hours",
    label: "Horas do compressor por dia",
    parameter: "compressor_runtime_hours_day",
    values: [12, 14, 16, 18, 20, 22],
    unit: "h/dia",
  },
  {
    id: "door_openings",
    label: "Aberturas de porta por dia",
    parameter: "door_openings_per_day",
    values: [5, 10, 20, 30, 50, 100],
    unit: "aberturas/dia",
  },
  {
    id: "safety_factor",
    label: "Fator de segurança",
    parameter: "safety_factor_percent",
    values: [5, 10, 15, 20, 25],
    unit: "%",
  },
  {
    id: "external_temp",
    label: "Temperatura externa",
    parameter: "external_temp_c",
    values: [30, 32, 35, 38, 40, 43],
    unit: "°C",
  },
] as const;

/**
 * Formata o resultado da análise para exibição em tabela.
 */
export function formatSensitivityTable(result: SensitivityAnalysisResult): string {
  const header = `Análise de Sensibilidade — ${result.parameter}\n`;
  const separator = "─".repeat(80) + "\n";
  const cols = ["Valor", "Carga (kcal/h)", "Carga (kW)", "Carga (TR)", "Custo/ano (R$)", "Economia (R$)", "Economia (%)"];
  const rows = result.points.map((p) => [
    String(p.parameterValue),
    p.totalKcalH.toLocaleString("pt-BR"),
    p.totalKw.toFixed(1),
    p.totalTR.toFixed(1),
    p.annualCostBRL.toLocaleString("pt-BR"),
    p.savingVsBaseBRL.toLocaleString("pt-BR"),
    `${p.savingPercent.toFixed(1)}%`,
  ]);

  const colWidths = cols.map((col, i) => Math.max(col.length, ...rows.map((r) => r[i].length)) + 2);
  const formatRow = (row: string[]) => row.map((cell, i) => cell.padStart(colWidths[i])).join(" | ");

  return [header, separator, formatRow(cols), separator, ...rows.map(formatRow), separator].join("\n");
}
