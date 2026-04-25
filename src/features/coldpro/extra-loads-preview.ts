import { AIR_DENSITY_KG_M3, AIR_SPECIFIC_HEAT_KCAL_KG_C, DEFAULT_PEOPLE_LOAD_KCAL_H, kwToKcalh, round2 } from "./coldpro.constants";

type ExtraLoadEnvironment = {
  volume_m3?: number | null;
  internal_temp_c?: number | null;
  external_temp_c?: number | null;
  compressor_runtime_hours_day?: number | null;
  door_openings_per_day?: number | null;
  door_width_m?: number | null;
  door_height_m?: number | null;
  infiltration_factor?: number | null;
  air_changes_per_hour?: number | null;
  fresh_air_m3_h?: number | null;
  door_infiltration_m3_h?: number | null;
  people_count?: number | null;
  people_hours_day?: number | null;
  lighting_power_w?: number | null;
  lighting_hours_day?: number | null;
  motors_power_kw?: number | null;
  motors_hours_day?: number | null;
  fans_kcal_h?: number | null;
  defrost_kcal_h?: number | null;
  other_kcal_h?: number | null;
  safety_factor_percent?: number | null;
};

function n(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function suggestedInfiltrationFactor(env: ExtraLoadEnvironment) {
  const internalTemp = n(env.internal_temp_c);
  if (internalTemp <= -18) return 45;
  if (internalTemp <= 5) return 30;
  return 18;
}

function saturatedVaporPressureKpa(tempC: number) {
  return 0.61078 * Math.exp((17.2694 * tempC) / (tempC + 237.3));
}

function absoluteHumidityKgM3(tempC: number, rhPercent: number) {
  const vaporPressurePa = saturatedVaporPressureKpa(tempC) * 1000 * Math.min(100, Math.max(0, rhPercent)) / 100;
  return 0.00216679 * vaporPressurePa / (tempC + 273.15);
}

export function calculateEvaporatorFrostRisk(env: ExtraLoadEnvironment, infiltrationKcalH: number) {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  const doorArea = n(env.door_width_m) * n(env.door_height_m);
  const factor = n(env.infiltration_factor) > 0 ? n(env.infiltration_factor) : suggestedInfiltrationFactor(env);
  const doorAirM3Day = doorArea * n(env.door_openings_per_day) * factor;
  const continuousAirM3Day = (n(env.volume_m3) * n(env.air_changes_per_hour) + n(env.fresh_air_m3_h) + n(env.door_infiltration_m3_h)) * 24;
  const externalRh = n((env as any).external_relative_humidity_percent, 70) || 70;
  const internalRh = n((env as any).relative_humidity_percent, n(env.internal_temp_c) <= 0 ? 85 : 75) || (n(env.internal_temp_c) <= 0 ? 85 : 75);
  const moistureDeltaKgM3 = Math.max(0, absoluteHumidityKgM3(n(env.external_temp_c), externalRh) - absoluteHumidityKgM3(n(env.internal_temp_c), internalRh));
  const frostKgDay = (doorAirM3Day + continuousAirM3Day) * moistureDeltaKgM3;
  const blockingCapacityKg = Math.max(8, doorArea * 18 + n(env.volume_m3) * 0.03);
  const baseLoss = blockingCapacityKg > 0 ? frostKgDay / blockingCapacityKg : 0;
  const efficiencyLossPercent = Math.min(35, Math.max(0, baseLoss * 18));
  const additionalLoad = infiltrationKcalH * (efficiencyLossPercent / 100);
  const timeToBlock = (multiplier: number) => frostKgDay > 0 ? (blockingCapacityKg / (frostKgDay * multiplier)) * 24 : null;

  return {
    frost_kg_day: round2(frostKgDay),
    moisture_delta_g_m3: round2(moistureDeltaKgM3 * 1000),
    estimated_blocking_capacity_kg: round2(blockingCapacityKg),
    normal_block_hours: timeToBlock(1) ? round2(timeToBlock(1)!) : null,
    risky_block_hours: timeToBlock(1.35) ? round2(timeToBlock(1.35)!) : null,
    complex_block_hours: timeToBlock(1.75) ? round2(timeToBlock(1.75)!) : null,
    efficiency_loss_percent: round2(efficiencyLossPercent),
    additional_load_kcal_h: round2(additionalLoad),
    recommended_defrost_interval_h: timeToBlock(1.35) ? round2(Math.max(4, timeToBlock(1.35)! * 0.65)) : null,
    compressor_hours_considered: round2(compressorHours),
  };
}

export function calculateExtraLoadPreview(env: ExtraLoadEnvironment) {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  const deltaT = Math.max(0, n(env.external_temp_c) - n(env.internal_temp_c));
  const doorArea = n(env.door_width_m) * n(env.door_height_m);
  const infiltrationFactor = n(env.infiltration_factor) > 0 ? n(env.infiltration_factor) : suggestedInfiltrationFactor(env);
  const doorAirVolumeDay = doorArea * n(env.door_openings_per_day) * infiltrationFactor;
  const doorLoad = (doorAirVolumeDay * AIR_DENSITY_KG_M3 * AIR_SPECIFIC_HEAT_KCAL_KG_C * deltaT) / compressorHours;
  const continuousAirM3H = n(env.volume_m3) * n(env.air_changes_per_hour) + n(env.fresh_air_m3_h) + n(env.door_infiltration_m3_h);
  const continuousLoad = continuousAirM3H * AIR_DENSITY_KG_M3 * AIR_SPECIFIC_HEAT_KCAL_KG_C * deltaT;
  const infiltration = doorLoad + continuousLoad;
  const people = (n(env.people_count) * DEFAULT_PEOPLE_LOAD_KCAL_H * n(env.people_hours_day)) / compressorHours;
  const lighting = (kwToKcalh(n(env.lighting_power_w) / 1000) * n(env.lighting_hours_day)) / compressorHours;
  const motors = (kwToKcalh(n(env.motors_power_kw)) * n(env.motors_hours_day)) / compressorHours;
  const fans = n(env.fans_kcal_h);
  const defrost = n(env.defrost_kcal_h);
  const other = n(env.other_kcal_h);
  const evaporatorFrost = calculateEvaporatorFrostRisk(env, infiltration);
  const subtotal = infiltration + people + lighting + motors + fans + defrost + other + evaporatorFrost.additional_load_kcal_h;
  const safety = subtotal * (n(env.safety_factor_percent) / 100);

  return {
    doorArea: round2(doorArea),
    infiltrationFactor: round2(infiltrationFactor),
    doorAirVolumeDay: round2(doorAirVolumeDay),
    continuousAirM3H: round2(continuousAirM3H),
    infiltration_kcal_h: round2(infiltration),
    people_kcal_h: round2(people),
    lighting_kcal_h: round2(lighting),
    motors_kcal_h: round2(motors),
    fans_kcal_h: round2(fans),
    defrost_kcal_h: round2(defrost),
    evaporator_frost: evaporatorFrost,
    other_kcal_h: round2(other),
    subtotal_kcal_h: round2(subtotal),
    safety_kcal_h: round2(safety),
    total_with_safety_kcal_h: round2(subtotal + safety),
  };
}