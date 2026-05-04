/**
 * HOOK DE SIMULAÇÃO DINÂMICA
 * Gerencia o estado da simulação, configuração e execução.
 * Integrado com os dados do ambiente ColdPro já calculado.
 */

import * as React from "react";
import { runColdRoomDynamicSimulation } from "../services/coldRoomDynamicSimulationService";
import type {
  ColdRoomSimulationInput,
  ColdRoomSimulationResult,
  WeatherProfileType,
  EnvelopeSurface,
  ProductLoadProfile,
  InternalLoadProfile,
  EquipmentPolynomialModel,
  ColdRoomOperationInput,
} from "../types/coldRoomSimulation.types";

export interface SimulationConfig {
  weather_profile_type: WeatherProfileType;
  custom_max_temp_c?: number;
  custom_min_temp_c?: number;
  custom_humidity_pct?: number;
  simulation_days: 1 | 7 | 30 | 365;
  simulation_step_minutes: 5 | 10 | 15 | 30 | 60;
  setpoint_c: number;
  differential_c: number;
}

export interface UseColdRoomSimulationReturn {
  result: ColdRoomSimulationResult | null;
  isRunning: boolean;
  error: string | null;
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  runSimulation: () => void;
  reset: () => void;
}

const DEFAULT_CONFIG: SimulationConfig = {
  weather_profile_type: "hot_day",
  simulation_days: 1,
  simulation_step_minutes: 15,
  setpoint_c: 2,
  differential_c: 2,
};

/**
 * Constrói o input do simulador a partir dos dados do ambiente ColdPro.
 */
function buildSimulationInput(
  env: any,
  calcResult: any,
  config: SimulationConfig,
): ColdRoomSimulationInput | null {
  if (!env || !calcResult) return null;

  const length = Number(env.length_m ?? env.length ?? 10);
  const width = Number(env.width_m ?? env.width ?? 8);
  const height = Number(env.height_m ?? env.height ?? 3);
  const volume = length * width * height;
  const floorArea = length * width;
  const wallArea = 2 * (length + width) * height;
  const ceilingArea = floorArea;

  // Construir superfícies do envelope a partir dos dados de transmissão
  const surfaces: EnvelopeSurface[] = [
    {
      id: "north_wall",
      name: "Parede Norte",
      type: "wall",
      area_m2: width * height,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? calcResult.uValue ?? 0.3),
      orientation: "north",
      has_solar_gain: false,
    },
    {
      id: "south_wall",
      name: "Parede Sul",
      type: "wall",
      area_m2: width * height,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? 0.3),
      orientation: "south",
      has_solar_gain: true,
      solar_absorptance: 0.4,
    },
    {
      id: "east_wall",
      name: "Parede Leste",
      type: "wall",
      area_m2: length * height,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? 0.3),
      orientation: "east",
      has_solar_gain: true,
      solar_absorptance: 0.4,
    },
    {
      id: "west_wall",
      name: "Parede Oeste",
      type: "wall",
      area_m2: length * height,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? 0.3),
      orientation: "west",
      has_solar_gain: false,
    },
    {
      id: "ceiling",
      name: "Teto",
      type: "ceiling",
      area_m2: ceilingArea,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? 0.3),
      orientation: "roof",
      has_solar_gain: true,
      solar_absorptance: 0.6,
    },
    {
      id: "floor",
      name: "Piso",
      type: "floor",
      area_m2: floorArea,
      u_value_kcal_h_m2_c: env.has_floor_insulation ? Number(calcResult.u_value_kcal_h_m2_c ?? 0.3) : 0.8,
      orientation: "floor",
      has_solar_gain: false,
    },
  ];

  // Produto
  const product: ProductLoadProfile = {
    product_name: env.product_name ?? "Produto genérico",
    product_type: env.environment_type === "seed_storage" ? "seed" : "generic",
    daily_inlet_mass_kg: Number(env.daily_intake_kg ?? env.product_daily_kg ?? 0),
    inlet_temperature_c: Number(env.product_entry_temp_c ?? 20),
    target_temperature_c: config.setpoint_c,
    specific_heat_kcal_kg_c: Number(env.product_specific_heat_above ?? 0.85),
    respiration_heat_enabled: env.environment_type !== "seed_storage",
    respiration_heat_kcal_kg_day: Number(env.respiration_heat_kcal_kg_day ?? 0),
    total_stored_mass_kg: Number(env.product_storage_mass_kg ?? 0),
    inlet_schedule: buildInletSchedule(
      Number(env.daily_intake_kg ?? 0),
      Number(env.product_entry_temp_c ?? 20),
      config.simulation_days,
    ),
  };

  // Cargas internas
  const internalLoads: InternalLoadProfile = {
    lighting_kw: Number(env.lighting_kw ?? calcResult.lighting_load_kcal_h / 860 ?? 0.5),
    people_count: Number(env.people_count ?? 2),
    people_heat_kcal_h_person: Number(env.people_heat_kcal_h ?? 270),
    motors_hp: Number(env.motors_hp ?? 0),
    motors_kw: Number(env.motors_kw ?? 0),
    active_hours: [6, 22],
  };

  // Equipamento — usar dados do resultado do cálculo
  const equipment: EquipmentPolynomialModel = {
    equipment_id: calcResult.selected_equipment_id ?? "auto",
    model_name: calcResult.selected_equipment_model ?? "Equipamento Selecionado",
    refrigerant: calcResult.refrigerant ?? "R404A",
    capacity_polynomial_coefficients: [],
    power_polynomial_coefficients: [],
    valid_evap_temp_range_c: [-40, 10],
    valid_cond_temp_range_c: [20, 55],
    nominal_capacity_kcal_h: Number(
      calcResult.selected_capacity_kcal_h ??
      calcResult.equipment_capacity_kcal_h ??
      calcResult.total_kcal_h * 1.15 ??
      10000
    ),
    nominal_power_kw: Number(calcResult.equipment_power_kw ?? 5),
  };

  const operation: ColdRoomOperationInput = {
    setpoint_c: config.setpoint_c,
    differential_c: config.differential_c,
    operation_hours_per_day: Number(env.compressor_runtime_hours_day ?? 20),
    simulation_step_minutes: config.simulation_step_minutes,
    simulation_days: config.simulation_days,
    max_temperature_c: config.setpoint_c + 3,
    min_temperature_c: config.setpoint_c - 5,
  };

  return {
    environment_id: env.id,
    geometry: { length_m: length, width_m: width, height_m: height, volume_m3: volume, floor_area_m2: floorArea, wall_area_m2: wallArea, ceiling_area_m2: ceilingArea },
    envelope_surfaces: surfaces,
    operation,
    weather_profile_type: config.weather_profile_type,
    product,
    internal_loads: internalLoads,
    equipment,
    initial_room_temperature_c: config.setpoint_c + 2,
  };
}

