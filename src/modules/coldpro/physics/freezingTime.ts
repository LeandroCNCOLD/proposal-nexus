import { safeNumber } from "../core/units";

export type FreezingTimeValidationStatus = "adequate" | "insufficient" | "missing_data" | "invalid_input";

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

export function validateFreezingTime(params: { estimatedTimeMin?: number | null; availableTimeMin?: number | null; missingFields?: string[]; invalidFields?: string[] }) {
  const missingFields = (params?.missingFields ?? []).filter(Boolean);
  const invalidFields = (params?.invalidFields ?? []).filter(Boolean);
  const estimatedTimeMin = safeNumber(params?.estimatedTimeMin, NaN);
  const availableTimeMin = safeNumber(params?.availableTimeMin, NaN);

  if (invalidFields.length > 0 || estimatedTimeMin < 0 || availableTimeMin < 0) {
    return { status: "invalid_input" as FreezingTimeValidationStatus, warnings: ["Dados inválidos para validação do tempo até o núcleo."], marginPercent: null };
  }
  if (missingFields.length > 0 || !Number.isFinite(estimatedTimeMin) || !Number.isFinite(availableTimeMin) || availableTimeMin <= 0) {
    return { status: "missing_data" as FreezingTimeValidationStatus, warnings: ["Dados insuficientes para validar tempo estimado contra tempo disponível."], marginPercent: null };
  }

  const marginPercent = ((availableTimeMin - estimatedTimeMin) / availableTimeMin) * 100;
  return {
    status: estimatedTimeMin <= availableTimeMin ? "adequate" as FreezingTimeValidationStatus : "insufficient" as FreezingTimeValidationStatus,
    warnings: estimatedTimeMin <= availableTimeMin ? [] : ["Tempo estimado até o núcleo maior que o tempo disponível do processo."],
    marginPercent,
  };
}
