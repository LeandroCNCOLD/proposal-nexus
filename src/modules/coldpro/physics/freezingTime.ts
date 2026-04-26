import { safeNumber } from "../core/units";

export function calculatePlankFreezingTimeMin(params: any) {
  const densityKgM3 = safeNumber(params?.densityKgM3, 0);
  const latentHeatKJkg = safeNumber(params?.latentHeatKJkg, 0);
  const frozenWaterFraction = safeNumber(params?.frozenWaterFraction, 0);
  const freezingPointC = safeNumber(params?.freezingPointC, 0);
  const airTempC = safeNumber(params?.airTempC, 0);
  const distanceToCoreM = safeNumber(params?.distanceToCoreM, 0);
  const hEffectiveWM2K = safeNumber(params?.hEffectiveWM2K, 0);
  const kEffectiveWMK = safeNumber(params?.kEffectiveWMK, 0);
  const deltaT = freezingPointC - airTempC;

  if (densityKgM3 <= 0 || latentHeatKJkg <= 0 || frozenWaterFraction <= 0 || deltaT <= 0 || distanceToCoreM <= 0 || hEffectiveWM2K <= 0 || kEffectiveWMK <= 0) {
    return null;
  }

  const latentHeatJkg = latentHeatKJkg * frozenWaterFraction * 1000;
  const timeSeconds = (densityKgM3 * latentHeatJkg / deltaT) * (distanceToCoreM / hEffectiveWM2K + Math.pow(distanceToCoreM, 2) / (2 * kEffectiveWMK));
  return timeSeconds / 60;
}
