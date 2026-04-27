import { safeNumber } from "../core/units";

type ProductSpecificEnergyInput = {
  initialTempC?: number | null;
  finalTempC?: number | null;
  freezingPointC?: number | null;
  cpAboveKJkgK?: number | null;
  cpBelowKJkgK?: number | null;
  latentHeatKJkg?: number | null;
  frozenWaterFraction?: number | null;
  allowPhaseChange?: boolean | null;
};

export function calculateProductSpecificEnergy(params: ProductSpecificEnergyInput) {
  const initialTempC = safeNumber(params?.initialTempC, 0);
  const finalTempC = safeNumber(params?.finalTempC, 0);
  const freezingPointC = safeNumber(params?.freezingPointC, -1.5);
  const cpAboveKJkgK = safeNumber(params?.cpAboveKJkgK, 0);
  const cpBelowKJkgK = safeNumber(params?.cpBelowKJkgK, 0);
  const latentHeatKJkg = safeNumber(params?.latentHeatKJkg, 0);
  const frozenWaterFraction = safeNumber(params?.frozenWaterFraction, 0);
  const hasCoolingProcess = initialTempC > finalTempC;
  const hasPhaseChangeProperties = latentHeatKJkg > 0 && frozenWaterFraction > 0;
  const reachesFreezingRegion = initialTempC > freezingPointC && finalTempC <= 0;
  const crossesFreezingPoint = params?.allowPhaseChange !== false && hasCoolingProcess && hasPhaseChangeProperties && reachesFreezingRegion;

  if (crossesFreezingPoint) {
    const sensibleAboveKJkg = cpAboveKJkgK * Math.max(initialTempC - freezingPointC, 0);
    const latentKJkg = latentHeatKJkg * frozenWaterFraction;
    const sensibleBelowKJkg = cpBelowKJkgK * Math.max(freezingPointC - finalTempC, 0);
    return {
      crossesFreezingPoint,
      sensibleAboveKJkg,
      latentKJkg,
      sensibleBelowKJkg,
      totalKJkg: sensibleAboveKJkg + latentKJkg + sensibleBelowKJkg,
    };
  }

  const cp = finalTempC < freezingPointC ? cpBelowKJkgK : cpAboveKJkgK;
  const sensibleKJkg = cp * Math.abs(initialTempC - finalTempC);
  return {
    crossesFreezingPoint,
    sensibleAboveKJkg: sensibleKJkg,
    latentKJkg: 0,
    sensibleBelowKJkg: 0,
    totalKJkg: sensibleKJkg,
  };
}

export function calculateContinuousProductLoadKW(params: { massKgH?: number | null; specificEnergyKJkg?: number | null }) {
  return safeNumber(params.massKgH, 0) * safeNumber(params.specificEnergyKJkg, 0) / 3600;
}

export function calculateBatchProductLoadKW(params: { massKg?: number | null; specificEnergyKJkg?: number | null; timeH?: number | null }) {
  const timeH = safeNumber(params.timeH, 0);
  if (timeH <= 0) return 0;
  return safeNumber(params.massKg, 0) * safeNumber(params.specificEnergyKJkg, 0) / (timeH * 3600);
}
