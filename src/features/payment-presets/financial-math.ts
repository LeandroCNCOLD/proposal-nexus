// Cálculos puros — sem React, testáveis.
// Regra crítica: a base de cálculo é SEMPRE o valor original da proposta.
// Recálculos substituem o resultado anterior, NUNCA acumulam taxa sobre taxa.

export type FinancialRateType = "compostos" | "simples";

export interface InstallmentInput {
  description: string;
  percentage: number; // %
  days: number; // prazo em dias
}

export interface InstallmentComputed extends InstallmentInput {
  value: number; // valor calculado em R$
}

const PCT_TOLERANCE = 0.01;

export function roundCurrency(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function sumPercentages(installments: InstallmentInput[]): number {
  return installments.reduce((acc, i) => acc + (Number(i.percentage) || 0), 0);
}

export function isPercentageSumValid(installments: InstallmentInput[]): boolean {
  return Math.abs(sumPercentages(installments) - 100) <= PCT_TOLERANCE;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateInstallments(installments: InstallmentInput[]): ValidationResult {
  const errors: string[] = [];
  if (!installments || installments.length === 0) {
    errors.push("Inclua ao menos uma parcela.");
    return { ok: false, errors };
  }
  for (const [i, inst] of installments.entries()) {
    if (!inst.description || !inst.description.trim()) {
      errors.push(`Parcela ${i + 1}: descrição é obrigatória.`);
    }
    if (!Number.isFinite(inst.percentage) || inst.percentage < 0) {
      errors.push(`Parcela ${i + 1}: percentual não pode ser negativo.`);
    }
    if (!Number.isFinite(inst.days) || inst.days < 0) {
      errors.push(`Parcela ${i + 1}: prazo não pode ser negativo.`);
    }
  }
  if (!isPercentageSumValid(installments)) {
    errors.push(
      `A soma dos percentuais deve ser 100% (atual: ${sumPercentages(installments).toFixed(2)}%).`,
    );
  }
  return { ok: errors.length === 0, errors };
}

// PMR ponderado: Σ(% * dias) / Σ(%)
export function computeAverageTerm(installments: InstallmentInput[]): number {
  const totalPct = sumPercentages(installments);
  if (totalPct <= 0) return 0;
  const weighted = installments.reduce(
    (acc, i) => acc + (Number(i.percentage) || 0) * (Number(i.days) || 0),
    0,
  );
  return weighted / totalPct;
}

// Fator (decimal): aplicado sobre o valor original
export function computeFinancialFactor(params: {
  monthlyRatePct: number;
  averageTermDays: number;
  type: FinancialRateType;
}): number {
  const r = (Number(params.monthlyRatePct) || 0) / 100;
  const t = (Number(params.averageTermDays) || 0) / 30;
  if (r <= 0 || t <= 0) return 0;
  if (params.type === "simples") return r * t;
  return Math.pow(1 + r, t) - 1;
}

export interface FinancialResult {
  averageTermDays: number;
  factor: number; // decimal
  factorPct: number; // % com 4 casas
  additionalCost: number; // R$
  finalAmount: number; // R$
  installments: InstallmentComputed[]; // recalculadas sobre finalAmount
  totalInstallments: number;
  diffPct: number; // (finalAmount - originalAmount) / originalAmount * 100
}

export function computeFinancial(params: {
  originalAmount: number;
  monthlyRatePct: number;
  type: FinancialRateType;
  installments: InstallmentInput[];
}): FinancialResult {
  const original = Number(params.originalAmount) || 0;
  const averageTermDays = computeAverageTerm(params.installments);
  const factor = computeFinancialFactor({
    monthlyRatePct: params.monthlyRatePct,
    averageTermDays,
    type: params.type,
  });
  const additionalCost = roundCurrency(original * factor);
  const finalAmount = roundCurrency(original + additionalCost);

  const installments: InstallmentComputed[] = params.installments.map((i) => ({
    description: i.description,
    percentage: Number(i.percentage) || 0,
    days: Number(i.days) || 0,
    value: roundCurrency(finalAmount * ((Number(i.percentage) || 0) / 100)),
  }));

  const totalInstallments = roundCurrency(
    installments.reduce((acc, i) => acc + i.value, 0),
  );

  const diffPct = original > 0 ? ((finalAmount - original) / original) * 100 : 0;

  return {
    averageTermDays,
    factor,
    factorPct: Number((factor * 100).toFixed(4)),
    additionalCost,
    finalAmount,
    installments,
    totalInstallments,
    diffPct,
  };
}
