export type ColdProApplicationType =
  | "cold_room"
  | "freezer_room"
  | "antechamber"
  | "picking_room"
  | "blast_freezer"
  | "cooling_tunnel"
  | "seed_storage"
  | "climatized_room";

export type ColdProStatus =
  | "draft"
  | "calculated"
  | "waiting_approval"
  | "approved"
  | "sent_to_proposal";

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
  floor_temp_c?: number | null;
  relative_humidity_percent?: number | null;
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
  people_count: number;
  people_hours_day: number;
  lighting_power_w: number;
  lighting_hours_day: number;
  motors_power_kw: number;
  motors_hours_day: number;
  fans_kcal_h: number;
  defrost_kcal_h: number;
  other_kcal_h: number;
  safety_factor_percent: number;
};

export type ColdProEnvironmentProduct = {
  id?: string;
  environment_id?: string;
  product_id?: string | null;
  product_name: string;
  mass_kg_day: number;
  mass_kg_hour: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  process_time_h: number;
  packaging_mass_kg_day: number;
  packaging_specific_heat_kcal_kg_c: number;
  packaging_inlet_temp_c?: number | null;
  packaging_outlet_temp_c?: number | null;
  specific_heat_above_kcal_kg_c: number;
  specific_heat_below_kcal_kg_c: number;
  latent_heat_kcal_kg: number;
  initial_freezing_temp_c?: number | null;
};

export type ColdProTunnel = {
  id?: string;
  environment_id: string;
  tunnel_type: "blast_freezer" | "cooling_tunnel";
  operation_mode: "continuous" | "batch";
  product_name: string;
  product_thickness_mm: number;
  product_unit_weight_kg: number;
  units_per_cycle: number;
  cycles_per_hour: number;
  mass_kg_hour: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  freezing_temp_c?: number | null;
  air_temp_c: number;
  air_velocity_m_s: number;
  process_time_min: number;
  specific_heat_above_kcal_kg_c: number;
  specific_heat_below_kcal_kg_c: number;
  latent_heat_kcal_kg: number;
  packaging_mass_kg_hour: number;
  packaging_specific_heat_kcal_kg_c: number;
  belt_motor_kw: number;
  internal_fans_kw: number;
  other_internal_kw: number;
};

export type ColdProInsulationMaterial = {
  id: string;
  name: string;
  material_type: string;
  conductivity_w_m_k: number;
  conductivity_kcal_h_m_c: number;
  default_thickness_mm?: number | null;
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
