/**
 * HOOK DE SIMULAÇÃO DINÂMICA
 * Gerencia o estado da simulação, configuração, execução e persistência.
 * Integrado com as server functions do backend para salvar e versionar simulações.
 */

import * as React from "react";
import { runColdRoomDynamicSimulation } from "../services/coldRoomDynamicSimulationService";
import {
  saveSimulation,
  listSimulations,
  getLatestSimulation,
  deleteSimulation,
} from "@/features/coldpro/simulation.functions";
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
  // Operação de portas
  door_openings_per_hour?: number;
  door_duration_seconds?: number;
  door_active_start_hour?: number;
  door_active_end_hour?: number;
  // Degelo e perfil de câmara
  defrost_type?: "electrical" | "hot_gas" | "air" | "water" | "none";
  defrost_cycles_per_day?: number;
  defrost_duration_minutes?: number;
  internal_rh_pct?: number;
  compressor_off_during_defrost?: boolean;
}

export interface SavedSimulationMeta {
  id: string;
  name: string;
  version: number;
  is_latest: boolean;
  weather_profile: string;
  simulation_period_days: number;
  compressor_on_percent: number;
  total_energy_kwh: number;
  equipment_adequacy: string;
  created_at: string;
}

export interface UseColdRoomSimulationReturn {
  result: ColdRoomSimulationResult | null;
  isRunning: boolean;
  isSaving: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  saveError: string | null;
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  savedSimulations: SavedSimulationMeta[];
  lastSavedId: string | null;
  runSimulation: () => void;
  runAndSave: (name?: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  removeSavedSimulation: (id: string) => Promise<void>;
  reset: () => void;
}

const DEFAULT_CONFIG: SimulationConfig = {
  weather_profile_type: "hot_day",
  simulation_days: 1,
  simulation_step_minutes: 15,
  setpoint_c: 2,
  differential_c: 2,
  door_openings_per_hour: 4,
  door_duration_seconds: 30,
  door_active_start_hour: 8,
  door_active_end_hour: 18,
  defrost_type: "none",
  defrost_cycles_per_day: 0,
  defrost_duration_minutes: 30,
  internal_rh_pct: 85,
  compressor_off_during_defrost: true,
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

  const surfaces: EnvelopeSurface[] = [
    {
      id: "north_wall",
      name: "Parede Norte",
      type: "wall",
      area_m2: width * height,
      u_value_kcal_h_m2_c: Number(calcResult.u_value_kcal_h_m2_c ?? 0.3),
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

  // Herdar dados de produto do cálculo térmico base (correção: produto não pode ser zerado se o memorial tem produto)
  const staticProductKcalH = Number(
    calcResult.product_kcal_h ??
    calcResult.breakdown?.product ??
    calcResult.product_load_kcal_h ??
    0
  );
  const dailyMassFromCalc = Number(
    env.daily_intake_kg ??
    env.product_daily_kg ??
    env.daily_movement_kg ??
    (calcResult.products?.[0]?.mass_kg_day) ??
    0
  );
  const entryTempFromCalc = Number(
    env.product_entry_temp_c ??
    env.entry_temperature_c ??
    (calcResult.products?.[0]?.entry_temperature_c) ??
    20
  );

  const product: ProductLoadProfile = {
    product_name: env.product_name ?? calcResult.products?.[0]?.product_name ?? "Produto genérico",
    product_type: env.environment_type === "seed_storage" ? "seed" : "generic",
    daily_inlet_mass_kg: dailyMassFromCalc,
    inlet_temperature_c: entryTempFromCalc,
    target_temperature_c: config.setpoint_c,
    specific_heat_kcal_kg_c: Number(env.product_specific_heat_above ?? calcResult.products?.[0]?.specific_heat_above ?? 0.85),
    respiration_heat_enabled: env.environment_type !== "seed_storage",
    respiration_heat_kcal_kg_day: Number(env.respiration_heat_kcal_kg_day ?? 0),
    total_stored_mass_kg: Number(env.product_storage_mass_kg ?? env.stored_mass_kg ?? 0),
    inlet_schedule: buildInletSchedule(
      dailyMassFromCalc,
      entryTempFromCalc,
      config.simulation_days,
    ),
  };

  const internalLoads: InternalLoadProfile = {
    lighting_kw: Number(env.lighting_kw ?? (calcResult.lighting_kcal_h ?? 0) / 860 ?? 0.5),
    people_count: Number(env.people_count ?? 2),
    people_heat_kcal_h_person: Number(env.people_heat_kcal_h ?? 270),
    motors_hp: Number(env.motors_hp ?? 0),
    motors_kw: Number(env.motors_kw ?? 0),
    active_hours: [6, 22],
  };

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
      (calcResult.total_kcal_h ?? 10000) * 1.15,
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
    geometry: {
      length_m: length,
      width_m: width,
      height_m: height,
      volume_m3: volume,
      floor_area_m2: floorArea,
      wall_area_m2: wallArea,
      ceiling_area_m2: ceilingArea,
    },
    envelope_surfaces: surfaces,
    operation,
    weather_profile_type: config.weather_profile_type,
    product,
    internal_loads: internalLoads,
    equipment,
    initial_room_temperature_c: config.setpoint_c + 2,
    simulation_days: config.simulation_days,
    // Injetar dados de localização para a API climática
    project_ibge_code: env.client_ibge_code,
    project_city_name: env.client_city,
    project_state_code: env.client_state,
    project_latitude: env.client_latitude,
    project_longitude: env.client_longitude,
    // Cronograma de abertura de portas
    door_schedule: (config.door_openings_per_hour ?? 0) > 0
      ? [{
          door_id: "main_door",
          door_label: "Porta principal",
          opening_area_m2: Number(env.door_area_m2 ?? 2.0),
          protection_type: (env.door_protection_type ?? "curtain") as any,
          openings_per_hour: config.door_openings_per_hour!,
          duration_seconds_per_opening: config.door_duration_seconds ?? 30,
          active_start_hour: config.door_active_start_hour ?? 8,
          active_end_hour: config.door_active_end_hour ?? 18,
        }]
      : undefined,
    // Configuração de degelo
    defrost_config: config.defrost_type && config.defrost_type !== "none"
      ? {
          defrost_type: config.defrost_type,
          defrost_cycles_per_day: config.defrost_cycles_per_day ?? 4,
          defrost_duration_minutes: config.defrost_duration_minutes ?? 30,
          compressor_off_during_defrost: config.compressor_off_during_defrost ?? true,
          internal_relative_humidity_pct: config.internal_rh_pct ?? 85,
        }
      : undefined,
    // Tipo de ambiente para análise de perfil
    environment_type: env.environment_type,
    // Dados do cálculo estático para validação de consistência na simulação
    static_required_capacity_kcal_h: Number(
      calcResult.total_kcal_h ??
      calcResult.required_capacity_kcal_h ??
      calcResult.subtotal_kcal_h ??
      0
    ),
    static_product_load_kcal_h: staticProductKcalH,
  } as any;
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [savedSimulations, setSavedSimulations] = React.useState<SavedSimulationMeta[]>([]);
  const [lastSavedId, setLastSavedId] = React.useState<string | null>(null);

  const [config, setConfig] = React.useState<SimulationConfig>({
    ...DEFAULT_CONFIG,
    setpoint_c: Number(environment?.internal_temp_c ?? environment?.target_temp_c ?? 2),
  });

  // Carregar histórico de simulações ao montar
  const loadHistory = React.useCallback(async () => {
    if (!environment?.id) return;
    setIsLoadingHistory(true);
    try {
      const sims = await listSimulations({ data: { environmentId: environment.id } });
      setSavedSimulations(sims as SavedSimulationMeta[]);
    } catch (e: any) {
      console.warn("Erro ao carregar histórico de simulações:", e?.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [environment?.id]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Executar simulação apenas em memória (sem salvar)
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
      setTimeout(async () => {
        try {
          const simResult = await runColdRoomDynamicSimulation(input);
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

  // Executar simulação E salvar no backend
  const runAndSave = React.useCallback(async (name?: string) => {
    if (!environment?.id) {
      setSaveError("Ambiente não identificado. Salve o ambiente antes de executar a simulação.");
      return;
    }
    if (!calculationResult) {
      setSaveError("Execute o cálculo de carga térmica antes de salvar a simulação.");
      return;
    }

    setIsRunning(true);
    setIsSaving(true);
    setError(null);
    setSaveError(null);

    try {
      const saved = await saveSimulation({
        data: {
          environmentId: environment.id,
          name: name ?? `Simulação ${new Date().toLocaleDateString("pt-BR")}`,
          config: {
            weatherProfile: config.weather_profile_type,
            simulationPeriodDays: config.simulation_days,
            timeStepMinutes: config.simulation_step_minutes as any,
            setpointC: config.setpoint_c,
            differentialC: config.differential_c,
            customExternalTempC: config.custom_max_temp_c ?? null,
          },
        },
      });

      setLastSavedId(saved.simulation.id);

      // Também executar localmente para exibir os gráficos
      const input = buildSimulationInput(environment, calculationResult, config);
      if (input) {
        const simResult = await runColdRoomDynamicSimulation(input);
        setResult(simResult);
      }

      // Atualizar histórico
      await loadHistory();
    } catch (e: any) {
      setSaveError(e?.message ?? "Erro ao salvar simulação");
    } finally {
      setIsRunning(false);
      setIsSaving(false);
    }
  }, [environment, calculationResult, config, loadHistory]);

  // Remover simulação salva
  const removeSavedSimulation = React.useCallback(async (id: string) => {
    try {
      await deleteSimulation({ data: { simulationId: id } });
      setSavedSimulations((prev) => prev.filter((s) => s.id !== id));
      if (lastSavedId === id) setLastSavedId(null);
    } catch (e: any) {
      setSaveError(e?.message ?? "Erro ao remover simulação");
    }
  }, [lastSavedId]);

  const reset = React.useCallback(() => {
    setResult(null);
    setError(null);
    setSaveError(null);
    setLastSavedId(null);
  }, []);

  return {
    result,
    isRunning,
    isSaving,
    isLoadingHistory,
    error,
    saveError,
    config,
    setConfig,
    savedSimulations,
    lastSavedId,
    runSimulation,
    runAndSave,
    loadHistory,
    removeSavedSimulation,
    reset,
  };
}
