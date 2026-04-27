import { safeNumber } from "../core/units";

type ProductSpecificEnergyInput = {
  initialTempC?: number | null;
  finalTempC?: number | null;
  freezingPointC?: number | null;
  cpAboveKcalKgC?: number | null;
  cpBelowKcalKgC?: number | null;
  latentHeatKcalKg?: number | null;
  cpAboveKJkgK?: number | null;
  cpBelowKJkgK?: number | null;
  latentHeatKJkg?: number | null;
  frozenWaterFraction?: number | null;
  latentResidualFactor?: number | null;
  allowPhaseChange?: boolean | null;
};

function clampFraction(value: number, fallback = 1) {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, 1);
}

export function calculateProductSpecificEnergy(params: ProductSpecificEnergyInput) {
  const initialTempC = safeNumber(params?.initialTempC, 0);
  const finalTempC = safeNumber(params?.finalTempC, 0);
  const freezingPointC = safeNumber(params?.freezingPointC, -1.5);
  const cpAboveKcalKgC = safeNumber(params?.cpAboveKcalKgC, safeNumber(params?.cpAboveKJkgK, 0) / 4.1868);
  const cpBelowKcalKgC = safeNumber(params?.cpBelowKcalKgC, safeNumber(params?.cpBelowKJkgK, 0) / 4.1868);
  const latentHeatKcalKg = safeNumber(params?.latentHeatKcalKg, safeNumber(params?.latentHeatKJkg, 0) / 4.1868);
  const frozenWaterFraction = clampFraction(safeNumber(params?.frozenWaterFraction, 1));
  const latentResidualFactor = clampFraction(safeNumber(params?.latentResidualFactor, 1));
  const hasCoolingProcess = initialTempC > finalTempC;
  const reachesFreezingRegion = finalTempC < freezingPointC;
  const crossesFreezingPoint = params?.allowPhaseChange !== false && hasCoolingProcess && latentHeatKcalKg > 0 && frozenWaterFraction > 0 && reachesFreezingRegion;

  if (crossesFreezingPoint) {
    const sensibleAboveKcalKg = cpAboveKcalKgC * Math.max(initialTempC - freezingPointC, 0);
    // CORREÇÃO: Se latente já está preenchido na base, usar direto SEM multiplicar por fração
    // Fração congelável deve ser usada APENAS como origem/auditoria
    const latentKcalKg = latentHeatKcalKg * latentResidualFactor;
    const belowStartC = Math.min(initialTempC, freezingPointC);
    const sensibleBelowKcalKg = cpBelowKcalKgC * Math.max(belowStartC - finalTempC, 0);
    return {
      crossesFreezingPoint,
      sensibleAboveKcalKg,
      latentKcalKg,
      sensibleBelowKcalKg,
      totalKcalKg: sensibleAboveKcalKg + latentKcalKg + sensibleBelowKcalKg,
      sensibleAboveKJkg: sensibleAboveKcalKg * 4.1868,
      latentKJkg: latentKcalKg * 4.1868,
      sensibleBelowKJkg: sensibleBelowKcalKg * 4.1868,
      totalKJkg: (sensibleAboveKcalKg + latentKcalKg + sensibleBelowKcalKg) * 4.1868,
    };
  }

  const cp = initialTempC <= freezingPointC && finalTempC < freezingPointC ? cpBelowKcalKgC : cpAboveKcalKgC;
  const sensibleKcalKg = cp * Math.abs(initialTempC - finalTempC);
  return {
    crossesFreezingPoint,
    sensibleAboveKcalKg: sensibleKcalKg,
    latentKcalKg: 0,
    sensibleBelowKcalKg: 0,
    totalKcalKg: sensibleKcalKg,
    sensibleAboveKJkg: sensibleKcalKg * 4.1868,
    latentKJkg: 0,
    sensibleBelowKJkg: 0,
    totalKJkg: sensibleKcalKg * 4.1868,
  };
}

export function calculateContinuousProductLoadKW(params: { massKgH?: number | null; specificEnergyKcalKg?: number | null; specificEnergyKJkg?: number | null }) {
  const kcalH = safeNumber(params.massKgH, 0) * safeNumber(params.specificEnergyKcalKg, safeNumber(params.specificEnergyKJkg, 0) / 4.1868);
  return kcalH / 859.845;
}

export function calculateBatchProductLoadKW(params: { massKg?: number | null; specificEnergyKcalKg?: number | null; specificEnergyKJkg?: number | null; timeH?: number | null }) {
  const timeH = safeNumber(params.timeH, 0);
  if (timeH <= 0) return 0;
  const kcalH = safeNumber(params.massKg, 0) * safeNumber(params.specificEnergyKcalKg, safeNumber(params.specificEnergyKJkg, 0) / 4.1868) / timeH;
  return kcalH / 859.845;
}
