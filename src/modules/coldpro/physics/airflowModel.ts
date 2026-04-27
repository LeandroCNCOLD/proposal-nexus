import { safeNumber } from "../core/units";
import { resolveAirflowSection } from "../core/airflowSection";

export type AirflowSource = "manual_velocity" | "airflow_by_fans";

function positive(value: unknown): number {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

export function normalizeBlockageFactor(value: unknown, inputMode: "percent" | "decimal" | "auto" = "auto"): number {
  const raw = safeNumber(value, 0);
  if (raw <= 0) return 0;
  if (inputMode === "percent") return Math.min(Math.max(raw / 100, 0), 1);
  if (inputMode === "decimal") return Math.min(Math.max(raw, 0), 1);
  return Math.min(Math.max(raw > 1 ? raw / 100 : raw, 0), 1);
}

export function calculateAirflowModel(input: any) {
  const rawSource = input?.airflowSource ?? input?.airflow_source;
  const airflowSource = (rawSource || "manual_velocity") as AirflowSource;
  const warnings: string[] = rawSource ? [] : ["Fonte da velocidade do ar assumida como manual."];
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  if (airflowSource !== "airflow_by_fans") {
    const airVelocityUsedMS = positive(input?.airVelocityMS ?? input?.air_velocity_m_s) || null;
    if (!airVelocityUsedMS) missingFields.push("velocidade manual do ar");
    return {
      airflowSource: "manual_velocity",
      fanAirflowM3H: null,
      grossAreaM2: null,
      freeAreaM2: null,
      blockageFactor: 0,
      calculatedAirVelocityMS: null,
      airVelocityUsedMS,
      source: "manual_velocity",
      warnings,
      missingFields,
      invalidFields,
    };
  }

  const fanAirflowM3H = positive(input?.fanAirflowM3H ?? input?.fan_airflow_m3_h);
  const section = resolveAirflowSection(input);
  const blockageFactorDecimal = section.blockageFactor;
  const blockageFactor = Math.min(Math.max(blockageFactorDecimal, 0), 0.95);
  if (blockageFactorDecimal >= 0.95) invalidFields.push("fator de bloqueio excessivo");
  if (fanAirflowM3H <= 0) missingFields.push("vazão de ar dos ventiladores");
  missingFields.push(...section.missingFields);
  warnings.push(...section.warnings);

  const grossAreaM2 = section.grossAreaM2;
  const freeAreaM2 = section.freeAreaM2;
  if (grossAreaM2 !== null && (!freeAreaM2 || freeAreaM2 <= 0)) invalidFields.push("área livre de passagem do ar");
  const calculatedAirVelocityMS = fanAirflowM3H > 0 && freeAreaM2 && freeAreaM2 > 0 ? fanAirflowM3H / 3600 / freeAreaM2 : null;
  if (calculatedAirVelocityMS !== null && calculatedAirVelocityMS > 15) warnings.push("Velocidade de ar calculada muito alta. Verificar vazão, seção livre e bloqueio.");
  if (calculatedAirVelocityMS !== null && calculatedAirVelocityMS < 0.1) warnings.push("Velocidade de ar calculada muito baixa para congelamento/resfriamento eficiente.");

  return {
    airflowSource,
    fanAirflowM3H: fanAirflowM3H || null,
    grossAreaM2,
    freeAreaM2,
    blockageFactor,
    calculatedAirVelocityMS,
    airVelocityUsedMS: calculatedAirVelocityMS,
    source: section.source,
    sectionSource: section.source,
    warnings,
    missingFields,
    invalidFields,
  };
}

export function calculateRequiredAirflowM3H(params: { loadKW?: number | null; airDeltaTK?: number | null; airDensityKgM3?: number | null; cpAirKJkgK?: number | null }) {
  const loadKW = positive(params?.loadKW);
  const airDeltaTK = positive(params?.airDeltaTK);
  const airDensityKgM3 = positive(params?.airDensityKgM3) || 1.2;
  const cpAirKJkgK = positive(params?.cpAirKJkgK) || 1.005;

  if (loadKW <= 0 || airDeltaTK <= 0 || airDensityKgM3 <= 0 || cpAirKJkgK <= 0) return 0;
  return (loadKW * 3600) / (airDensityKgM3 * cpAirKJkgK * airDeltaTK);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function humidityRatioKgKgDryAir(tempC: number, relativeHumidity: number, atmosphericPressureKPa = 101.325) {
  const rh = clamp(relativeHumidity > 1 ? relativeHumidity / 100 : relativeHumidity, 0, 1);
  const saturationPressureKPa = 0.61094 * Math.exp((17.625 * tempC) / (tempC + 243.04));
  const vaporPressureKPa = rh * saturationPressureKPa;
  return 0.62198 * vaporPressureKPa / Math.max(0.001, atmosphericPressureKPa - vaporPressureKPa);
}

export function moistAirEnthalpyKJkgDryAir(tempC: number, humidityRatioKgKg: number) {
  return 1.006 * tempC + humidityRatioKgKg * (2501 + 1.86 * tempC);
}

export function calculatePsychrometricInfiltrationKW(input: any) {
  const externalTempC = safeNumber(input?.externalTempC ?? input?.external_temp_c, 0);
  const internalTempC = safeNumber(input?.internalTempC ?? input?.internal_temp_c ?? input?.airTempC ?? input?.air_temp_c, 0);
  const externalRH = safeNumber(input?.externalRelativeHumidityPercent ?? input?.external_relative_humidity_percent, NaN);
  const internalRH = safeNumber(input?.internalRelativeHumidityPercent ?? input?.internal_relative_humidity_percent ?? input?.relative_humidity_percent, NaN);
  // Converter m³/dia para m³/h se necessário
  let infiltrationAirflowM3H = positive(input?.infiltrationAirflowM3H ?? input?.infiltration_airflow_m3_h ?? input?.freshAirM3H ?? input?.fresh_air_m3_h ?? input?.doorInfiltrationM3H ?? input?.door_infiltration_m3_h);
  // Se a vazão vem em m³/dia (como do cálculo de porta), converter para m³/h
  if (input?.door_infiltration_m3_h && input.door_infiltration_m3_h > 0 && infiltrationAirflowM3H > 0) {
    infiltrationAirflowM3H = infiltrationAirflowM3H / 24; // Converter m³/dia → m³/h
  }
  const airDensityKgM3 = positive(input?.airDensityKgM3 ?? input?.air_density_kg_m3) || 1.2;
  const atmosphericPressureKPa = positive(input?.atmosphericPressureKPa ?? input?.atmospheric_pressure_kpa) || 101.325;
  const missingFields = [
    infiltrationAirflowM3H <= 0 ? "vazão de infiltração" : "",
    !Number.isFinite(externalRH) ? "umidade relativa externa" : "",
    !Number.isFinite(internalRH) ? "umidade relativa interna" : "",
  ].filter(Boolean);

  if (missingFields.length > 0) {
    return { totalKW: 0, sensibleKW: 0, latentKW: 0, infiltrationAirflowM3H, missingFields, warnings: ["Infiltração psicrométrica não calculada por falta de dados."], method: "psychrometric_enthalpy" };
  }

  const externalHumidityRatio = humidityRatioKgKgDryAir(externalTempC, externalRH, atmosphericPressureKPa);
  const internalHumidityRatio = humidityRatioKgKgDryAir(internalTempC, internalRH, atmosphericPressureKPa);
  const externalEnthalpyKJkg = moistAirEnthalpyKJkgDryAir(externalTempC, externalHumidityRatio);
  const internalEnthalpyKJkg = moistAirEnthalpyKJkgDryAir(internalTempC, internalHumidityRatio);
  const deltaEnthalpyKJkg = Math.max(externalEnthalpyKJkg - internalEnthalpyKJkg, 0);
  const deltaHumidityRatio = Math.max(externalHumidityRatio - internalHumidityRatio, 0);
  const dryAirMassKgS = infiltrationAirflowM3H * airDensityKgM3 / 3600;
  const totalKW = dryAirMassKgS * deltaEnthalpyKJkg;
  const sensibleKW = Math.max(dryAirMassKgS * 1.006 * (externalTempC - internalTempC), 0);
  const latentKW = Math.max(dryAirMassKgS * deltaHumidityRatio * (2501 + 1.86 * internalTempC), Math.max(totalKW - sensibleKW, 0));

  return { totalKW, sensibleKW, latentKW, infiltrationAirflowM3H, externalHumidityRatio, internalHumidityRatio, deltaHumidityRatio, externalEnthalpyKJkg, internalEnthalpyKJkg, deltaEnthalpyKJkg, missingFields, warnings: [], method: "psychrometric_enthalpy" };
}
