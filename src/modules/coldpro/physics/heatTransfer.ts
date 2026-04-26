import { COLDPRO_CONSTANTS } from "../core/constants";
import { safeNumber } from "../core/units";

export function calculateUValue(layers: Array<{ thicknessM?: number | null; thickness_m?: number | null; conductivityWMK?: number | null; conductivity_w_mk?: number | null }>) {
  const layerResistance = layers.reduce((sum, layer) => {
    const thicknessM = safeNumber(layer.thicknessM ?? layer.thickness_m, 0);
    const conductivityWMK = safeNumber(layer.conductivityWMK ?? layer.conductivity_w_mk, 0);
    if (thicknessM <= 0 || conductivityWMK <= 0) return sum;
    return sum + thicknessM / conductivityWMK;
  }, 0);

  const totalResistance = COLDPRO_CONSTANTS.R_INTERNAL_M2K_W + layerResistance + COLDPRO_CONSTANTS.R_EXTERNAL_M2K_W;
  return totalResistance > 0 ? 1 / totalResistance : null;
}

export function calculateTransmissionW(params: { areaM2?: number | null; uValueWM2K?: number | null; deltaTK?: number | null; internalTempC?: number | null; externalTempC?: number | null }) {
  const areaM2 = safeNumber(params.areaM2, 0);
  const uValueWM2K = safeNumber(params.uValueWM2K, 0);
  const deltaTK = params.deltaTK !== undefined && params.deltaTK !== null
    ? safeNumber(params.deltaTK, 0)
    : safeNumber(params.externalTempC, 0) - safeNumber(params.internalTempC, 0);

  return areaM2 * uValueWM2K * Math.max(deltaTK, 0);
}

export function calculateConvectiveCoefficient(params: { manualCoefficientWM2K?: number | null; airVelocityMS?: number | null; airExposureFactor?: number | null }) {
  const manual = safeNumber(params.manualCoefficientWM2K, 0);
  if (manual > 0) {
    return {
      hBaseWM2K: manual,
      hEffectiveWM2K: manual,
      source: "manual" as const,
    };
  }

  const velocity = safeNumber(params.airVelocityMS, 0);
  if (velocity > 0) {
    const hBase = 10 + 10 * Math.pow(velocity, 0.8);
    const hEffective = hBase * safeNumber(params.airExposureFactor, 1);
    return {
      hBaseWM2K: hBase,
      hEffectiveWM2K: hEffective,
      source: "velocity_estimated" as const,
    };
  }

  return {
    hBaseWM2K: null,
    hEffectiveWM2K: null,
    source: "missing" as const,
  };
}
