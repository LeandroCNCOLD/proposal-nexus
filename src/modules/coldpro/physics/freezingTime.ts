import { safeNumber, roundColdPro } from "../core/units";

export function calculatePlankFreezingTimeMin(params: { densityKgM3?: number | null; latentHeatKJkg?: number | null; frozenWaterFraction?: number | null; freezingPointC?: number | null; airTempC?: number | null; distanceToCoreM?: number | null; hEffectiveWM2K?: number | null; kEffectiveWMK?: number | null }) {
  const density = safeNumber(params.densityKgM3, 0);
  const latent = safeNumber(params.latentHeatKJkg, 0);
  const fraction = safeNumber(params.frozenWaterFraction, 0);
  const deltaT = safeNumber(params.freezingPointC, 0) - safeNumber(params.airTempC, 0);
  const distance = safeNumber(params.distanceToCoreM, 0);
  const h = safeNumber(params.hEffectiveWM2K, 0);
  const k = safeNumber(params.kEffectiveWMK, 0);
  if (density <= 0 || latent <= 0 || fraction <= 0 || deltaT <= 0 || distance <= 0 || h <= 0 || k <= 0) return null;
  const latentEffectiveJkg = latent * fraction * 1000;
  const seconds = (density * latentEffectiveJkg / deltaT) * (distance / h + (distance * distance) / (2 * k));
  return roundColdPro(seconds / 60, 2);
}
