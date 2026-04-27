import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

export type ProductLatentMode = "effective" | "full";

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
  latentMode?: ProductLatentMode | string | null;
  frozenWaterFraction?: number | null;
  latentResidualFactor?: number | null;
  allowPhaseChange?: boolean | null;
};

function clampFraction(value: number, fallback = 1) {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return Math.min(value, 1);
}

function resolveKJ(kjValue: unknown, kcalValue: unknown) {
  const kj = safeNumber(kjValue, 0);
  if (kj > 0) return kj;
  const kcal = safeNumber(kcalValue, 0);
  return kcal > 0 ? kcal * KCAL_TO_KJ : 0;
}

function resolveLatentMode(value: unknown): ProductLatentMode {
  return value === "full" ? "full" : "effective";
}

export function calculateProductSpecificEnergy(params: ProductSpecificEnergyInput) {
  const initialTempC = safeNumber(params?.initialTempC, 0);
  const finalTempC = safeNumber(params?.finalTempC, 0);
  const freezingPointC = safeNumber(params?.freezingPointC, -1.5);
  const cpAboveKJkgK = resolveKJ(params?.cpAboveKJkgK, params?.cpAboveKcalKgC);
  const cpBelowKJkgK = resolveKJ(params?.cpBelowKJkgK, params?.cpBelowKcalKgC);
  const latentHeatKJkg = resolveKJ(params?.latentHeatKJkg, params?.latentHeatKcalKg);
  const latentMode = resolveLatentMode(params?.latentMode);
  const frozenWaterFraction = clampFraction(safeNumber(params?.frozenWaterFraction, 1));
  const latentResidualFactor = clampFraction(safeNumber(params?.latentResidualFactor, 1));
  const latentEffectiveKJkg = latentMode === "full" ? latentHeatKJkg * frozenWaterFraction : latentHeatKJkg;
  const hasCoolingProcess = initialTempC > finalTempC;
  const reachesFreezingRegion = finalTempC < freezingPointC;
  const crossesFreezingPoint = params?.allowPhaseChange !== false && hasCoolingProcess && latentEffectiveKJkg > 0 && reachesFreezingRegion;

  if (crossesFreezingPoint) {
    const sensibleAboveKJkg = cpAboveKJkgK * Math.max(initialTempC - freezingPointC, 0);
    const latentKJkg = latentEffectiveKJkg;
    const belowStartC = Math.min(initialTempC, freezingPointC);
    const sensibleBelowKJkg = cpBelowKJkgK * Math.max(belowStartC - finalTempC, 0);
    const totalKJkg = sensibleAboveKJkg + latentKJkg + sensibleBelowKJkg;
    return {
      crossesFreezingPoint,
      cpAboveKJkgK,
      cpBelowKJkgK,
      latentHeatKJkg,
      frozenWaterFraction,
      latentMode,
      latentResidualFactor,
      latentEffectiveKJkg,
      sensibleAboveKcalKg: sensibleAboveKJkg / KCAL_TO_KJ,
      latentKcalKg: latentKJkg / KCAL_TO_KJ,
      sensibleBelowKcalKg: sensibleBelowKJkg / KCAL_TO_KJ,
      totalKcalKg: totalKJkg / KCAL_TO_KJ,
      sensibleAboveKJkg,
      latentKJkg,
      sensibleBelowKJkg,
      totalKJkg,
    };
  }

  const cpKJkgK = initialTempC <= freezingPointC && finalTempC < freezingPointC ? cpBelowKJkgK : cpAboveKJkgK;
  const sensibleKJkg = cpKJkgK * Math.abs(initialTempC - finalTempC);
  return {
    crossesFreezingPoint,
    cpAboveKJkgK,
    cpBelowKJkgK,
    latentHeatKJkg,
    frozenWaterFraction,
    latentMode,
    latentResidualFactor,
    latentEffectiveKJkg: 0,
    sensibleAboveKcalKg: sensibleKJkg / KCAL_TO_KJ,
    latentKcalKg: 0,
    sensibleBelowKcalKg: 0,
    totalKcalKg: sensibleKJkg / KCAL_TO_KJ,
    sensibleAboveKJkg: sensibleKJkg,
    latentKJkg: 0,
    sensibleBelowKJkg: 0,
    totalKJkg: sensibleKJkg,
  };
}

export function calculateContinuousProductLoadKW(params: { massKgH?: number | null; specificEnergyKcalKg?: number | null; specificEnergyKJkg?: number | null }) {
  const kjH = safeNumber(params.massKgH, 0) * safeNumber(params.specificEnergyKJkg, safeNumber(params.specificEnergyKcalKg, 0) * KCAL_TO_KJ);
  return kjH / 3600;
}

export function calculateBatchProductLoadKW(params: { massKg?: number | null; specificEnergyKcalKg?: number | null; specificEnergyKJkg?: number | null; timeH?: number | null }) {
  const timeH = safeNumber(params.timeH, 0);
  if (timeH <= 0) return 0;
  const kjH = safeNumber(params.massKg, 0) * safeNumber(params.specificEnergyKJkg, safeNumber(params.specificEnergyKcalKg, 0) * KCAL_TO_KJ) / timeH;
  return kjH / 3600;
}