function buildInletSchedule(dailyMassKg: number, entryTempC: number, days: number) {
  if (dailyMassKg <= 0) return [];
  const schedule = [];
  const startDate = new Date();
  startDate.setHours(8, 0, 0, 0);
  for (let d = 0; d < days; d++) {
    const t = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    schedule.push({ timestamp: t.toISOString(), mass_kg: dailyMassKg, temperature_c: entryTempC });
  }
  return schedule;
}

export function useColdRoomSimulation(
  environment: any,
  calculationResult: any,
): UseColdRoomSimulationReturn {
  const [result, setResult] = React.useState<ColdRoomSimulationResult | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<SimulationConfig>({
    ...DEFAULT_CONFIG,
    setpoint_c: Number(environment?.internal_temp_c ?? environment?.target_temp_c ?? 2),
  });

  const runSimulation = React.useCallback(() => {
    setIsRunning(true);
    setError(null);
    try {
      const input = buildSimulationInput(environment, calculationResult, config);
      if (!input) {
        setError("Dados insuficientes para simulação. Certifique-se de que o cálculo foi realizado.");
        setIsRunning(false);
        return;
      }
      // Executar em setTimeout para não bloquear a UI
      setTimeout(() => {
        try {
          const simResult = runColdRoomDynamicSimulation(input);
          setResult(simResult);
        } catch (e: any) {
          setError(e?.message ?? "Erro ao executar simulação");
        } finally {
          setIsRunning(false);
        }
      }, 50);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao preparar simulação");
      setIsRunning(false);
    }
  }, [environment, calculationResult, config]);

  const reset = React.useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isRunning, error, config, setConfig, runSimulation, reset };
}
