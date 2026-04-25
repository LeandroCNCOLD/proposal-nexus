export type OperationProfile = "light" | "normal" | "intense" | "critical";
export type DoorProtection = "none" | "pvc_curtain" | "air_curtain" | "antechamber" | "fast_door" | "antechamber_fast_door";
export type ApplicationType = "frozen_room" | "chilled_room" | "climatized_room" | "tunnel" | "cold_room";
export type ClimateRegion = "sp_capital_abcd" | "interior_sp" | "centro_oeste" | "norte_nordeste_umido" | "sul" | "custom";

export const THERMAL_CONSTANTS = {
  air: { densityKgM3: 1.2, cpKcalKgC: 0.24 },
  water: { latentCondensationKcalKg: 597, latentFreezingKcalKg: 80, iceCpKcalKgC: 0.5, vaporToIceKcalKg: 677 },
  conversion: { kcalPerKwH: 859.845, wattToKcalH: 0.859845, kcalHToKw: 1 / 859.845, kcalHToTR: 1 / 3024 },
  doorAirVelocityMS: { light: 0.25, normal: 0.5, intense: 0.8, critical: 1.2 } satisfies Record<OperationProfile, number>,
  doorProtectionFactor: { none: 1, pvc_curtain: 0.7, air_curtain: 0.55, antechamber: 0.45, fast_door: 0.35, antechamber_fast_door: 0.25 } satisfies Record<DoorProtection, number>,
  internalHumidityDefault: { frozen_room: 0.85, chilled_room: 0.75, climatized_room: 0.65, tunnel: 0.85, cold_room: 0.75 } satisfies Record<ApplicationType, number>,
  defrost: { defaultLossFactor: 1.25 },
};

export const REGIONAL_CLIMATE_DEFAULTS: Record<ClimateRegion, { externalTempC: number; externalRH: number; description: string }> = {
  sp_capital_abcd: { externalTempC: 35, externalRH: 0.7, description: "Grande SP / ABCD" },
  interior_sp: { externalTempC: 38, externalRH: 0.55, description: "Interior de São Paulo" },
  centro_oeste: { externalTempC: 40, externalRH: 0.45, description: "Centro-Oeste" },
  norte_nordeste_umido: { externalTempC: 38, externalRH: 0.75, description: "Norte/Nordeste úmido" },
  sul: { externalTempC: 32, externalRH: 0.75, description: "Sul" },
  custom: { externalTempC: 35, externalRH: 0.7, description: "Manual" },
};

const round = (value: number, decimals = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function saturationVaporPressurePa(tempC: number): number {
  return 610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));
}

export function absoluteHumidityKgM3(tempC: number, relativeHumidity: number): number {
  const rh = clamp(relativeHumidity > 1 ? relativeHumidity / 100 : relativeHumidity, 0, 1);
  return (0.00216679 * rh * saturationVaporPressurePa(tempC)) / (tempC + 273.15);
}

export function applicationTypeFromEnvironment(type?: string | null): ApplicationType {
  if (type === "tunnel" || type === "blast_freezer") return "tunnel";
  return "cold_room";
}

