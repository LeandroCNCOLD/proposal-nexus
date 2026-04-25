import { DEFAULT_PEOPLE_LOAD_KCAL_H, kwToKcalh, round2 } from "./coldpro.constants";
import { calculateMotorLoadKcalH, calculateTechnicalDefrost, calculateTechnicalInfiltration } from "./thermal-calculations";

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
  door_open_seconds_per_opening?: number | null;
  door_operation_profile?: string | null;
  door_protection_type?: string | null;
  climate_region?: string | null;
  people_count?: number | null;
  people_hours_day?: number | null;
  lighting_power_w?: number | null;
  lighting_hours_day?: number | null;
  motors_power_kw?: number | null;
  motors_hours_day?: number | null;
  motors_dissipation_factor?: number | null;
  fans_kcal_h?: number | null;
  defrost_kcal_h?: number | null;
  evaporator_temp_c?: number | null;
  defrost_loss_factor?: number | null;
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

export function calculateEvaporatorFrostRisk(env: ExtraLoadEnvironment, infiltrationKcalH: number) {
  const infiltration = calculateTechnicalInfiltration(env);
  const compressorHours = infiltration.compressorHoursDay;
  const doorArea = n(env.door_width_m) * n(env.door_height_m);
  const frostKgDay = infiltration.iceKgDay;
  const blockingCapacityKg = Math.max(8, doorArea * 18 + n(env.volume_m3) * 0.03);
  const baseLoss = blockingCapacityKg > 0 ? frostKgDay / blockingCapacityKg : 0;
  const efficiencyLossPercent = Math.min(35, Math.max(0, baseLoss * 18));
  const additionalLoad = infiltrationKcalH * (efficiencyLossPercent / 100);
  const timeToBlock = (multiplier: number) => frostKgDay > 0 ? (blockingCapacityKg / (frostKgDay * multiplier)) * 24 : null;

  return {
    frost_kg_day: round2(frostKgDay),
    moisture_delta_g_m3: infiltration.deltaHumidityGM3,
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
  const infiltrationFactor = n(env.infiltration_factor) > 0 ? n(env.infiltration_factor) : suggestedInfiltrationFactor(env);
  const infiltration = calculateTechnicalInfiltration(env);
  const defrostSuggestion = calculateTechnicalDefrost(env, infiltration.iceKgDay);
  const manualDefrost = n(env.defrost_kcal_h);
  const people = (n(env.people_count) * DEFAULT_PEOPLE_LOAD_KCAL_H * n(env.people_hours_day)) / compressorHours;
  const lighting = (kwToKcalh(n(env.lighting_power_w) / 1000) * n(env.lighting_hours_day)) / compressorHours;
  const motors = calculateMotorLoadKcalH(env);
  const fans = n(env.fans_kcal_h);
  const defrost = manualDefrost > 0 ? manualDefrost : defrostSuggestion.defrostKcalH;
  const other = n(env.other_kcal_h);
  const evaporatorFrost = calculateEvaporatorFrostRisk(env, infiltration.totalInfiltrationKcalH);
  const subtotal = infiltration.totalInfiltrationKcalH + people + lighting + motors + fans + defrost + other + evaporatorFrost.additional_load_kcal_h;
  const safety = subtotal * (n(env.safety_factor_percent) / 100);

  return {
    doorArea: infiltration.doorAreaM2,
    infiltrationFactor: round2(infiltrationFactor),
    doorAirVolumeDay: infiltration.doorInfiltrationM3Day,
    continuousAirM3H: round2(infiltration.continuousInfiltrationM3Day / 24),
    infiltration_breakdown: infiltration,
    defrost_suggestion: defrostSuggestion,
    infiltration_kcal_h: round2(infiltration.totalInfiltrationKcalH),
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