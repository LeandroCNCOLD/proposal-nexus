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

/**
 * Configuração de porta para geração automática de cronograma.
 * O usuário informa a frequência e a duração; o sistema gera os eventos.
 */
export interface DoorScheduleConfig {
  door_id: string;
  door_label?: string;
  opening_area_m2: number;
  protection_type: DoorOpeningEvent["protection_type"];
  openings_per_hour: number;          // Ex: 4 = 1 abertura a cada 15 min
  duration_seconds_per_opening: number; // Ex: 30 = 30 segundos por abertura
  active_start_hour: number;           // Ex: 8 = começa às 8h
  active_end_hour: number;             // Ex: 18 = termina às 18h
}

// ─── Perfil de câmara e degelo ────────────────────────────────────────────────

export type DefrostType = "electrical" | "hot_gas" | "air" | "water" | "none";

/**
 * Configuração de degelo e perfil da câmara.
 * Determina como o simulador trata a máquina parada, risco de gelo e umidade.
 */
export interface ChamberDefrostConfig {
  defrost_type: DefrostType;
  defrost_cycles_per_day: number;      // Ex: 4 = a cada 6h
  defrost_duration_minutes: number;    // Ex: 30 = 30 min por ciclo
  /** Se true, o compressor é desligado durante o degelo (downtime real) */
  compressor_off_during_defrost: boolean;
  /** UR interna alvo (%) — afeta risco de gelo e carga latente */
  internal_relative_humidity_pct: number;
}

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
  /** Eventos explícitos de abertura de porta (gerados por DoorLoadService) */
  door_events?: DoorOpeningEvent[];
  /** Configuração de portas para geração automática de cronograma */
  door_schedule?: DoorScheduleConfig[];
  /** Configuração de degelo e perfil da câmara */
  defrost_config?: ChamberDefrostConfig;
  internal_loads: InternalLoadProfile;
  equipment: EquipmentPolynomialModel;
  /** Temperatura inicial da câmara no início da simulação */
  initial_room_temperature_c?: number;
  simulation_days?: number;
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
  compressor_status: "ON" | "OFF" | "DEFROST";
  equipment_utilization_pct: number;
  thermal_balance_kcal_h: number;
  delta_temperature_c: number;
  /** Carga latente de infiltração (umidade) neste passo */
  latent_load_kcal_h?: number;
  /** Acumulo de gelo estimado neste passo (kg) */
  frost_kg?: number;
  /** Indica se a máquina está em degelo neste passo */
  is_defrost_step?: boolean;
  /** Indica se a temperatura interna está acima do limite máximo neste passo */
  is_out_of_temperature_range?: boolean;
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

  // ─── Novos campos: portas ───────────────────────────────────────────────────────
  total_door_openings: number;
  total_door_infiltration_load_kcal: number;
  door_infiltration_pct_of_total: number;

  // ─── Novos campos: gelo e degelo ──────────────────────────────────────────────
  total_frost_kg: number;
  frost_kg_per_day: number;
  latent_load_pct: number;
  ice_risk_level: "low" | "medium" | "high" | "critical" | "n/a";
  defrost_downtime_hours_per_day: number;
  defrost_cycles_per_day: number;
  recommended_defrost_cycles: number;
  machine_downtime_hours_total: number;
  defrost_warnings: string[];
}

export interface ColdRoomSimulationResult {
  summary: ColdRoomSimulationSummary;
  timeline: ColdRoomSimulationTimeStep[];
  alerts: SimulationAlert[];
  /** Dados prontos para gráficos (amostrados para não sobrecarregar a UI) */
  chart_data: ColdRoomSimulationTimeStep[];
}
