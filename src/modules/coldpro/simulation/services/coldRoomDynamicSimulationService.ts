/**
 * SERVIÇO PRINCIPAL DE SIMULAÇÃO DINÂMICA DE CÂMARA FRIA
 * Loop de simulação por intervalo de tempo integrando:
 * - Cargas térmicas dinâmicas (transmissão, infiltração, produto, internas)
 * - Curvas polinomiais dos equipamentos (via equipmentPerformanceBridge)
 * - Lógica de controle liga/desliga (setpoint + diferencial)
 * - Balanço térmico e atualização da temperatura interna
 * - Geração de alertas automáticos
 */

import type {
  ColdRoomSimulationInput,
  ColdRoomSimulationResult,
  ColdRoomSimulationTimeStep,
  ColdRoomSimulationSummary,
  SimulationAlert,
  ExternalClimatePoint,
  DoorOpeningEvent,
} from "../types/coldRoomSimulation.types";
import { DOOR_PROTECTION_FACTORS } from "../types/coldRoomSimulation.types";
import { generateWeatherProfile } from "./weatherProfileService";
import { calculateThermalMass } from "./thermalMassService";
import { evaluateEquipmentPerformance } from "./equipmentPerformanceBridge";
import { DoorLoadService } from "./doorLoadService";
import { ChamberProfileService } from "./chamberProfileService";

// ─── Constantes físicas ───────────────────────────────────────────────────────
const AIR_DENSITY_KG_M3 = 1.2;
const AIR_CP_KCAL_KG_C = 0.24;
const WATER_LATENT_HEAT_KCAL_KG = 597;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saturationPressure(tempC: number): number {
  // Fórmula de Antoine simplificada (kPa)
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
}

function absoluteHumidity(tempC: number, rhPct: number): number {
  // kg_água / kg_ar_seco
  const psat = saturationPressure(tempC);
  const pw = (rhPct / 100) * psat;
  return 0.622 * pw / (101.325 - pw);
}

function airEnthalpy(tempC: number, rhPct: number): number {
  // kcal/kg_ar_seco
  const w = absoluteHumidity(tempC, rhPct);
  return AIR_CP_KCAL_KG_C * tempC + w * (597 + 0.441 * tempC);
}

function solarFactor(solarRadiation: number, absorptance: number): number {
  // Fator de temperatura sol-ar (°C) = α × G / h_ext
  // h_ext ≈ 23 W/m²·°C (coeficiente externo convectivo)
  return (absorptance * solarRadiation) / (23 * 1.163); // 1.163 = W→kcal/h/m²
}

// ─── Cálculo de transmissão dinâmica ─────────────────────────────────────────

function calcTransmissionLoad(
  surfaces: ColdRoomSimulationInput["envelope_surfaces"],
  extTemp: number,
  intTemp: number,
  solarRadiation: number,
): number {
  return surfaces.reduce((sum, surf) => {
    const absorptance = surf.solar_absorptance ?? 0.4;
    const sf = surf.has_solar_gain && solarRadiation > 0
      ? solarFactor(solarRadiation, absorptance)
      : 0;
    const effectiveExtTemp = extTemp + sf;
    const load = surf.u_value_kcal_h_m2_c * surf.area_m2 * (effectiveExtTemp - intTemp);
    return sum + Math.max(0, load);
  }, 0);
}

// ─── Cálculo de infiltração dinâmica ─────────────────────────────────────────

