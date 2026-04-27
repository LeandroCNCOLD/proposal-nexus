import { COLDPRO_TUNNEL_ENGINE_VERSION } from "../engines/tunnelEngine";
import type { TunnelDatabasePayload, TunnelEngineResult } from "../types/tunnelEngine.types";

const INPUT_FIELDS = [
  "id", "environment_id", "tunnel_type", "operation_mode", "process_type", "arrangement_type", "product_id", "product_name",
  "product_length_m", "product_width_m", "product_thickness_m", "product_height_m", "product_side_m", "product_diameter_m",
  "unit_weight_kg", "product_unit_weight_kg", "product_thickness_mm", "units_per_cycle", "cycles_per_hour", "mass_kg_hour",
  "static_mass_mode", "units_per_box", "boxes_per_layer", "number_of_layers", "total_units_per_pallet", "units_per_pallet",
  "box_packaging_weight_kg", "pallet_base_weight_kg", "product_mass_per_pallet_kg", "packaging_mass_per_pallet_kg",
  "calculated_pallet_mass_kg", "static_mass_kg", "pallet_length_m", "pallet_width_m", "pallet_height_m", "pallet_mass_kg",
  "number_of_pallets", "batch_time_h", "units_per_tray", "trays_per_cart", "number_of_carts", "tray_packaging_weight_kg",
  "cart_structure_weight_kg", "calculated_cart_mass_kg", "batch_mass_mode", "direct_batch_mass_kg", "boxes_per_batch",
  "racks_count", "containers_count", "packaging_weight_kg", "calculated_batch_mass_kg", "continuous_mass_mode", "trays_per_hour",
  "tray_weight_kg", "units_per_hour", "units_per_row", "rows_per_meter", "belt_speed_m_min", "mass_flow_mode", "feed_rate_kg_h",
  "bed_width_m", "bed_length_m", "bed_area_m2", "superficial_air_velocity_m_s", "layers_count", "boxes_count", "tray_spacing_m",
  "package_type", "physical_model", "product_geometry", "surface_exposure_model", "airflow_source", "fan_airflow_m3_h",
  "tunnel_cross_section_width_m", "tunnel_cross_section_height_m", "blockage_factor", "gross_air_area_m2", "free_air_area_m2",
  "calculated_air_velocity_m_s", "air_velocity_used_m_s", "air_exposure_factor", "thermal_penetration_factor", "spiral_turbulence_factor",
  "block_exposure_factor", "airflow_m3_h", "recommended_airflow_m3_h", "informed_air_flow_m3_h", "air_flow_method", "air_delta_t_k",
  "air_density_kg_m3", "suggested_air_temp_c", "suggested_air_method", "suggested_air_approach_k", "min_air_temp_c", "max_air_temp_c",
  "min_air_velocity_m_s", "max_air_velocity_m_s", "air_temp_step_c", "air_velocity_step_m_s", "recommended_air_temp_c",
  "recommended_air_velocity_m_s", "optimization_status", "optimization_margin_percent", "optimization_attempts_count", "optimization_memory",
  "convective_coefficient_manual_w_m2_k", "convective_coefficient_effective_w_m2_k", "thermal_characteristic_dimension_m",
  "distance_to_core_m", "inlet_temp_c", "outlet_temp_c", "freezing_temp_c", "density_kg_m3", "thermal_conductivity_frozen_w_m_k",
  "thermal_conductivity_unfrozen_w_m_k", "convective_coefficient_w_m2_k", "estimated_freezing_time_min", "retention_status",
  "recommended_airflow_m3_h", "air_temp_source", "air_temp_c", "air_velocity_m_s", "process_time_min", "specific_heat_above_kj_kg_k",
  "specific_heat_below_kj_kg_k", "specific_heat_above_kcal_kg_c", "specific_heat_below_kcal_kg_c", "latent_heat_kj_kg",
  "latent_heat_kcal_kg", "water_content_percent", "protein_content_percent", "fat_content_percent", "carbohydrate_content_percent",
  "fiber_content_percent", "ash_content_percent", "frozen_water_fraction", "freezable_water_content_percent", "respiration_rate_0c_mw_kg",
  "respiration_rate_5c_mw_kg", "respiration_rate_10c_mw_kg", "respiration_rate_15c_mw_kg", "respiration_rate_20c_mw_kg",
  "notes", "packaging_mass_kg_hour", "packaging_specific_heat_kcal_kg_c", "belt_motor_kw", "internal_fans_kw", "other_internal_kw",
  "approved_air_temp_c", "approved_air_velocity_m_s", "approved_air_delta_t_k", "approved_air_flow_m3_h", "approved_convective_coefficient_w_m2_k",
  "approved_packaging_type", "approved_air_exposure_factor", "approved_thermal_penetration_factor", "approved_process_status",
  "approved_estimated_time_min", "approved_total_kw", "approved_total_kcal_h", "approved_total_tr", "thermal_condition_approved",
  "thermal_condition_approved_at", "equivalent_diameter_m", "characteristic_dimension_m", "box_length_m", "box_width_m", "box_height_m",
  "bulk_layer_height_m", "equivalent_particle_diameter_m",
] as const;

