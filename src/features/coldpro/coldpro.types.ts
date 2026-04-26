export type ColdProApplicationType =
  | "cold_room"
  | "freezer_room"
  | "antechamber"
  | "picking_room"
  | "blast_freezer"
  | "cooling_tunnel"
  | "seed_storage"
  | "climatized_room";

export type ColdProAdvancedProcessType =
  | "none"
  | "seed_humidity_control"
  | "banana_ripening"
  | "citrus_degreening"
  | "potato_co2_control"
  | "controlled_atmosphere"
  | "ethylene_application"
  | "ethylene_removal"
  | "co2_scrubbing"
  | "humidity_control";

export type ColdProStatus =
  | "draft"
  | "calculated"
  | "waiting_approval"
  | "approved"
  | "sent_to_proposal";

export type ColdProConstructionFace = {
  local: string;
  layers?: ColdProWallLayer[] | null;
  u_value_w_m2k?: number | null;
  transmission_w?: number | null;
  transmission_kcal_h?: number | null;
  wall_length_m?: number | null;
  wall_height_m?: number | null;
  cutout_length_m?: number | null;
  cutout_width_m?: number | null;
  material_thickness?: string | null;
  panel_area_m2?: number | null;
  external_temp_c?: number | null;
  solar_orientation?: string | null;
  color?: string | null;
  glass_area_m2?: number | null;
  glass_type?: string | null;
  solar_radiation_w_m2?: number | null;
  floor_condition?: string | null;
  door_area_m2?: number | null;
};

export type ColdProWallLayer = {
  material_id?: string | null;
  material_name: string;
  category?: string | null;
  thickness_m: number;
  conductivity_w_mk: number;
  position: number;
};

export type ColdProThermalMaterial = {
  id: string;
  material_name: string;
  category: string;
  thermal_conductivity_w_mk: number;
  density_kg_m3?: number | null;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
  typical_thickness_mm?: number | null;
  is_insulation: boolean;
  notes?: string | null;
};

export type ColdProEnvironment = {
  id: string;
  coldpro_project_id: string;
  name: string;
  environment_type: ColdProApplicationType;
  length_m: number;
  width_m: number;
  height_m: number;
  volume_m3: number;
  internal_temp_c: number;
  external_temp_c: number;
  external_relative_humidity_percent?: number | null;
  atmospheric_pressure_kpa?: number | null;
  floor_temp_c?: number | null;
  relative_humidity_percent?: number | null;
  air_changes_per_hour?: number | null;
  fresh_air_m3_h?: number | null;
  door_infiltration_m3_h?: number | null;
  seed_mass_kg?: number | null;
  seed_initial_moisture_percent?: number | null;
  seed_final_moisture_percent?: number | null;
  seed_stabilization_time_h?: number | null;
  insulation_material_id?: string | null;
  wall_thickness_mm: number;
  ceiling_thickness_mm: number;
  floor_thickness_mm: number;
  has_floor_insulation: boolean;
  operation_hours_day: number;
  compressor_runtime_hours_day: number;
  door_openings_per_day: number;
  door_width_m: number;
  door_height_m: number;
  infiltration_factor: number;
  door_open_seconds_per_opening?: number | null;
  door_operation_profile?: string | null;
  door_protection_type?: string | null;
  climate_region?: string | null;
  people_count: number;
  people_hours_day: number;
  lighting_power_w: number;
  lighting_hours_day: number;
  motors_power_kw: number;
  motors_hours_day: number;
  motors_dissipation_factor?: number | null;
  fans_kcal_h: number;
  defrost_kcal_h: number;
  evaporator_temp_c?: number | null;
  defrost_loss_factor?: number | null;
  other_kcal_h: number;
  safety_factor_percent: number;
  chamber_layout_type?: string | null;
  dimension_a_m?: number | null;
  dimension_b_m?: number | null;
  dimension_c_m?: number | null;
  dimension_d_m?: number | null;
  dimension_e_m?: number | null;
  dimension_f_m?: number | null;
  wall_count?: number | null;
  module_count?: number | null;
  west_face_insolation?: boolean | null;
  construction_faces?: ColdProConstructionFace[] | null;
  total_panel_area_m2?: number | null;
  total_glass_area_m2?: number | null;
  total_door_area_m2?: number | null;
  construction_load_kcal_h?: number | null;
};