function calcInfiltrationLoad(
  extTemp: number,
  extRhPct: number,
  intTemp: number,
  intRhPct: number,
  doorEvents: DoorOpeningEvent[],
  timestamp: string,
  stepMinutes: number,
  volumeM3: number,
): number {
  const stepSeconds = stepMinutes * 60;
  let totalMassKg = 0;

  // Infiltração por abertura de porta
  for (const door of doorEvents) {
    const doorTime = new Date(door.timestamp).getTime();
    const stepTime = new Date(timestamp).getTime();
    const stepEnd = stepTime + stepSeconds * 1000;

    // Verificar se a abertura de porta ocorre neste passo
    if (doorTime >= stepTime && doorTime < stepEnd) {
      const protectionFactor = DOOR_PROTECTION_FACTORS[door.protection_type];
      // Velocidade de infiltração: modelo de fluxo gravitacional
      const deltaT = Math.abs(extTemp - intTemp);
      const velocityMs = Math.sqrt(2 * 9.81 * door.opening_area_m2 * deltaT / (273 + intTemp));
      const flowM3s = door.opening_area_m2 * velocityMs * 0.5; // fator de contração
      const massKg = flowM3s * door.duration_seconds * AIR_DENSITY_KG_M3 * protectionFactor;
      totalMassKg += massKg;
    }
  }

  // Infiltração contínua mínima (trocas de ar por vazamentos)
  const airChangesPerHour = 0.1; // 0.1 trocas/h para câmara bem vedada
  const continuousMassKg = volumeM3 * AIR_DENSITY_KG_M3 * airChangesPerHour * (stepMinutes / 60);
  totalMassKg += continuousMassKg;

  if (totalMassKg <= 0) return 0;

  const intRh = intRhPct ?? 85;
  const hExt = airEnthalpy(extTemp, extRhPct);
  const hInt = airEnthalpy(intTemp, intRh);
  const deltaH = hExt - hInt;

  return Math.max(0, totalMassKg * deltaH);
}

// ─── Cálculo de carga de produto ─────────────────────────────────────────────

function calcProductLoad(
  product: ColdRoomSimulationInput["product"],
  timestamp: string,
  stepMinutes: number,
  intTemp: number,
): number {
  const stepSeconds = stepMinutes * 60;
  const stepTime = new Date(timestamp).getTime();
  const stepEnd = stepTime + stepSeconds * 1000;

  // Verificar se há entrada de produto neste passo
  let massInStep = 0;
  for (const event of product.inlet_schedule) {
    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime >= stepTime && eventTime < stepEnd) {
      massInStep += event.mass_kg;
    }
  }

  if (massInStep <= 0) return 0;

  // Carga sensível do produto
  const sensibleLoad = massInStep * product.specific_heat_kcal_kg_c *
    (product.inlet_temperature_c - intTemp);

  // Calor de respiração (NUNCA para sementes)
  let respirationLoad = 0;
  if (product.respiration_heat_enabled && product.product_type !== "seed" &&
      product.respiration_heat_kcal_kg_day) {
    respirationLoad = massInStep * product.respiration_heat_kcal_kg_day * (stepMinutes / (24 * 60));
  }

  return Math.max(0, sensibleLoad + respirationLoad);
}

// ─── Cálculo de cargas internas ───────────────────────────────────────────────

function calcInternalLoad(
  loads: ColdRoomSimulationInput["internal_loads"],
  hour: number,
): number {
  const [activeStart, activeEnd] = loads.active_hours ?? [6, 22];
  const isActive = hour >= activeStart && hour < activeEnd;
  if (!isActive) return 0;

  const lighting = loads.lighting_kw * 860;
  const people = loads.people_count * loads.people_heat_kcal_h_person;
  const motors = loads.motors_kw * 860 + loads.motors_hp * 632;

  return lighting + people + motors;
}

// ─── Loop principal de simulação ──────────────────────────────────────────────

