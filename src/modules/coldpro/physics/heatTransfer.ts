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

export function calculateTransmissionLoadKW(params: { areaM2?: number | null; uValueWM2K?: number | null; deltaTK?: number | null; internalTempC?: number | null; externalTempC?: number | null }) {
  return calculateTransmissionW(params) / 1000;
}

export function resolveTransmissionLoad(input: any) {
  const uValueWM2K = safeNumber(input?.uValueWM2K ?? input?.u_value_w_m2k ?? input?.overallUValueWM2K ?? input?.overall_u_value_w_m2k, 0);
  const directAreaM2 = safeNumber(input?.transmissionAreaM2 ?? input?.transmission_area_m2 ?? input?.envelopeAreaM2 ?? input?.envelope_area_m2, 0);
  const panelAreaM2 = safeNumber(input?.totalPanelAreaM2 ?? input?.total_panel_area_m2 ?? input?.panelAreaM2 ?? input?.panel_area_m2, 0);
  const wallAreaM2 = safeNumber(input?.wallAreaM2 ?? input?.wall_area_m2, 0);
  const doorAreaM2 = safeNumber(input?.totalDoorAreaM2 ?? input?.total_door_area_m2 ?? input?.doorAreaM2 ?? input?.door_area_m2, 0);
  const glassAreaM2 = safeNumber(input?.totalGlassAreaM2 ?? input?.total_glass_area_m2 ?? input?.glassAreaM2 ?? input?.glass_area_m2, 0);
  const areaM2 = directAreaM2 || panelAreaM2 || wallAreaM2 + doorAreaM2 + glassAreaM2;
  const internalTempC = safeNumber(input?.airTempC ?? input?.air_temp_c ?? input?.internalTempC ?? input?.internal_temp_c, 0);
  const externalTempC = safeNumber(input?.externalTempC ?? input?.external_temp_c, internalTempC);
  const deltaTK = input?.transmissionDeltaTK ?? input?.transmission_delta_t_k ?? Math.max(externalTempC - internalTempC, 0);
  const transmissionKW = calculateTransmissionLoadKW({ areaM2, uValueWM2K, deltaTK, internalTempC, externalTempC });

  return {
    transmissionKW: Number.isFinite(transmissionKW) ? transmissionKW : 0,
    transmissionW: Number.isFinite(transmissionKW) ? transmissionKW * 1000 : 0,
    areaM2,
    uValueWM2K,
    deltaTK: safeNumber(deltaTK, 0),
    internalTempC,
    externalTempC,
    method: "U × A × ΔT",
  };
}

export function calculateConvectiveCoefficient(params: { manualCoefficientWM2K?: number | null; airVelocityMS?: number | null; airExposureFactor?: number | null; exposureFactor?: number | null }) {
  const manual = safeNumber(params.manualCoefficientWM2K, 0);
  const airExposureFactor = safeNumber(params.airExposureFactor, 1) || 1;
  const exposureFactor = safeNumber(params.exposureFactor, 1) || 1;
  if (manual > 0) {
    return {
      hBaseWM2K: manual,
      hEffectiveWM2K: manual,
      source: "manual" as const,
      airExposureFactor,
      exposureFactor,
    };
  }

  const velocity = safeNumber(params.airVelocityMS, 0);
  if (velocity > 0) {
    const hBase = 10 + 10 * Math.pow(velocity, 0.8);
    const hEffective = hBase * airExposureFactor * exposureFactor;
    return {
      hBaseWM2K: hBase,
      hEffectiveWM2K: hEffective,
      source: "velocity_estimated" as const,
      airExposureFactor,
      exposureFactor,
    };
  }

  return {
    hBaseWM2K: null,
    hEffectiveWM2K: null,
    source: "missing" as const,
    airExposureFactor,
    exposureFactor,
  };
}