export type ColdProEnvironmentProduct = {
  id?: string;
  environment_id?: string;
  product_id?: string | null;
  product_name: string;
  product_load_mode?: "storage_turnover" | "daily_intake" | "hourly_intake" | "room_pull_down_or_freezing";
  stored_mass_kg?: number;
  daily_turnover_percent?: number;
  daily_movement_kg?: number;
  hourly_movement_kg?: number;
  recovery_time_h?: number;
  is_freezing_inside_storage_room?: boolean;
  freezing_batch_mass_kg?: number;
  freezing_batch_time_h?: number;
  movement_basis?: "calculated_from_stock" | "manual_daily" | "manual_hourly" | "batch_recovery";
  mass_kg_day: number;
  mass_kg_hour: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  process_time_h: number;
  packaging_mass_kg_day: number;
  packaging_specific_heat_kcal_kg_c: number;
  packaging_inlet_temp_c?: number | null;
  packaging_outlet_temp_c?: number | null;
  specific_heat_above_kj_kg_k?: number | null;
  specific_heat_below_kj_kg_k?: number | null;
  specific_heat_above_kcal_kg_c: number;
  specific_heat_below_kcal_kg_c: number;
  latent_heat_kj_kg?: number | null;
  latent_heat_kcal_kg: number;
  initial_freezing_temp_c?: number | null;
  density_kg_m3?: number | null;
  water_content_percent?: number | null;
  protein_content_percent?: number | null;
  fat_content_percent?: number | null;
  carbohydrate_content_percent?: number | null;
  fiber_content_percent?: number | null;
  ash_content_percent?: number | null;
  thermal_conductivity_unfrozen_w_m_k?: number | null;
  thermal_conductivity_frozen_w_m_k?: number | null;
  frozen_water_fraction?: number | null;
  freezable_water_content_percent?: number | null;
  characteristic_thickness_m?: number | null;
  default_convective_coefficient_w_m2_k?: number | null;
  allow_phase_change?: boolean | null;
  respiration_rate_0c_w_kg?: number | null;
  respiration_rate_5c_w_kg?: number | null;
  respiration_rate_10c_w_kg?: number | null;
  respiration_rate_15c_w_kg?: number | null;
  respiration_rate_20c_w_kg?: number | null;
  respiration_rate_0c_mw_kg?: number | null;
  respiration_rate_5c_mw_kg?: number | null;
  respiration_rate_10c_mw_kg?: number | null;
  respiration_rate_15c_mw_kg?: number | null;
  respiration_rate_20c_mw_kg?: number | null;
  notes?: string | null;
};

