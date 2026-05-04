/**
 * SIMULADOR DINÂMICO DE CÂMARA FRIA — TIPOS E INTERFACES
 * Integrado ao ColdPro — aba adicional após "Resultado"
 */

// ─── Geometria ────────────────────────────────────────────────────────────────

export interface ColdRoomGeometryInput {
  length_m: number;
  width_m: number;
  height_m: number;
  volume_m3: number;
  floor_area_m2: number;
  wall_area_m2: number;
  ceiling_area_m2: number;
}

// ─── Superfícies do envelope ──────────────────────────────────────────────────

export interface EnvelopeSurface {
  id: string;
  name: string;
  type: "wall" | "ceiling" | "floor" | "door";
  area_m2: number;
  u_value_kcal_h_m2_c: number;
  orientation?: "north" | "south" | "east" | "west" | "roof" | "floor";
  has_solar_gain?: boolean;
  solar_absorptance?: number;
}

// ─── Operação ─────────────────────────────────────────────────────────────────

export interface ColdRoomOperationInput {
  setpoint_c: number;
  differential_c: number;
  min_temperature_c?: number;
  max_temperature_c?: number;
  operation_hours_per_day: number;
  simulation_step_minutes: 5 | 10 | 15 | 30 | 60;
  simulation_days: 1 | 7 | 30 | 365;
}

// ─── Clima externo ────────────────────────────────────────────────────────────

export interface ExternalClimatePoint {
  timestamp: string;
  external_temperature_c: number;
  external_relative_humidity_pct: number;
  solar_radiation_w_m2?: number;
  rain?: boolean;
  wind_speed_m_s?: number;
  weather_condition?: "hot" | "cold" | "rain" | "cloudy" | "sunny" | "night";
}

export type WeatherProfileType =
  | "hot_day"
  | "cold_day"
  | "rainy_day"
  | "dry_day"
  | "humid_day"
  | "annual"
  | "manual";

// ─── Produto ──────────────────────────────────────────────────────────────────

export interface ProductInletEvent {
  timestamp: string;
  mass_kg: number;
  temperature_c: number;
}

export interface ProductLoadProfile {
  product_name: string;
  product_type: "seed" | "fruit" | "meat" | "frozen" | "generic";
  daily_inlet_mass_kg: number;
  inlet_temperature_c: number;
  target_temperature_c: number;
  specific_heat_kcal_kg_c: number;
  /** Sementes: sempre false */
  respiration_heat_enabled: boolean;
  respiration_heat_kcal_kg_day?: number;
  inlet_schedule: ProductInletEvent[];
  /** Massa total armazenada — usada apenas para inércia térmica */
  total_stored_mass_kg?: number;
}

// ─── Abertura de portas ───────────────────────────────────────────────────────

export interface DoorOpeningEvent {
  timestamp: string;
  door_id: string;
  duration_seconds: number;
  opening_area_m2: number;
  protection_type: "none" | "curtain" | "air_curtain" | "antechamber" | "fast_door";
}

/** Fatores de redução de infiltração por tipo de proteção */
export const DOOR_PROTECTION_FACTORS: Record<DoorOpeningEvent["protection_type"], number> = {
  none: 1.0,
  curtain: 0.7,
  air_curtain: 0.6,
  fast_door: 0.5,
  antechamber: 0.35,
};

// ─── Cargas internas ──────────────────────────────────────────────────────────

export interface InternalLoadProfile {
  lighting_kw: number;
  people_count: number;
  people_heat_kcal_h_person: number;
  motors_hp: number;
  motors_kw: number;
  /** Horários em que as cargas internas estão ativas (ex: [8, 18] = 8h às 18h) */
  active_hours?: [number, number];
}

// ─── Equipamento — curva polinomial ──────────────────────────────────────────

export interface EquipmentPolynomialModel {
  equipment_id: string;
  model_name: string;
  refrigerant: string;
  capacity_polynomial_coefficients: number[];
  power_polynomial_coefficients: number[];
  valid_evap_temp_range_c: [number, number];
  valid_cond_temp_range_c: [number, number];
  valid_ambient_temp_range_c?: [number, number];
  nominal_airflow_m3_h?: number;
  nominal_capacity_kcal_h?: number;
  nominal_power_kw?: number;
}

export interface EquipmentPerformanceResult {
  cooling_capacity_kcal_h: number;
  electrical_power_kw: number;
  cop: number;
  evaporating_temperature_c: number;
  condensing_temperature_c: number;
  utilization_pct: number;
  warnings: string[];
}

// ─── Entrada completa do simulador ───────────────────────────────────────────

export interface ColdRoomSimulationInput {
  /** ID do ambiente ColdPro (para buscar dados do cálculo estático) */
  environment_id?: string;
  geometry: ColdRoomGeometryInput;
  envelope_surfaces: EnvelopeSurface[];
  operation: ColdRoomOperationInput;
  weather_profile_type: WeatherProfileType;
  climate_data?: ExternalClimatePoint[];
  product: ProductLoadProfile;
  door_events?: DoorOpeningEvent[];
  internal_loads: InternalLoadProfile;
  equipment: EquipmentPolynomialModel;
  /** Temperatura inicial da câmara no início da simulação */
  initial_room_temperature_c?: number;
}

// ─── Passo de tempo ───────────────────────────────────────────────────────────

export interface ColdRoomSimulationTimeStep {
  timestamp: string;
  step_index: number;
  external_temperature_c: number;
  external_relative_humidity_pct: number;
  room_temperature_c: number;
  transmission_load_kcal_h: number;
  infiltration_load_kcal_h: number;
  product_load_kcal_h: number;
  internal_load_kcal_h: number;
  total_load_kcal_h: number;
  equipment_capacity_kcal_h: number;
  equipment_power_kw: number;
  cop: number;
  compressor_status: "ON" | "OFF";
  equipment_utilization_pct: number;
  thermal_balance_kcal_h: number;
  delta_temperature_c: number;
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

export type SimulationAlertSeverity = "critical" | "warning" | "info";

export interface SimulationAlert {
  severity: SimulationAlertSeverity;
  code: string;
  message: string;
  timestamp?: string;
  step_index?: number;
}

// ─── Resultado final ──────────────────────────────────────────────────────────

export interface ColdRoomSimulationSummary {
  simulation_period_days: number;
  simulation_steps_total: number;
  max_room_temperature_c: number;
  min_room_temperature_c: number;
  average_room_temperature_c: number;
  total_cooling_load_kcal: number;
  total_cooling_capacity_kcal: number;
  total_energy_kwh: number;
  average_cop: number;
  compressor_runtime_hours: number;
  compressor_runtime_pct: number;
  max_equipment_utilization_pct: number;
  temperature_out_of_range_hours: number;
  peak_load_kcal_h: number;
  peak_load_timestamp: string;
  peak_external_temp_c: number;
  worst_hour: string;
  recommended_min_capacity_kcal_h: number;
  capacity_adequate: boolean;
}

export interface ColdRoomSimulationResult {
  summary: ColdRoomSimulationSummary;
  timeline: ColdRoomSimulationTimeStep[];
  alerts: SimulationAlert[];
  /** Dados prontos para gráficos (amostrados para não sobrecarregar a UI) */
  chart_data: ColdRoomSimulationTimeStep[];
}
