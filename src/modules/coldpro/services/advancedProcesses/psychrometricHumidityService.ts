export const AIR_DENSITY_KG_M3 = 1.2;
export const AIR_CP_KJ_KG_K = 1.005;
export const WATER_LATENT_HEAT_KJ_KG = 2500;

export function roundAdvanced(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function saturationVaporPressureKpa(tempC: number) {
  return 0.61078 * Math.exp((17.2694 * tempC) / (tempC + 237.29));
}

export function humidityRatioKgKg(params: {
  temperatureC?: number | null;
  relativeHumidityPercent?: number | null;
  atmosphericPressureKpa?: number | null;
}) {
  const tempC = toNumber(params.temperatureC);
  const rh = Math.max(0, Math.min(1, toNumber(params.relativeHumidityPercent) / 100));
  const pressure = toNumber(params.atmosphericPressureKpa, 101.325) || 101.325;
  const pws = saturationVaporPressureKpa(tempC);
  const pv = rh * pws;
  if (pressure <= pv || pressure <= 0) return 0;
  return 0.62198 * pv / (pressure - pv);
}

export function sensiblePurgeLoadKw(params: {
  airflowM3H?: number | null;
  externalTemperatureC?: number | null;
  internalTemperatureC?: number | null;
}) {
  const airflowM3S = Math.max(0, toNumber(params.airflowM3H)) / 3600;
  const deltaT = Math.max(0, toNumber(params.externalTemperatureC) - toNumber(params.internalTemperatureC));
  return AIR_DENSITY_KG_M3 * airflowM3S * AIR_CP_KJ_KG_K * deltaT;
}
