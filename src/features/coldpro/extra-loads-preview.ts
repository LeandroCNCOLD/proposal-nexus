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
  const subtotal = infiltration + people + lighting + motors + fans + defrost + other;
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
    other_kcal_h: round2(other),
    subtotal_kcal_h: round2(subtotal),
    safety_kcal_h: round2(safety),
    total_with_safety_kcal_h: round2(subtotal + safety),
  };
}