export function calculateTechnicalInfiltration(env: any) {
  const region = String(env.climate_region ?? "sp_capital_abcd") as ClimateRegion;
  const regionDefaults = REGIONAL_CLIMATE_DEFAULTS[region] ?? REGIONAL_CLIMATE_DEFAULTS.sp_capital_abcd;
  const internalTempC = num(env.internal_temp_c);
  const externalTempC = env.external_temp_c !== null && env.external_temp_c !== undefined ? num(env.external_temp_c) : regionDefaults.externalTempC;
  const compressorHoursDay = Math.max(1, num(env.compressor_runtime_hours_day, 20) || 20);
  const applicationType = applicationTypeFromEnvironment(env.environment_type);
  const externalRH = env.external_relative_humidity_percent !== null && env.external_relative_humidity_percent !== undefined && num(env.external_relative_humidity_percent) > 0 ? num(env.external_relative_humidity_percent) / 100 : regionDefaults.externalRH;
  const internalRH = env.relative_humidity_percent !== null && env.relative_humidity_percent !== undefined && num(env.relative_humidity_percent) > 0 ? num(env.relative_humidity_percent) / 100 : THERMAL_CONSTANTS.internalHumidityDefault[applicationType];
  const operationProfile = String(env.door_operation_profile ?? "normal") as OperationProfile;
  const doorProtection = String(env.door_protection_type ?? "none") as DoorProtection;
  const airVelocityMS = THERMAL_CONSTANTS.doorAirVelocityMS[operationProfile] ?? THERMAL_CONSTANTS.doorAirVelocityMS.normal;
  const correctionFactor = THERMAL_CONSTANTS.doorProtectionFactor[doorProtection] ?? 1;
  const doorAreaM2 = Math.max(0, num(env.door_width_m)) * Math.max(0, num(env.door_height_m));
  const secondsOpenDay = Math.max(0, num(env.door_openings_per_day)) * Math.max(0, num(env.door_open_seconds_per_opening, 60));
  const doorInfiltrationM3Day = doorAreaM2 * airVelocityMS * secondsOpenDay * correctionFactor;
  const airChangesM3H = Math.max(0, num(env.volume_m3)) * Math.max(0, num(env.air_changes_per_hour));
  const freshAirM3H = Math.max(0, num(env.fresh_air_m3_h));
  const manualDoorM3H = Math.max(0, num(env.door_infiltration_m3_h));
  const continuousInfiltrationM3Day = (airChangesM3H + freshAirM3H + manualDoorM3H) * 24;
  const totalInfiltrationM3Day = doorInfiltrationM3Day + continuousInfiltrationM3Day;
  const deltaT = Math.max(0, externalTempC - internalTempC);
  const sensibleKcalDay = totalInfiltrationM3Day * THERMAL_CONSTANTS.air.densityKgM3 * THERMAL_CONSTANTS.air.cpKcalKgC * deltaT;
  const externalAbsoluteHumidityKgM3 = absoluteHumidityKgM3(externalTempC, externalRH);
  const internalAbsoluteHumidityKgM3 = absoluteHumidityKgM3(internalTempC, internalRH);
  const deltaHumidityKgM3 = Math.max(0, externalAbsoluteHumidityKgM3 - internalAbsoluteHumidityKgM3);
  const iceKgDay = totalInfiltrationM3Day * deltaHumidityKgM3;
  const latentKcalDay = iceKgDay * THERMAL_CONSTANTS.water.vaporToIceKcalKg;
  return {
    regionUsed: region,
    regionDescription: regionDefaults.description,
    externalTempC: round(externalTempC),
    externalRH: round(externalRH * 100, 2),
    internalRH: round(internalRH * 100, 2),
    doorAreaM2: round(doorAreaM2),
    operationProfile,
    doorProtection,
    correctionFactor,
    airVelocityMS,
    doorInfiltrationM3Day: round(doorInfiltrationM3Day),
    airChangesM3H: round(airChangesM3H),
    freshAirM3H: round(freshAirM3H),
    manualDoorM3H: round(manualDoorM3H),
    continuousInfiltrationM3Day: round(continuousInfiltrationM3Day),
    totalInfiltrationM3Day: round(totalInfiltrationM3Day),
    externalAbsoluteHumidityKgM3: round(externalAbsoluteHumidityKgM3, 6),
    internalAbsoluteHumidityKgM3: round(internalAbsoluteHumidityKgM3, 6),
    deltaHumidityKgM3: round(deltaHumidityKgM3, 6),
    deltaHumidityGM3: round(deltaHumidityKgM3 * 1000, 2),
    sensibleKcalH: round(sensibleKcalDay / compressorHoursDay),
    latentKcalH: round(latentKcalDay / compressorHoursDay),
    totalInfiltrationKcalH: round((sensibleKcalDay + latentKcalDay) / compressorHoursDay),
    iceKgDay: round(iceKgDay),
    compressorHoursDay: round(compressorHoursDay),
  };
}

export function calculateTechnicalDefrost(env: any, iceKgDay: number) {
  const compressorHoursDay = Math.max(1, num(env.compressor_runtime_hours_day, 20) || 20);
  const evapTempC = num(env.evaporator_temp_c, num(env.internal_temp_c) - 6 || -31);
  const lossFactor = Math.max(1, num(env.defrost_loss_factor, THERMAL_CONSTANTS.defrost.defaultLossFactor) || THERMAL_CONSTANTS.defrost.defaultLossFactor);
  const energyPerKg = THERMAL_CONSTANTS.water.iceCpKcalKgC * Math.abs(evapTempC) + THERMAL_CONSTANTS.water.latentFreezingKcalKg;
  const energyKcalDay = Math.max(0, iceKgDay) * energyPerKg * lossFactor;
  return { iceKgDay: round(iceKgDay), evapTempC: round(evapTempC), energyPerKg: round(energyPerKg), energyKcalDay: round(energyKcalDay), defrostKcalH: round(energyKcalDay / compressorHoursDay), lossFactor };
}

export function calculateMotorLoadKcalH(env: any) {
  const compressorHoursDay = Math.max(1, num(env.compressor_runtime_hours_day, 20) || 20);
  const dissipation = clamp(num(env.motors_dissipation_factor, 1), 0, 1);
  return round(Math.max(0, num(env.motors_power_kw)) * THERMAL_CONSTANTS.conversion.kcalPerKwH * Math.max(0, num(env.motors_hours_day)) / compressorHoursDay * dissipation);
}

export const MOTOR_EQUIPMENT_PRESETS = [
  { label: "Empilhadeira elétrica", powerKw: 4.5, dissipationFactor: 1 },
  { label: "Transpaleteira elétrica", powerKw: 1.5, dissipationFactor: 1 },
  { label: "Esteira transportadora", powerKw: 0.75, dissipationFactor: 1 },
  { label: "Agitador / misturador", powerKw: 2.2, dissipationFactor: 1 },
  { label: "Bomba interna", powerKw: 1.1, dissipationFactor: 1 },
  { label: "Ventilador auxiliar", powerKw: 0.55, dissipationFactor: 1 },
  { label: "Motor parcialmente externo", powerKw: 2.2, dissipationFactor: 0.5 },
  { label: "Motor externo", powerKw: 2.2, dissipationFactor: 0 },
];