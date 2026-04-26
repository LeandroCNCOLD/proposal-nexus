import { COLDPRO_CONSTANTS } from "../core/constants";
import { safeNumber, roundColdPro } from "../core/units";

export function calculateUValue(layers: Array<{ thickness_m?: number | null; conductivity_w_mk?: number | null }>) {
  const layerResistance = layers.reduce((sum, layer) => {
    const thickness = safeNumber(layer.thickness_m, 0);
    const conductivity = safeNumber(layer.conductivity_w_mk, 0);
    return conductivity > 0 && thickness > 0 ? sum + thickness / conductivity : sum;
  }, 0);
  const totalResistance = COLDPRO_CONSTANTS.R_INTERNAL_M2K_W + layerResistance + COLDPRO_CONSTANTS.R_EXTERNAL_M2K_W;
  return totalResistance > 0 ? roundColdPro(1 / totalResistance, 5) : null;
}

export function calculateTransmissionW(params: { areaM2?: number | null; uValueWM2K?: number | null; internalTempC?: number | null; externalTempC?: number | null }) {
  const area = safeNumber(params.areaM2, 0);
  const u = safeNumber(params.uValueWM2K, 0);
  const deltaT = Math.max(0, safeNumber(params.externalTempC, 0) - safeNumber(params.internalTempC, 0));
  return roundColdPro(area * u * deltaT, 3);
}

export function calculateConvectiveCoefficient(params: { manualConvectiveCoefficientWM2K?: number | null; convective_coefficient_manual_w_m2_k?: number | null; airVelocityMS?: number | null; airExposureFactor?: number | null }) {
  const manual = safeNumber(params.manualConvectiveCoefficientWM2K ?? params.convective_coefficient_manual_w_m2_k, 0);
  if (manual > 0) return { hBaseWM2K: roundColdPro(manual, 4), hEffectiveWM2K: roundColdPro(manual, 4), source: "manual" as const };
  const velocity = safeNumber(params.airVelocityMS, 0);
  if (velocity <= 0) return { hBaseWM2K: null, hEffectiveWM2K: null, source: "missing" as const };
  const hBase = 10 + 10 * Math.pow(velocity, 0.8);
  const hEffective = hBase * Math.max(0.01, safeNumber(params.airExposureFactor, 1));
  return { hBaseWM2K: roundColdPro(hBase, 4), hEffectiveWM2K: roundColdPro(hEffective, 4), source: "velocity" as const };
}