export type ColdProTunnel = {
  id?: string;
  environment_id: string;
  tunnel_type: "blast_freezer" | "cooling_tunnel";
  operation_mode: "continuous" | "batch";
  process_type?: "continuous_individual_freezing" | "continuous_girofreezer" | "static_cart_freezing" | "static_pallet_freezing";
  arrangement_type?: "individual_exposed" | "tray_layer" | "boxed_product" | "cart_rack" | "pallet_block" | "bulk_static";
  product_id?: string | null;
  product_name: string;
  product_length_m?: number;
  product_width_m?: number;
  product_thickness_m?: number;
  unit_weight_kg?: number;
  product_thickness_mm: number;
  product_unit_weight_kg: number;
  units_per_cycle: number;
  cycles_per_hour: number;
  mass_kg_hour: number;
  pallet_length_m?: number;
  pallet_width_m?: number;
  pallet_height_m?: number;
  pallet_mass_kg?: number;
  number_of_pallets?: number;
  batch_time_h?: number;
  layers_count?: number;
  boxes_count?: number;
  tray_spacing_m?: number;
  package_type?: string | null;
  air_exposure_factor?: number | null;
  thermal_penetration_factor?: number | null;
  inlet_temp_c: number;
  outlet_temp_c: number;
  freezing_temp_c?: number | null;
  density_kg_m3?: number | null;
  thermal_conductivity_frozen_w_m_k?: number | null;
  convective_coefficient_w_m2_k?: number | null;
  convective_coefficient_manual_w_m2_k?: number | null;
  convective_coefficient_effective_w_m2_k?: number | null;
  thermal_characteristic_dimension_m?: number | null;
  distance_to_core_m?: number | null;
  estimated_freezing_time_min?: number | null;
  retention_status?: string | null;
  recommended_airflow_m3_h?: number | null;
  air_delta_t_k?: number;
  min_air_temp_c?: number;
  max_air_temp_c?: number;
  min_air_velocity_m_s?: number;
  max_air_velocity_m_s?: number;
  air_temp_step_c?: number;
  air_velocity_step_m_s?: number;
  recommended_air_temp_c?: number | null;
  recommended_air_velocity_m_s?: number | null;
  suggested_air_temp_c?: number | null;
  suggested_air_approach_k?: number | null;
  optimization_status?: string | null;
  optimization_margin_percent?: number | null;
  optimization_attempts_count?: number | null;
  optimization_memory?: Record<string, unknown> | null;
  airflow_m3_h?: number;
  air_flow_m3_h?: number | null;
  air_temp_c: number;
  air_temp_source?: "environment" | "manual";
  air_velocity_m_s: number;
  process_time_min: number;
  specific_heat_above_kj_kg_k?: number | null;
  specific_heat_below_kj_kg_k?: number | null;
  specific_heat_above_kcal_kg_c: number;
  specific_heat_below_kcal_kg_c: number;
  latent_heat_kj_kg?: number | null;
  latent_heat_kcal_kg: number;
  thermal_conductivity_unfrozen_w_m_k?: number | null;
  water_content_percent?: number | null;
  protein_content_percent?: number | null;
  fat_content_percent?: number | null;
  carbohydrate_content_percent?: number | null;
  fiber_content_percent?: number | null;
  ash_content_percent?: number | null;
  frozen_water_fraction?: number | null;
  freezable_water_content_percent?: number | null;
  packaging_mass_kg_hour: number;
  packaging_specific_heat_kcal_kg_c: number;
  belt_motor_kw: number;
  internal_fans_kw: number;
  other_internal_kw: number;
  calculated_mass_kg_h?: number | null;
  used_mass_kg_h?: number | null;
  tunnel_product_load_kw?: number | null;
  tunnel_packaging_load_kw?: number | null;
  tunnel_internal_load_kw?: number | null;
  tunnel_total_load_kw?: number | null;
  tunnel_total_load_kcal_h?: number | null;
  tunnel_total_load_tr?: number | null;
  process_status?: string | null;
  calculation_warnings?: string[] | null;
  missing_fields?: string[] | null;
  calculation_breakdown?: Record<string, unknown> | null;
  calculation_log?: Record<string, unknown> | null;
};

export type ColdProInsulationMaterial = {
  id: string;
  name: string;
  material_type: string;
  conductivity_w_m_k: number;
  conductivity_kcal_h_m_c: number;
  default_thickness_mm?: number | null;
};

export type ColdProAdvancedProcess = {
  id?: string;
  project_id: string;
  environment_id?: string | null;
  advanced_process_type: ColdProAdvancedProcessType;
  product_name?: string | null;
  product_mass_kg?: number | null;
  chamber_volume_m3?: number | null;
  target_temperature_c?: number | null;
  target_relative_humidity?: number | null;
  process_time_h?: number | null;
  technical_notes?: string | null;
  external_temperature_c?: number | null;
  external_relative_humidity?: number | null;
  internal_temperature_c?: number | null;
  internal_relative_humidity?: number | null;
  air_changes_per_hour?: number | null;
  product_initial_moisture?: number | null;
  product_final_moisture?: number | null;
  stabilization_time_h?: number | null;
  ethylene_target_ppm?: number | null;
  ethylene_exposure_time_h?: number | null;
  ethylene_renewal_after_application?: boolean | null;
  co2_generation_rate_m3_kg_h?: number | null;
  co2_limit_percent?: number | null;
  external_co2_percent?: number | null;
  storage_time_h?: number | null;
  o2_target_percent?: number | null;
  co2_target_percent?: number | null;
  respiration_rate_w_kg?: number | null;
  purge_airflow_m3_h?: number | null;
  scrubber_enabled?: boolean | null;
  air_renewal_m3_h?: number | null;
  calculation_result?: Record<string, unknown> | null;
  calculation_breakdown?: Record<string, unknown> | null;
};

export type ColdProResult = {
  transmission_kcal_h: number;
  product_kcal_h: number;
  packaging_kcal_h: number;
  infiltration_kcal_h: number;
  people_kcal_h: number;
  lighting_kcal_h: number;
  motors_kcal_h: number;
  tunnel_internal_load_kcal_h: number;
  fans_kcal_h: number;
  defrost_kcal_h: number;
  other_kcal_h: number;
  subtotal_kcal_h: number;
  safety_factor_percent: number;
  safety_kcal_h: number;
  total_required_kcal_h: number;
  total_required_kw: number;
  total_required_tr: number;
  calculation_breakdown: Record<string, unknown>;
};
