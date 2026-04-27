import { safeNumber } from "../core/units";

export type WaterLatentHeatMode = "evaporation" | "freezing" | "sublimation";
export type AirPropertiesSource = "automatic" | "manual_override" | "fallback";

export type AirPropertiesParams = {
  temperatureC?: number | null;
  altitudeM?: number | null;
  pressureKPa?: number | null;
  relativeHumidityPercent?: number | null;
  mode?: WaterLatentHeatMode;
  airDensityKgM3?: number | null;
  airSpecificHeatKJkgK?: number | null;
  waterLatentHeatKJkg?: number | null;
};

const FALLBACK_DENSITY_KG_M3 = 1.2;
const FALLBACK_CP_KJ_KG_K = 1.005;
const FALLBACK_PRESSURE_KPA = 101.325;
const RD_DRY_AIR = 287.05;
const RV_WATER_VAPOR = 461.495;

function isPositive(value: unknown): boolean {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function saturationVaporPressureKPa(tempC: number): number {
  return 0.61094 * Math.exp((17.625 * tempC) / (tempC + 243.04));
}

export function pressureFromAltitudeKPa(altitudeM?: number | null): number {
  const altitude = Math.max(0, safeNumber(altitudeM));
  return FALLBACK_PRESSURE_KPA * (1 - 2.25577e-5 * altitude) ** 5.25588;
}

export function getAirDensityKgM3(params: AirPropertiesParams = {}): number {
  if (isPositive(params.airDensityKgM3)) return safeNumber(params.airDensityKgM3);
  if (!Number.isFinite(Number(params.temperatureC))) return FALLBACK_DENSITY_KG_M3;

  const temperatureK = safeNumber(params.temperatureC) + 273.15;
  if (temperatureK <= 150) return FALLBACK_DENSITY_KG_M3;

  const pressureKPa = isPositive(params.pressureKPa) ? safeNumber(params.pressureKPa) : pressureFromAltitudeKPa(params.altitudeM);
  const rh = params.relativeHumidityPercent == null ? 0 : clamp(safeNumber(params.relativeHumidityPercent) / 100, 0, 1);
  const vaporPressureKPa = Math.min(rh * saturationVaporPressureKPa(safeNumber(params.temperatureC)), pressureKPa * 0.98);
  const dryPressurePa = Math.max(0, pressureKPa - vaporPressureKPa) * 1000;
  const vaporPressurePa = Math.max(0, vaporPressureKPa) * 1000;
  const density = dryPressurePa / (RD_DRY_AIR * temperatureK) + vaporPressurePa / (RV_WATER_VAPOR * temperatureK);

  return density > 0.6 && density < 1.8 ? density : FALLBACK_DENSITY_KG_M3;
}

export function getAirSpecificHeatKJkgK(params: AirPropertiesParams = {}): number {
  if (isPositive(params.airSpecificHeatKJkgK)) return safeNumber(params.airSpecificHeatKJkgK);
  if (!Number.isFinite(Number(params.temperatureC))) return FALLBACK_CP_KJ_KG_K;

  const tempC = safeNumber(params.temperatureC);
  const pressureKPa = isPositive(params.pressureKPa) ? safeNumber(params.pressureKPa) : pressureFromAltitudeKPa(params.altitudeM);
  const rh = params.relativeHumidityPercent == null ? 0 : clamp(safeNumber(params.relativeHumidityPercent) / 100, 0, 1);
  const pv = Math.min(rh * saturationVaporPressureKPa(tempC), pressureKPa * 0.98);
  const humidityRatio = 0.62198 * pv / Math.max(0.001, pressureKPa - pv);
  const dryCp = clamp(1.0035 + 0.00001 * tempC, 1.003, 1.006);
  const cp = (dryCp + humidityRatio * 1.86) / (1 + humidityRatio);

  return cp >= 1 && cp <= 1.04 ? cp : FALLBACK_CP_KJ_KG_K;
}

export function getWaterLatentHeatKJkg(params: AirPropertiesParams = {}): number {
  if (isPositive(params.waterLatentHeatKJkg)) return safeNumber(params.waterLatentHeatKJkg);
  const tempC = Number.isFinite(Number(params.temperatureC)) ? safeNumber(params.temperatureC) : 0;
  const mode = params.mode ?? "evaporation";
  if (mode === "freezing") return 333.5;
  const evaporation = clamp(2501 - 2.361 * tempC, 2300, 2600);
  if (mode === "sublimation") return evaporation + 333.5;
  return evaporation;
}

export function getWaterLatentHeat(mode: WaterLatentHeatMode, temperatureC = 0): number {
  return getWaterLatentHeatKJkg({ mode, temperatureC });
}

export function createAirPropertiesContext(params: AirPropertiesParams = {}) {
  const warnings: string[] = [];
  const hasManualDensity = isPositive(params.airDensityKgM3);
  const hasManualCp = isPositive(params.airSpecificHeatKJkgK);
  const hasManualLatent = isPositive(params.waterLatentHeatKJkg);
  const hasTemperature = Number.isFinite(Number(params.temperatureC));
  const temperatureC = hasTemperature ? safeNumber(params.temperatureC) : 20;
  const temperatureK = temperatureC + 273.15;

  if (!hasTemperature) warnings.push("Temperatura do ar ausente; propriedades do ar usam fallback técnico.");
  const pressureKPa = isPositive(params.pressureKPa) ? safeNumber(params.pressureKPa) : pressureFromAltitudeKPa(params.altitudeM);
  if (!isPositive(params.pressureKPa) && !isPositive(params.altitudeM)) warnings.push("Pressão/altitude ausente; pressão padrão ao nível do mar adotada.");

  const densityKgM3 = getAirDensityKgM3({ ...params, temperatureC });
  const specificHeatKJkgK = getAirSpecificHeatKJkgK({ ...params, temperatureC });
  const waterLatentHeatKJkg = getWaterLatentHeatKJkg({ ...params, temperatureC });
  const source: AirPropertiesSource = hasManualDensity || hasManualCp || hasManualLatent ? "manual_override" : hasTemperature ? "automatic" : "fallback";

  return {
    densityKgM3,
    specificHeatKJkgK,
    waterLatentHeatKJkg,
    pressureKPa,
    altitudeM: isPositive(params.altitudeM) ? safeNumber(params.altitudeM) : null,
    relativeHumidityPercent: params.relativeHumidityPercent == null ? null : clamp(safeNumber(params.relativeHumidityPercent), 0, 100),
    temperatureC,
    temperatureK,
    source,
    warnings,
  };
}