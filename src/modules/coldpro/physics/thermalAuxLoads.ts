export type ThermalAuxLoadResult = {
  kW: number;
  kcalH: number;
};

export type DefrostFactorRange = {
  requested: number;
  applied: number;
  wasClamped: boolean;
};

const KCAL_H_PER_KW = 860;
const MIN_DEFROST_FACTOR = 0.1;
const MAX_DEFROST_FACTOR = 0.3;

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function fromKcalH(kcalH: number): ThermalAuxLoadResult {
  const safeKcalH = positiveNumber(kcalH);
  return {
    kcalH: safeKcalH,
    kW: safeKcalH / KCAL_H_PER_KW,
  };
}

function fromKW(kW: number): ThermalAuxLoadResult {
  const safeKW = positiveNumber(kW);
  return {
    kW: safeKW,
    kcalH: safeKW * KCAL_H_PER_KW,
  };
}

export function calculateMotorLoad(powerTotalKW: number | null | undefined): ThermalAuxLoadResult {
  return fromKW(positiveNumber(powerTotalKW));
}

export function calculateLightingLoad(
  powerTotalW: number | null | undefined,
): ThermalAuxLoadResult {
  return fromKcalH(positiveNumber(powerTotalW) * 0.86);
}

export function calculatePeopleLoad(peopleCount: number | null | undefined): ThermalAuxLoadResult {
  return fromKcalH(positiveNumber(peopleCount) * 300);
}

export function normalizeDefrostFactor(factor: number | null | undefined): DefrostFactorRange {
  const requested = positiveNumber(factor);
  if (requested <= 0) return { requested: 0, applied: 0, wasClamped: false };
  const applied = Math.min(MAX_DEFROST_FACTOR, Math.max(MIN_DEFROST_FACTOR, requested));
  return {
    requested,
    applied,
    wasClamped: applied !== requested,
  };
}

export function calculateDefrostLoad(params: {
  evaporatorLoadKW?: number | null;
  evaporatorLoadKcalH?: number | null;
  defrostFactor?: number | null;
}): ThermalAuxLoadResult & { factor: DefrostFactorRange } {
  const factor = normalizeDefrostFactor(params.defrostFactor);
  const evaporatorLoadKcalH =
    positiveNumber(params.evaporatorLoadKcalH) ||
    positiveNumber(params.evaporatorLoadKW) * KCAL_H_PER_KW;
  return {
    ...fromKcalH(evaporatorLoadKcalH * factor.applied),
    factor,
  };
}