function pickKnownFields(source: any) {
  const payload: Record<string, unknown> = {};
  for (const field of INPUT_FIELDS) {
    if (source?.[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}

function round(value: unknown, digits = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const factor = 10 ** digits;
  return Math.round(parsed * factor) / factor;
}

export function validateTunnelCalculationConsistency(tunnelResult: TunnelEngineResult, savedPayload: TunnelDatabasePayload) {
  const issues: string[] = [];
  const product = Number(tunnelResult?.productLoadKW ?? 0);
  const packaging = Number(tunnelResult?.packagingLoadKW ?? 0);
  const internal = Number(tunnelResult?.internalLoadKW ?? 0);
  const total = Number(tunnelResult?.totalKW ?? 0);
  const totalKcalH = Number(tunnelResult?.totalKcalH ?? 0);
  const estimated = tunnelResult?.estimatedTimeMin;
  const available = Number(tunnelResult?.availableTimeMin ?? 0);
  const missingFields = Array.isArray(tunnelResult?.missingFields) ? tunnelResult.missingFields : [];

  if (Math.abs(product + packaging + internal - total) > 0.01) issues.push("product + packaging + internal não fecha com totalKW.");
  if (Math.abs(total * 859.845 - totalKcalH) > 1) issues.push("totalKW convertido não bate com totalKcalH.");
  if (missingFields.length > 0 && tunnelResult?.status === "adequate") issues.push("status adequado com campos faltantes.");
  if (estimated !== null && estimated !== undefined && available > 0) {
    if (Number(estimated) <= available && tunnelResult?.status === "insufficient") issues.push("status insuficiente, mas tempo estimado cabe no tempo disponível.");
    if (Number(estimated) > available && tunnelResult?.status === "adequate") issues.push("status adequado, mas tempo estimado excede o tempo disponível.");
  }
  if (savedPayload?.tunnel_total_load_kw !== undefined && Math.abs(Number(savedPayload.tunnel_total_load_kw) - total) > 0.01) issues.push("payload salvo diverge do totalKW do motor.");

  return { valid: issues.length === 0, issues };
}

export function tunnelResultToDatabasePayload(form: any, tunnelResult: TunnelEngineResult): TunnelDatabasePayload {
  const calculatedAt = tunnelResult?.calculatedAt ?? new Date().toISOString();
  const payload = {
    ...pickKnownFields(form),
    calculated_mass_kg_h: round(tunnelResult?.calculatedMassKgH),
    used_mass_kg_h: round(tunnelResult?.usedMassKgH),
    static_mass_kg: round(tunnelResult?.staticMassKg),
    pallet_mass_kg: round(tunnelResult?.palletMassKg ?? form?.pallet_mass_kg),
    calculated_pallet_mass_kg: round(tunnelResult?.calculatedPalletMassKg),
    calculated_cart_mass_kg: round(tunnelResult?.calculatedCartMassKg),
    calculated_batch_mass_kg: round(tunnelResult?.calculatedBatchMassKg),
    units_per_pallet: round(tunnelResult?.unitsPerPallet ?? form?.units_per_pallet, 2),
    product_mass_per_pallet_kg: round(tunnelResult?.productMassPerPalletKg),
    packaging_mass_per_pallet_kg: round(tunnelResult?.packagingMassPerPalletKg),
    tunnel_product_load_kw: round(tunnelResult?.productLoadKW),
    tunnel_packaging_load_kw: round(tunnelResult?.packagingLoadKW),
    tunnel_internal_load_kw: round(tunnelResult?.internalLoadKW),
    tunnel_total_load_kw: round(tunnelResult?.totalKW),
    tunnel_total_load_kcal_h: round(tunnelResult?.totalKcalH, 2),
    tunnel_total_load_tr: round(tunnelResult?.totalTR, 4),
    airflow_m3_h: round(tunnelResult?.estimatedAirflowM3H ?? tunnelResult?.airFlowM3H, 2),
    recommended_airflow_m3_h: round(tunnelResult?.estimatedAirflowM3H ?? tunnelResult?.airFlowM3H, 2),
    air_flow_method: tunnelResult?.airFlowMethod ?? "thermal_balance_estimate",
    suggested_air_temp_c: round(tunnelResult?.suggestedAirTempC, 2),
    suggested_air_method: tunnelResult?.suggestedAirMethod ?? "process_temperature_estimate",
    gross_air_area_m2: round(tunnelResult?.grossAirAreaM2, 4),
    free_air_area_m2: round(tunnelResult?.freeAirAreaM2, 4),
    calculated_air_velocity_m_s: round(tunnelResult?.calculatedAirVelocityMS, 4),
    air_velocity_used_m_s: round(tunnelResult?.airVelocityUsedMS, 4),
    convective_coefficient_effective_w_m2_k: round(tunnelResult?.h?.hEffectiveWM2K, 4),
    convective_coefficient_w_m2_k: round(tunnelResult?.h?.hEffectiveWM2K, 4),
    thermal_characteristic_dimension_m: round(tunnelResult?.characteristicDimensionM, 5),
    distance_to_core_m: round(tunnelResult?.distanceToCoreM, 5),
    estimated_freezing_time_min: round(tunnelResult?.estimatedTimeMin, 2),
    retention_status: tunnelResult?.status ?? null,
    process_status: tunnelResult?.status ?? null,
    calculation_warnings: tunnelResult?.warnings ?? [],
    missing_fields: tunnelResult?.missingFields ?? [],
    calculation_breakdown: tunnelResult?.calculationBreakdown ?? {},
    calculation_log: tunnelResult?.calculationLog ?? {},
    engine_version: tunnelResult?.engineVersion ?? COLDPRO_TUNNEL_ENGINE_VERSION,
    calculated_at: calculatedAt,
  };
  const consistency = validateTunnelCalculationConsistency(tunnelResult, payload);
  if (!consistency.valid) {
    payload.calculation_warnings = [...(payload.calculation_warnings as string[]), ...consistency.issues.map((issue) => `Consistência: ${issue}`)];
  }
  return payload;
}