export async function runColdRoomDynamicSimulation(input: ColdRoomSimulationInput): Promise<ColdRoomSimulationResult> {
  const { operation, geometry, product, internal_loads, equipment } = input;

  // Gerar perfil climático se não fornecido
  const climateData: ExternalClimatePoint[] = input.climate_data?.length
    ? input.climate_data
    : await generateWeatherProfile({
        type: input.weather_profile_type || "annual",
        simulation_days: input.simulation_days ?? operation.simulation_days ?? 365,
        step_minutes: operation.simulation_step_minutes,
      }, 
      (input as any).project_ibge_code,
      (input as any).project_city_name,
      (input as any).project_state_code,
      (input as any).project_latitude,
      (input as any).project_longitude
    );

  // Calcular massa térmica da câmara
  const thermalMass = calculateThermalMass({
    volume_m3: geometry.volume_m3,
    floor_area_m2: geometry.floor_area_m2,
    wall_area_m2: geometry.wall_area_m2,
    stored_product_mass_kg: product.total_stored_mass_kg,
    product_specific_heat_kcal_kg_c: product.specific_heat_kcal_kg_c,
    panel_thickness_m: 0.1,
  });

  const C_total = thermalMass.total_thermal_capacity_kcal_c;
  const stepH = operation.simulation_step_minutes / 60; // horas por passo

  // Estado inicial
  let roomTemp = input.initial_room_temperature_c ?? operation.setpoint_c;
  let compressorStatus: "ON" | "OFF" | "DEFROST" = "OFF";

  // Gerar eventos de porta a partir do cronograma programado (se fornecido)
  const generatedDoorEvents = input.door_schedule?.length
    ? DoorLoadService.generateDoorEvents(
        input.door_schedule.map((d) => ({
          ...d,
          simulation_days: operation.simulation_days,
        }))
      )
    : [];
  const doorEvents: DoorOpeningEvent[] = [
    ...(input.door_events ?? []),
    ...generatedDoorEvents,
  ];

  // Configuração de degelo
  const defrost = input.defrost_config;
  const intRhPct = defrost?.internal_relative_humidity_pct ?? 85;

  const timeline: ColdRoomSimulationTimeStep[] = [];
  const alerts: SimulationAlert[] = [];

  // Contadores para alertas e acumuladores de gelo/porta
  let overloadSteps = 0;
  let outOfRangeSteps = 0;
  let totalFrostKg = 0;
  let totalDoorOpenings = 0;
  let totalDoorInfiltrationKcal = 0;
  let totalLatentLoadKcal = 0;

  for (let i = 0; i < climateData.length; i++) {
    const climate = climateData[i];
    const extTemp = climate.external_temperature_c;
    const extRh = climate.external_relative_humidity_pct;
    const solar = climate.solar_radiation_w_m2 ?? 0;
    const timestamp = climate.timestamp;
    const hour = new Date(timestamp).getHours();

    // ── Verificar se está em degelo ──────────────────────────────────────────
    const isDefrostStep = defrost
      ? ChamberProfileService.isMachineInDefrost(
          timestamp,
          defrost.defrost_cycles_per_day,
          defrost.defrost_duration_minutes
        )
      : false;

    if (isDefrostStep && defrost?.compressor_off_during_defrost) {
      compressorStatus = "DEFROST";
    } else {
      // ── Lógica de controle liga/desliga ────────────────────────────────
      const diff = operation.differential_c;
      if (compressorStatus === "DEFROST") compressorStatus = "OFF"; // Retorna do degelo
      if (roomTemp >= operation.setpoint_c + diff / 2) compressorStatus = "ON";
      if (roomTemp <= operation.setpoint_c - diff / 2) compressorStatus = "OFF";
    }

    // ── Cargas térmicas do passo ──────────────────────────────────────────
    const transmissionLoad = calcTransmissionLoad(
      input.envelope_surfaces, extTemp, roomTemp, solar,
    ) * stepH;

    const infiltrationLoad = calcInfiltrationLoad(
      extTemp, extRh, roomTemp, intRhPct,
      doorEvents, timestamp, operation.simulation_step_minutes,
      geometry.volume_m3,
    );

    // Contar aberturas de porta neste passo
    const stepSeconds = operation.simulation_step_minutes * 60;
    const stepTimeMs = new Date(timestamp).getTime();
    const doorOpeningsInStep = doorEvents.filter((d) => {
      const dt = new Date(d.timestamp).getTime();
      return dt >= stepTimeMs && dt < stepTimeMs + stepSeconds * 1000;
    });
    totalDoorOpenings += doorOpeningsInStep.length;
    if (doorOpeningsInStep.length > 0) {
      totalDoorInfiltrationKcal += infiltrationLoad;
    }

    // Análise de gelo (apenas câmaras negativas)
    const iceAnalysis = ChamberProfileService.analyzeIceRiskStep(
      extTemp, extRh, roomTemp, intRhPct,
      infiltrationLoad > 0 ? geometry.volume_m3 * 0.1 : 0 // Estimar vazão de infiltração
    );
    const latentLoadKcal = iceAnalysis.latentLoadKw * 860 * stepH;
    const frostKgStep = iceAnalysis.frostKgH * stepH;
    totalFrostKg += frostKgStep;
    totalLatentLoadKcal += latentLoadKcal;

    const productLoad = calcProductLoad(product, timestamp, operation.simulation_step_minutes, roomTemp);

    const internalLoad = calcInternalLoad(internal_loads, hour) * stepH;

    const totalLoad = transmissionLoad + infiltrationLoad + productLoad + internalLoad;

    // ── Performance do equipamento ──────────────────────────────────────────
    const perfResult = evaluateEquipmentPerformance({
      room_temperature_c: roomTemp,
      external_temperature_c: extTemp,
      equipment_model: equipment,
      nominal_capacity_kcal_h: equipment.nominal_capacity_kcal_h,
    });

    const isCompressorOn = compressorStatus === "ON";
    const equipCapacity = isCompressorOn ? perfResult.cooling_capacity_kcal_h * stepH : 0;
    const equipPower = isCompressorOn ? perfResult.electrical_power_kw : 0;
    const cop = isCompressorOn ? perfResult.cop : 0;

    // ── Balanço térmico ──────────────────────────────────────────────────────
    const thermalBalance = totalLoad - equipCapacity;
    const deltaTemp = C_total > 0 ? thermalBalance / C_total : 0;
    roomTemp = roomTemp + deltaTemp;

    // Limitar temperatura (física)
    const maxAllowed = operation.max_temperature_c ?? operation.setpoint_c + 10;
    const minAllowed = operation.min_temperature_c ?? operation.setpoint_c - 10;
    roomTemp = Math.max(minAllowed, Math.min(maxAllowed, roomTemp));

    const utilizationPct = compressorStatus === "ON" ? perfResult.utilization_pct : 0;

    // ── Alertas por passo ────────────────────────────────────────────────────
    if (utilizationPct > 95) {
      overloadSteps++;
      if (overloadSteps === 1 || overloadSteps % 24 === 0) {
        alerts.push({
          severity: "warning",
          code: "EQUIPMENT_OVERLOAD",
          message: `Equipamento operando a ${utilizationPct.toFixed(1)}% da capacidade`,
          timestamp,
          step_index: i,
        });
      }
    }

    const maxTemp = operation.max_temperature_c ?? operation.setpoint_c + 3;
    if (roomTemp > maxTemp) {
      outOfRangeSteps++;
      if (outOfRangeSteps === 1 || outOfRangeSteps % 12 === 0) {
        alerts.push({
          severity: "critical",
          code: "TEMP_OUT_OF_RANGE",
          message: `Temperatura interna ${roomTemp.toFixed(1)}°C acima do limite máximo ${maxTemp}°C`,
          timestamp,
          step_index: i,
        });
      }
    }

    if (perfResult.warnings.length > 0 && i === 0) {
      for (const w of perfResult.warnings) {
        alerts.push({ severity: "info", code: "EQUIPMENT_WARNING", message: w, timestamp, step_index: i });
      }
    }

    const maxTempLimit = operation.max_temperature_c ?? operation.setpoint_c + 3;
    const isOutOfRange = roomTemp > maxTempLimit;

    timeline.push({
      timestamp,
      step_index: i,
      external_temperature_c: extTemp,
      external_relative_humidity_pct: extRh,
      room_temperature_c: Math.round(roomTemp * 100) / 100,
      transmission_load_kcal_h: Math.round(transmissionLoad),
      infiltration_load_kcal_h: Math.round(infiltrationLoad),
      product_load_kcal_h: Math.round(productLoad),
      internal_load_kcal_h: Math.round(internalLoad),
      total_load_kcal_h: Math.round(totalLoad),
      equipment_capacity_kcal_h: Math.round(equipCapacity),
      equipment_power_kw: Math.round(equipPower * 100) / 100,
      cop: Math.round(cop * 100) / 100,
      compressor_status: compressorStatus,
      equipment_utilization_pct: Math.round(utilizationPct),
      thermal_balance_kcal_h: Math.round(thermalBalance),
      delta_temperature_c: Math.round(deltaTemp * 1000) / 1000,
      is_out_of_temperature_range: isOutOfRange,
      // Novos campos
      latent_load_kcal_h: Math.round(latentLoadKcal),
      frost_kg: Math.round(frostKgStep * 1000) / 1000,
      is_defrost_step: isDefrostStep,
    });
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  const temps = timeline.map((t) => t.room_temperature_c);
  const loads = timeline.map((t) => t.total_load_kcal_h);
  const peakIdx = loads.indexOf(Math.max(...loads));
  const compressorOnSteps = timeline.filter((t) => t.compressor_status === "ON").length;
  const totalSteps = timeline.length;
  const stepsPerHour = 60 / operation.simulation_step_minutes;
  const compressorHours = compressorOnSteps / stepsPerHour;
  const totalHours = totalSteps / stepsPerHour;
  const outOfRangeHours = outOfRangeSteps / stepsPerHour;
  const totalEnergyKwh = timeline.reduce((s, t) => s + t.equipment_power_kw * stepH, 0);
  const avgCop = timeline.filter((t) => t.cop > 0).reduce((s, t) => s + t.cop, 0) /
    Math.max(1, timeline.filter((t) => t.cop > 0).length);
  const maxUtilization = Math.max(...timeline.map((t) => t.equipment_utilization_pct));
  const peakLoad = Math.max(...loads);
  const recommendedCapacity = peakLoad * 1.1; // 10% de margem sobre o pico

  // ── Correção 1: Dias críticos calculados por data real com 3 critérios (nunca > simulation_days) ──
  const criticalDaysSet = new Set<string>();
  const installedCapacity = equipment.nominal_capacity_kcal_h ?? 0;
  for (const step of timeline) {
    const dateKey = step.timestamp.slice(0, 10);
    const hasCapacityDeficit = step.total_load_kcal_h > step.equipment_capacity_kcal_h;
    const hasTemperatureIssue = step.is_out_of_temperature_range === true;
    const hasThermalDeficit = step.thermal_balance_kcal_h > 0;
    if (hasCapacityDeficit || hasTemperatureIssue || hasThermalDeficit) {
      criticalDaysSet.add(dateKey);
    }
  }
  const criticalDaysCount = Math.min(criticalDaysSet.size, operation.simulation_days);

  // ── Correção 2: Déficit acumulado real (apenas passos onde carga > capacidade entregue) ──
  const accumulatedDeficitKcal = timeline.reduce((sum, step) => {
    const delivered = step.equipment_capacity_kcal_h;
    const demanded = step.total_load_kcal_h;
    return demanded > delivered ? sum + (demanded - delivered) : sum;
  }, 0);

  // ── Correção 3: Superdimensionamento separado (estático vs dinâmico) ──
  const totalLoadKcal = loads.reduce((s, l) => s + l, 0);
  const avgLoadKcalH = totalHours > 0 ? totalLoadKcal / totalHours : 0;
  const staticRequiredKcalH = Number((input as any).static_required_capacity_kcal_h ?? 0);
  const staticSurplusPct = staticRequiredKcalH > 0
    ? Math.round(((installedCapacity - staticRequiredKcalH) / staticRequiredKcalH) * 1000) / 10
    : null;
  const dynamicAvgSurplusPct = avgLoadKcalH > 0
    ? Math.round(((installedCapacity - avgLoadKcalH) / avgLoadKcalH) * 1000) / 10
    : null;
  const dynamicRecommendedSurplusPct = recommendedCapacity > 0
    ? Math.round(((installedCapacity - recommendedCapacity) / recommendedCapacity) * 1000) / 10
    : null;
  const capacityCoveragePct = totalLoadKcal > 0
    ? Math.round((timeline.reduce((s, t) => s + t.equipment_capacity_kcal_h, 0) / totalLoadKcal) * 1000) / 10
    : 100;

  // ── Correção 4: Classificação de capacidade em 4 níveis ──
  const compressorRuntimePct = Math.round((compressorHours / totalHours) * 1000) / 10;
  const doorPctOfTotal = totalLoadKcal > 0
    ? Math.round((totalDoorInfiltrationKcal / totalLoadKcal) * 1000) / 10
    : 0;
  let capacityAssessment: "NOMINALLY_ADEQUATE" | "ADEQUATE_WITH_OPERATIONAL_RISK" | "UNDER_STRESS" | "INSUFFICIENT";
  if (installedCapacity < recommendedCapacity || outOfRangeHours > 5 || compressorRuntimePct > 95) {
    capacityAssessment = "INSUFFICIENT";
  } else if (outOfRangeHours > 0 || compressorRuntimePct > 90 || (accumulatedDeficitKcal > 0 && outOfRangeHours > 0)) {
    capacityAssessment = "UNDER_STRESS";
  } else if (installedCapacity >= recommendedCapacity && doorPctOfTotal > 40) {
    capacityAssessment = "ADEQUATE_WITH_OPERATIONAL_RISK";
  } else {
    capacityAssessment = "NOMINALLY_ADEQUATE";
  }

  // ── Correção 5: Validação de déficit vs temperatura (inconsistência) ──
  const deficitInconsistencyWarning =
    accumulatedDeficitKcal > 0 &&
    outOfRangeHours === 0 &&
    compressorRuntimePct < 80 &&
    installedCapacity >= recommendedCapacity
      ? "Déficit térmico acumulado positivo, mas sem reflexo em temperatura fora do range. Validar metodologia do déficit acumulado."
      : null;

  // ── Correção 6: Validação de percentuais de carga ──
  const transmissionTotal = timeline.reduce((s, t) => s + t.transmission_load_kcal_h, 0);
  const infiltrationTotal = timeline.reduce((s, t) => s + t.infiltration_load_kcal_h, 0);
  const productTotal = timeline.reduce((s, t) => s + t.product_load_kcal_h, 0);
  const internalTotal = timeline.reduce((s, t) => s + t.internal_load_kcal_h, 0);
  const transmissionPct = totalLoadKcal > 0 ? Math.round((transmissionTotal / totalLoadKcal) * 1000) / 10 : 0;
  const infiltrationPct = totalLoadKcal > 0 ? Math.round((infiltrationTotal / totalLoadKcal) * 1000) / 10 : 0;
  const productPct = totalLoadKcal > 0 ? Math.round((productTotal / totalLoadKcal) * 1000) / 10 : 0;
  const internalPct = totalLoadKcal > 0 ? Math.round((internalTotal / totalLoadKcal) * 1000) / 10 : 0;
  const percentSum = transmissionPct + infiltrationPct + productPct + internalPct;
  const percentSumWarning = percentSum < 98 || percentSum > 102
    ? `A soma percentual das cargas (${percentSum.toFixed(1)}%) não fecha em 100%. Verificar duplicidade ou sobreposição entre categorias.`
    : null;

  // Avaliar perfil de câmara (gelo, degelo, risco)
  const chamberProfileResult = defrost
    ? ChamberProfileService.evaluateChamberProfile(
        {
          environment_type: (input as any).environment_type ?? "cold_room",
          setpoint_c: operation.setpoint_c,
          defrost_type: defrost.defrost_type,
          defrost_cycles_per_day: defrost.defrost_cycles_per_day,
          defrost_duration_minutes: defrost.defrost_duration_minutes,
        },
        totalFrostKg,
        loads.reduce((s, l) => s + l, 0),
        totalLatentLoadKcal
      )
    : null;

  const defrostDowntimeHoursDay = defrost
    ? (defrost.defrost_cycles_per_day * defrost.defrost_duration_minutes) / 60
    : 0;

  const summary: ColdRoomSimulationSummary = {
    simulation_period_days: operation.simulation_days,
    simulation_steps_total: totalSteps,
    max_room_temperature_c: Math.max(...temps),
    min_room_temperature_c: Math.min(...temps),
    average_room_temperature_c: temps.reduce((s, t) => s + t, 0) / temps.length,
    total_cooling_load_kcal: totalLoadKcal,
    total_cooling_capacity_kcal: timeline.reduce((s, t) => s + t.equipment_capacity_kcal_h, 0),
    total_energy_kwh: Math.round(totalEnergyKwh),
    average_cop: Math.round(avgCop * 100) / 100,
    compressor_runtime_hours: Math.round(compressorHours * 10) / 10,
    compressor_runtime_pct: compressorRuntimePct,
    max_equipment_utilization_pct: Math.round(maxUtilization),
    temperature_out_of_range_hours: Math.round(outOfRangeHours * 10) / 10,
    peak_load_kcal_h: Math.round(peakLoad),
    peak_load_timestamp: timeline[peakIdx]?.timestamp ?? "",
    peak_external_temp_c: timeline[peakIdx]?.external_temperature_c ?? 0,
    worst_hour: timeline[peakIdx]?.timestamp
      ? new Date(timeline[peakIdx].timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      : "--",
    recommended_min_capacity_kcal_h: Math.round(recommendedCapacity),
    capacity_adequate: installedCapacity >= recommendedCapacity,
    // Diagnóstico de capacidade em 4 níveis
    capacity_assessment: capacityAssessment,
    // Superdimensionamento separado por base de cálculo
    installed_capacity_kcal_h: Math.round(installedCapacity),
    average_dynamic_load_kcal_h: Math.round(avgLoadKcalH),
    static_surplus_pct: staticSurplusPct,
    dynamic_avg_surplus_pct: dynamicAvgSurplusPct,
    dynamic_recommended_surplus_pct: dynamicRecommendedSurplusPct,
    capacity_coverage_pct: capacityCoveragePct,
    // Déficit acumulado real
    accumulated_deficit_kcal: Math.round(accumulatedDeficitKcal),
    critical_days_count: criticalDaysCount,
    // Inconsistências detectadas
    deficit_inconsistency_warning: deficitInconsistencyWarning,
    percent_sum_warning: percentSumWarning,
    // Composição percentual das cargas (base correta: carga total dinâmica)
    transmission_pct: transmissionPct,
    infiltration_pct: infiltrationPct,
    product_pct: productPct,
    internal_pct: internalPct,
    // Portas
    total_door_openings: totalDoorOpenings,
    total_door_infiltration_load_kcal: Math.round(totalDoorInfiltrationKcal),
    door_infiltration_pct_of_total: doorPctOfTotal,
    // Gelo e degelo
    total_frost_kg: Math.round(totalFrostKg * 10) / 10,
    frost_kg_per_day: Math.round((totalFrostKg / (operation.simulation_days || 1)) * 10) / 10,
    latent_load_pct: chamberProfileResult?.latent_load_pct ?? 0,
    ice_risk_level: chamberProfileResult?.risk_level ?? "n/a",
    defrost_downtime_hours_per_day: Math.round(defrostDowntimeHoursDay * 10) / 10,
    defrost_cycles_per_day: defrost?.defrost_cycles_per_day ?? 0,
    recommended_defrost_cycles: chamberProfileResult?.recommended_defrost_cycles ?? 0,
    machine_downtime_hours_total: Math.round(defrostDowntimeHoursDay * (operation.simulation_days || 1) * 10) / 10,
    defrost_warnings: chamberProfileResult?.warnings ?? [],
  };

  // Alertas finais de capacidade — baseados na classificação em 4 níveis
  if (summary.capacity_assessment === "INSUFFICIENT") {
    alerts.unshift({
      severity: "critical",
      code: "CAPACITY_INSUFFICIENT",
      message: `Capacidade nominal insuficiente para o pico térmico dinâmico. Mínimo recomendado: ${Math.round(recommendedCapacity).toLocaleString("pt-BR")} kcal/h. Instalado: ${Math.round(installedCapacity).toLocaleString("pt-BR")} kcal/h.`,
    });
  } else if (summary.capacity_assessment === "UNDER_STRESS") {
    alerts.unshift({
      severity: "warning",
      code: "CAPACITY_UNDER_STRESS",
      message: `Equipamento sob estresse: ${summary.temperature_out_of_range_hours.toFixed(1)}h fora do range e/ou compressor a ${compressorRuntimePct.toFixed(1)}% do tempo. Avaliar aumento de capacidade.`,
    });
  } else if (summary.capacity_assessment === "ADEQUATE_WITH_OPERATIONAL_RISK") {
    alerts.unshift({
      severity: "warning",
      code: "CAPACITY_OPERATIONAL_RISK",
      message: `Capacidade nominalmente adequada, mas com risco operacional: infiltração por portas representa ${doorPctOfTotal.toFixed(1)}% da carga total. Revisar operação das portas.`,
    });
  }

  if (summary.temperature_out_of_range_hours > 2) {
    alerts.unshift({
      severity: "critical",
      code: "TEMP_VIOLATION",
      message: `Temperatura interna ultrapassou o limite máximo por ${summary.temperature_out_of_range_hours.toFixed(1)} horas`,
    });
  }

  // Alerta de inconsistência: déficit acumulado sem reflexo em temperatura
  if (deficitInconsistencyWarning) {
    alerts.push({
      severity: "info",
      code: "DEFICIT_INCONSISTENCY",
      message: deficitInconsistencyWarning,
    });
  }

  // Alerta de percentuais de carga não fechando
  if (percentSumWarning) {
    alerts.push({
      severity: "warning",
      code: "LOAD_PERCENT_MISMATCH",
      message: percentSumWarning,
    });
  }

  // Alerta de produto zerado quando cálculo estático tem produto
  const staticProductLoad = Number((input as any).static_product_load_kcal_h ?? 0);
  if (staticProductLoad > 0 && productTotal === 0) {
    alerts.push({
      severity: "warning",
      code: "PRODUCT_LOAD_NOT_INHERITED",
      message: `A simulação dinâmica não herdou a carga de produto/processo do cálculo térmico base (${Math.round(staticProductLoad).toLocaleString("pt-BR")} kcal/h). Verifique os dados de produto no formulário.`,
    });
  }

  // Alertas de gelo e degelo
  if (summary.ice_risk_level === "critical" || summary.ice_risk_level === "high") {
    alerts.unshift({
      severity: summary.ice_risk_level === "critical" ? "critical" : "warning",
      code: "ICE_RISK",
      message: `Risco ${summary.ice_risk_level === "critical" ? "CRÍTICO" : "ALTO"} de formação de gelo: ${summary.frost_kg_per_day} kg/dia estimados. ${summary.defrost_warnings.join(" ")}`
    });
  }

  if (summary.recommended_defrost_cycles > summary.defrost_cycles_per_day && summary.defrost_cycles_per_day > 0) {
    alerts.push({
      severity: "warning",
      code: "DEFROST_INSUFFICIENT",
      message: `Ciclos de degelo insuficientes. Configurado: ${summary.defrost_cycles_per_day}/dia. Recomendado: ${summary.recommended_defrost_cycles}/dia.`,
    });
  }

  if (summary.machine_downtime_hours_total > 0) {
    alerts.push({
      severity: "info",
      code: "DEFROST_DOWNTIME",
      message: `Máquina parada para degelo: ${summary.defrost_downtime_hours_per_day.toFixed(1)}h/dia (${summary.machine_downtime_hours_total.toFixed(0)}h no período simulado).`,
    });
  }

  if (totalDoorOpenings > 0) {
    alerts.push({
      severity: "info",
      code: "DOOR_INFILTRATION",
      message: `${totalDoorOpenings} aberturas de porta simuladas. Infiltração por portas: ${summary.door_infiltration_pct_of_total.toFixed(1)}% da carga total.`,
    });
  }

  // Amostrar dados para gráficos (máx 500 pontos)
  const sampleRate = Math.max(1, Math.floor(timeline.length / 500));
  const chartData = timeline.filter((_, i) => i % sampleRate === 0);

  return { summary, timeline, alerts, chart_data: chartData };
}
