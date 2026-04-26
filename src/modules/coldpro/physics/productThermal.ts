import { safeNumber, roundColdPro } from "../core/units";

export function calculateProductSpecificEnergy(params: { initialTempC?: number | null; finalTempC?: number | null; freezingPointC?: number | null; cpAboveKJkgK?: number | null; cpBelowKJkgK?: number | null; latentHeatKJkg?: number | null; frozenWaterFraction?: number | null; allowPhaseChange?: boolean | null }) {
  const initial = safeNumber(params.initialTempC, 0);
  const final = safeNumber(params.finalTempC, 0);
  const freezing = safeNumber(params.freezingPointC, -1.5);
  const cpAbove = safeNumber(params.cpAboveKJkgK, 0);
  const cpBelow = safeNumber(params.cpBelowKJkgK, 0);
  const latent = safeNumber(params.latentHeatKJkg, 0);
  const fraction = Math.max(0, Math.min(1, safeNumber(params.frozenWaterFraction, 0)));
  const crossesFreezing = params.allowPhaseChange !== false && initial > freezing && final < freezing;
  const sensibleAboveKJkg = crossesFreezing ? cpAbove * Math.max(0, initial - freezing) : (final >= freezing ? cpAbove : cpBelow || cpAbove) * Math.abs(initial - final);
  const latentKJkg = crossesFreezing ? latent * fraction : 0;
  const sensibleBelowKJkg = crossesFreezing ? cpBelow * Math.max(0, freezing - final) : 0;
  const totalKJkg = sensibleAboveKJkg + latentKJkg + sensibleBelowKJkg;
  return {
    crossesFreezing,
    sensibleAboveKJkg: roundColdPro(sensibleAboveKJkg, 4),
    latentKJkg: roundColdPro(latentKJkg, 4),
    sensibleBelowKJkg: roundColdPro(sensibleBelowKJkg, 4),
    totalKJkg: roundColdPro(totalKJkg, 4),
  };
}

export function calculateContinuousProductLoadKW(params: { massKgH?: number | null; specificEnergyKJkg?: number | null }) {
  return roundColdPro(Math.max(0, safeNumber(params.massKgH, 0)) * Math.max(0, safeNumber(params.specificEnergyKJkg, 0)) / 3600, 4);
}

export function calculateBatchProductLoadKW(params: { massKg?: number | null; specificEnergyKJkg?: number | null; timeH?: number | null }) {
  const timeH = safeNumber(params.timeH, 0);
  if (timeH <= 0) return 0;
  return roundColdPro(Math.max(0, safeNumber(params.massKg, 0)) * Math.max(0, safeNumber(params.specificEnergyKJkg, 0)) / (timeH * 3600), 4);
}
