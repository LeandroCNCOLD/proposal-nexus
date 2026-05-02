import {
  calculateKfcalcCompat,
  type KfcalcCompatInput,
  type KfcalcCompatResult,
} from "./kfcalcCompatEngine";

export type AuditStatus = "OK" | "ATENÇÃO" | "DIVERGENTE";

export type ThermalAuditCase = {
  id: string;
  name: string;
  externalSystem: "KFCalc" | "SEQCT" | string;
  inputs: KfcalcCompatInput;
  expectedTotalKcalH?: number | null;
  coldproTotalKcalH?: number | null;
};

export type ThermalAuditComparison = {
  absoluteDifferenceKcalH: number;
  percentDifference: number;
  status: AuditStatus;
};

export type ThermalAuditCaseResult = {
  id: string;
  name: string;
  externalSystem: string;
  inputs: KfcalcCompatInput;
  kfcalcResult: KfcalcCompatResult;
  coldproResult: {
    totalKcalH: number;
  };
  comparison: ThermalAuditComparison;
  diagnosis: string[];
  recommendations: string[];
};

export type ThermalAuditReport = {
  cases: ThermalAuditCaseResult[];
  summary: {
    totalCases: number;
    ok: number;
    warning: number;
    divergent: number;
    mainDivergenceCauses: string[];
  };
};

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function statusFromPercent(absPercent: number): AuditStatus {
  if (absPercent <= 5) return "OK";
  if (absPercent <= 15) return "ATENÇÃO";
  return "DIVERGENTE";
}

function diagnose(input: KfcalcCompatInput, comparison: ThermalAuditComparison): string[] {
  const causes: string[] = [];
  if (comparison.status === "OK") return ["Diferença dentro da tolerância técnica."];
  if ((input.trocasDia ?? 0) > 0 && (input.numeroTrocas ?? 0) > 0) {
    causes.push("Possível duplicidade entre infiltração e trocas de ar.");
  }
  if ((input.massaProdutoKg ?? 0) <= 0 || (input.cpProdutoKcalKgC ?? 0) <= 0) {
    causes.push("Produto simplificado ou dados de massa/Cp ausentes.");
  }
  if ((input.fatorSeguranca ?? 1.1) !== 1.1) {
    causes.push("Diferença de fator de segurança.");
  }
  if ((input.potenciaMotoresW ?? 0) <= 0 && (input.potenciaIluminacaoW ?? 0) <= 0) {
    causes.push("Motores/iluminação ausentes ou zerados.");
  }
  if ((input.numeroPessoas ?? 0) <= 0) {
    causes.push("Carga de pessoas ausente ou zerada.");
  }
  if (causes.length === 0)
    causes.push("Diferença de unidade, tempo de processo ou metodologia avançada.");
  return causes;
}

function recommendationsFrom(causes: string[]): string[] {
  return causes.map((cause) => {
    if (cause.includes("duplicidade"))
      return "Revisar se infiltração e trocas de ar são componentes independentes no caso.";
    if (cause.includes("Produto"))
      return "Adicionar massa, Cp e tempo de processo para recalcular produto fisicamente.";
    if (cause.includes("segurança"))
      return "Padronizar fator de segurança entre KFCalc/SEQCT e ColdPro.";
    if (cause.includes("Motores")) return "Informar potência total de motores e iluminação.";
    if (cause.includes("pessoas")) return "Informar número de pessoas em operação.";
    return "Revisar unidades de entrada e premissas de cálculo do caso.";
  });
}

export function compareThermalCase(testCase: ThermalAuditCase): ThermalAuditCaseResult {
  const kfcalcResult = calculateKfcalcCompat(testCase.inputs);
  const coldproTotalKcalH =
    testCase.coldproTotalKcalH ??
    testCase.expectedTotalKcalH ??
    kfcalcResult.totalComSegurancaKcalH;
  const absoluteDifferenceKcalH = coldproTotalKcalH - kfcalcResult.totalComSegurancaKcalH;
  const percentDifference =
    kfcalcResult.totalComSegurancaKcalH > 0
      ? (absoluteDifferenceKcalH / kfcalcResult.totalComSegurancaKcalH) * 100
      : 0;
  const comparison = {
    absoluteDifferenceKcalH: round(absoluteDifferenceKcalH, 2),
    percentDifference: round(percentDifference, 4),
    status: statusFromPercent(Math.abs(percentDifference)),
  };
  const diagnosis = diagnose(testCase.inputs, comparison);
  return {
    id: testCase.id,
    name: testCase.name,
    externalSystem: testCase.externalSystem,
    inputs: testCase.inputs,
    kfcalcResult,
    coldproResult: { totalKcalH: round(coldproTotalKcalH, 2) },
    comparison,
    diagnosis,
    recommendations: recommendationsFrom(diagnosis),
  };
}

export function buildThermalAuditReport(cases: ThermalAuditCase[]): ThermalAuditReport {
  const results = cases.map(compareThermalCase);
  const causeCounts = new Map<string, number>();
  for (const item of results) {
    for (const cause of item.diagnosis) causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + 1);
  }
  return {
    cases: results,
    summary: {
      totalCases: results.length,
      ok: results.filter((item) => item.comparison.status === "OK").length,
      warning: results.filter((item) => item.comparison.status === "ATENÇÃO").length,
      divergent: results.filter((item) => item.comparison.status === "DIVERGENTE").length,
      mainDivergenceCauses: Array.from(causeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cause]) => cause),
    },
  };
}
