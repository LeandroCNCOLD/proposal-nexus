import type {
  ColdProEnvironment,
  ColdProEnvironmentProduct,
  ColdProConstructionFace,
  ColdProInsulationMaterial,
  ColdProResult,
  ColdProTunnel,
  ColdProWallLayer,
} from "./coldpro.types";
import {
  AIR_DENSITY_KG_M3,
  AIR_SPECIFIC_HEAT_KCAL_KG_C,
  DEFAULT_PEOPLE_LOAD_KCAL_H,
  KCAL_TO_KJ,
  kcalhToKw,
  kcalhToTr,
  kwToKcalh,
  round2,
} from "./coldpro.constants";
import { calculateAdvancedProcess } from "./advancedProcesses/advancedProcessEngine";
import { calculateEvaporatorFrostRisk, suggestedInfiltrationFactor } from "./extra-loads-preview";
import { calculateEvaporatorFanLoad, calculateMotorLoadKcalH, calculateTechnicalDefrost, calculateTechnicalInfiltration } from "./thermal-calculations";

const W_TO_KCAL_H = 0.859845;
const R_INTERNAL_M2K_W = 0.12;
const R_EXTERNAL_M2K_W = 0.08;
const GLASS_U_VALUES_W_M2K: Record<string, number> = {
  none: 0,
  simple: 5.8,
  double: 2.8,
  triple: 1.8,
  low_e_double: 1.6,
  heated_refrigerated: 2.5,
  insulated: 1.8,
};
const GLASS_SOLAR_FACTORS: Record<string, number> = {
  none: 0,
  simple: 0.85,
  double: 0.75,
  triple: 0.65,
  low_e_double: 0.4,
  heated_refrigerated: 0.55,
  insulated: 0.55,
};
const WATER_LATENT_HEAT_KJ_KG = 2500;

const TUNNEL_ARRANGEMENT_DEFAULTS: Record<string, { airExposure: number; penetration: number; label: string; warning?: string }> = {
  individual_exposed: { airExposure: 1, penetration: 1, label: "Produto individual exposto" },
  tray_layer: { airExposure: 0.8, penetration: 0.8, label: "Bandeja/camada exposta" },
  cart_rack: { airExposure: 0.7, penetration: 0.7, label: "Carrinho com bandejas espaçadas" },
  boxed_product: { airExposure: 0.35, penetration: 0.45, label: "Produto em caixa", warning: "Produto em caixa depende da abertura/perfuração e da passagem real de ar pela embalagem." },
  pallet_block: { airExposure: 0.15, penetration: 0.2, label: "Pallet/bloco compacto", warning: "Congelamento de pallet/bloco é estimativa conservadora e deve ser validado em campo ou por ensaio." },
  bulk_static: { airExposure: 0.1, penetration: 0.15, label: "Massa estática a granel", warning: "Produto a granel tem baixa penetração térmica e forte dependência do arranjo físico." },
};

function tunnelArrangementDefaults(type?: string | null) {
  return TUNNEL_ARRANGEMENT_DEFAULTS[String(type ?? "individual_exposed")] ?? TUNNEL_ARRANGEMENT_DEFAULTS.individual_exposed;
}

export function calculateConvectionCoefficient(airVelocityMS?: number | null, fallback?: number | null): number | null {
  const velocity = n(airVelocityMS);
  if (velocity <= 0) return fallback ?? null;
  return round2(10 + 10 * Math.pow(velocity, 0.8));
}

export function calculateRecommendedAirFlowM3H(powerKw: number, deltaTAirK = 6, airDensityKgM3 = AIR_DENSITY_KG_M3): number {
  const delta = deltaTAirK > 0 ? deltaTAirK : 6;
  const airCpKjKgK = AIR_SPECIFIC_HEAT_KCAL_KG_C * KCAL_TO_KJ;
  const density = airDensityKgM3 > 0 ? airDensityKgM3 : AIR_DENSITY_KG_M3;
  const m3s = n(powerKw) / (density * airCpKjKgK * delta);
  return round2(m3s * 3600);
}

export function estimateFreezingTimePlankMin(params: {
  thicknessM?: number | null;
  distanceToCoreM?: number | null;
  densityKgM3?: number | null;
  thermalConductivityFrozenWMK?: number | null;
  effectiveConductivityWMK?: number | null;
  freezingTempC?: number | null;
  latentHeatKcalKg?: number | null;
  frozenWaterFraction?: number | null;
  airTempC?: number | null;
  airVelocityMS?: number | null;
  convectiveCoefficientWM2K?: number | null;
}): number | null {
  const thickness = n(params.thicknessM);
  const distanceToCore = n(params.distanceToCoreM) > 0 ? n(params.distanceToCoreM) : thickness / 2;
  const density = n(params.densityKgM3);
  const conductivity = n(params.effectiveConductivityWMK) || n(params.thermalConductivityFrozenWMK);
  const tfreeze = n(params.freezingTempC, NaN);
  const latent = n(params.latentHeatKcalKg) * KCAL_TO_KJ;
  const frozenFraction = n(params.frozenWaterFraction, 0.9) || 0.9;
  const h = n(params.convectiveCoefficientWM2K) || n(calculateConvectionCoefficient(params.airVelocityMS));
  const deltaT = tfreeze - n(params.airTempC);
  if (distanceToCore <= 0 || density <= 0 || conductivity <= 0 || !Number.isFinite(tfreeze) || latent <= 0 || h <= 0 || deltaT <= 0) return null;
  const latentJkg = latent * frozenFraction * 1000;
  const seconds = (density * latentJkg / deltaT) * (distanceToCore / h + (distanceToCore * distanceToCore) / (2 * conductivity));
  return round2(seconds / 60);
}

function rangeDown(start: number, min: number, step: number) {
  const values: number[] = [];
  const safeStep = Math.max(0.1, Math.abs(step || 5));
  for (let value = start; value >= min - 0.0001; value -= safeStep) values.push(round2(value));
  if (!values.includes(round2(min))) values.push(round2(min));
  return Array.from(new Set(values));
}

function rangeUp(start: number, max: number, step: number) {
  const values: number[] = [];
  const safeStep = Math.max(0.1, Math.abs(step || 1));
  for (let value = start; value <= max + 0.0001; value += safeStep) values.push(round2(value));
  if (!values.includes(round2(max))) values.push(round2(max));
  return Array.from(new Set(values));
}

export function optimizeProcessAirCondition(params: {
  processType: string;
  arrangementType: string;
  operationMode: "continuous" | "batch";
  qSpecificKjKg: number;
  massKgHour: number;
  batchMassKg: number;
  batchTimeH: number;
  desiredTimeMin: number;
  initialAirTempC: number;
  initialAirVelocityMS: number;
  minAirTempC: number;
  maxAirTempC: number;
  minAirVelocityMS: number;
  maxAirVelocityMS: number;
  airTempStepC: number;
  airVelocityStepMS: number;
  airDeltaTK: number;
  airDensityKgM3?: number | null;
  airExposureFactor: number;
  thermalPenetrationFactor: number;
  distanceToCoreM: number;
  densityKgM3?: number | null;
  thermalConductivityFrozenWMK?: number | null;
  freezingTempC?: number | null;
  latentHeatKcalKg?: number | null;
  frozenWaterFraction: number;
}) {
  const warnings: string[] = [];
  const required = [params.desiredTimeMin, params.distanceToCoreM, n(params.densityKgM3), n(params.thermalConductivityFrozenWMK), n(params.latentHeatKcalKg), n(params.freezingTempC, NaN), params.qSpecificKjKg];
  if (required.some((value) => !Number.isFinite(value) || value <= 0)) {
    return { status: "revisar aplicação", recommendation: null, attempts: [], attempts_count: 0, warnings: ["Não foi possível recomendar condição de ar: faltam dados de produto, geometria, tempo desejado, condutividade, densidade, calor latente ou temperatura de congelamento."], memory: { formula: "Recomendação bloqueada por falta de dados; preset não foi usado como resultado." } };
  }

  const minTemp = Math.min(params.minAirTempC, params.maxAirTempC);
  const maxTemp = Math.max(params.minAirTempC, params.maxAirTempC);
  const minVelocity = Math.min(params.minAirVelocityMS, params.maxAirVelocityMS);
  const maxVelocity = Math.max(params.minAirVelocityMS, params.maxAirVelocityMS);
  const initialTemp = Math.max(minTemp, Math.min(maxTemp, params.initialAirTempC));
  const initialVelocity = Math.max(minVelocity, Math.min(maxVelocity, params.initialAirVelocityMS));
  const coldestTemps = rangeDown(initialTemp, minTemp, params.airTempStepC);
  const velocities = rangeUp(initialVelocity, maxVelocity, params.airVelocityStepMS);
  const powerKw = params.operationMode === "batch"
    ? (params.batchMassKg * params.qSpecificKjKg) / (Math.max(0.1, params.batchTimeH) * 3600)
    : (params.massKgHour * params.qSpecificKjKg) / 3600;
  const effectiveConductivity = n(params.thermalConductivityFrozenWMK) * Math.max(0.01, params.thermalPenetrationFactor);
  const airFlowM3H = calculateRecommendedAirFlowM3H(powerKw, params.airDeltaTK, n(params.airDensityKgM3, AIR_DENSITY_KG_M3));

  const evaluate = (airTempC: number, airVelocityMS: number, phase: string) => {
    const hBase = calculateConvectionCoefficient(airVelocityMS) ?? 0;
    const hEffective = hBase * Math.max(0.01, params.airExposureFactor);
    const estimatedTimeMin = estimateFreezingTimePlankMin({
      distanceToCoreM: params.distanceToCoreM,
      densityKgM3: params.densityKgM3,
      effectiveConductivityWMK: effectiveConductivity,
      freezingTempC: params.freezingTempC,
      latentHeatKcalKg: params.latentHeatKcalKg,
      airTempC,
      convectiveCoefficientWM2K: hEffective,
    });
    const marginPercent = estimatedTimeMin && estimatedTimeMin > 0 ? ((params.desiredTimeMin - estimatedTimeMin) / params.desiredTimeMin) * 100 : null;
    return {
      phase,
      air_temp_c: round2(airTempC),
      air_velocity_m_s: round2(airVelocityMS),
      estimated_time_min: estimatedTimeMin,
      desired_time_min: round2(params.desiredTimeMin),
      margin_percent: marginPercent === null ? null : round2(marginPercent),
      q_specific_kj_kg: round2(params.qSpecificKjKg),
      power_kw: round2(powerKw),
      airflow_m3_h: airFlowM3H,
      h_base_w_m2_k: round2(hBase),
      h_effective_w_m2_k: round2(hEffective),
      k_effective_w_m_k: round2(effectiveConductivity),
      air_exposure_factor: round2(params.airExposureFactor),
      thermal_penetration_factor: round2(params.thermalPenetrationFactor),
      meets: estimatedTimeMin !== null && estimatedTimeMin <= params.desiredTimeMin,
    };
  };

  const attempts: ReturnType<typeof evaluate>[] = [];
  for (const temp of coldestTemps) attempts.push(evaluate(temp, initialVelocity, temp === initialTemp ? "condição inicial" : "redução de temperatura"));
  if (!attempts.some((attempt) => attempt.meets)) {
    for (const velocity of velocities.filter((value) => value > initialVelocity)) attempts.push(evaluate(minTemp, velocity, "aumento de velocidade"));
  }
  if (!attempts.some((attempt) => attempt.meets)) {
    for (const velocity of velocities.filter((value) => value > initialVelocity)) {
      for (const temp of coldestTemps.filter((value) => value > minTemp)) attempts.push(evaluate(temp, velocity, "combinação complementar"));
    }
  }

  const recommendation = attempts.find((attempt) => attempt.meets) ?? null;
  if (!recommendation) warnings.push("Nenhuma combinação dentro dos limites técnicos atingiu o tempo desejado; revisar arranjo, embalagem, dimensão térmica, temperatura limite ou tempo de processo.");
  if (params.arrangementType === "boxed_product" || params.arrangementType === "pallet_block" || params.arrangementType === "bulk_static") warnings.push("Arranjo com baixa exposição ao ar: a recomendação depende da passagem real de ar pela embalagem e do empilhamento físico.");

  const calculatedResult: ColdProResult = {
    status: recommendation ? "adequado" : "inviável",
    recommendation,
    attempts: attempts.slice(0, 40),
    attempts_count: attempts.length,
    warnings,
    memory: {
      formula_energy: "q = Cp_acima × (Ti - Tcong) + L × fração_congelável + Cp_abaixo × (Tcong - Tf)",
      formula_power: params.operationMode === "batch" ? "P_kW = massa_lote × q_kJ_kg / (tempo_h × 3600)" : "P_kW = kg_h × q_kJ_kg / 3600",
      formula_airflow: "Vazao_m3_s = P_kW / (ρ_ar × Cp_ar × ΔT_ar)",
      formula_h: "h_base = 10 + 10 × velocidade_ar^0.8; h_efetivo = h_base × fator_exposicao_ar",
      formula_time: "t = (ρ_produto × L_eff / (Tcong - Tar)) × [(a / h_efetivo) + (a² / (2 × k_efetivo))]",
      strategy: "A condição inicial foi testada primeiro; depois a temperatura do ar foi reduzida até o limite; se necessário, a velocidade foi elevada até encontrar a menor condição que atende.",
    },
  };
}

function n(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundN(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export type DimensioningStatus = "REPROVADO" | "ATENÇÃO - SOBRA BAIXA" | "ADEQUADO" | "SOBREDIMENSIONADO - VALIDAR" | "PENDENTE";

export function consolidateColdProSubtotal(loads: Record<string, unknown>): number {
  return round2([
    "transmission", "product", "packaging", "respiration", "infiltration", "people", "lighting", "motors", "fans", "defrost", "other",
    "tunnel_internal_load", "seed_dehumidification", "advanced_processes", "evaporator_frost",
  ].reduce((sum, key) => sum + n(loads[key]), 0));
}

export function dimensioningStatus(requiredKcalH: number, correctedTotalKcalH: number): DimensioningStatus {
  if (requiredKcalH <= 0 || correctedTotalKcalH <= 0) return "PENDENTE";
  const surplus = ((correctedTotalKcalH - requiredKcalH) / requiredKcalH) * 100;
  if (correctedTotalKcalH < requiredKcalH) return "REPROVADO";
  if (surplus >= 0 && surplus < 10) return "ATENÇÃO - SOBRA BAIXA";
  if (surplus >= 10 && surplus <= 30) return "ADEQUADO";
  return "SOBREDIMENSIONADO - VALIDAR";
}

export function buildThermalCalculationResult(result: any, selection?: any | null) {
  const breakdown = result?.calculation_breakdown ?? {};
  const loads = {
    transmission: result?.transmission_kcal_h,
    product: result?.product_kcal_h,
    packaging: result?.packaging_kcal_h,
    respiration: breakdown?.respiration_kcal_h,
    infiltration: result?.infiltration_kcal_h,
    people: result?.people_kcal_h,
    lighting: result?.lighting_kcal_h,
    motors: result?.motors_kcal_h,
    fans: result?.fans_kcal_h,
    defrost: result?.defrost_kcal_h,
    other: result?.other_kcal_h,
    tunnel_internal_load: result?.tunnel_internal_load_kcal_h,
    seed_dehumidification: breakdown?.seed_dehumidification?.total_kcal_h,
    advanced_processes: breakdown?.advanced_processes_kcal_h,
    evaporator_frost: breakdown?.evaporator_frost?.additional_load_kcal_h,
  };
  const subtotalCalculated = consolidateColdProSubtotal(loads);
  const subtotalDisplayed = round2(n(result?.subtotal_kcal_h));
  const safetyFactor = round2(n(result?.safety_factor_percent));
  const requiredCalculated = round2(subtotalCalculated * (1 + safetyFactor / 100));
  const requiredDisplayed = round2(n(result?.total_required_kcal_h));
  const quantity = Math.max(0, n(selection?.quantity));
  const correctedUnit = round2(n(selection?.capacity_unit_kcal_h));
  const correctedTotalCalculated = round2(correctedUnit * quantity);
  const correctedTotalDisplayed = round2(n(selection?.capacity_total_kcal_h));
  const surplusCalculated = requiredCalculated > 0 ? round2(((correctedTotalCalculated - requiredCalculated) / requiredCalculated) * 100) : 0;
  const surplusDisplayed = round2(n(selection?.surplus_percent));
  const blockers: Array<{ code: string; message: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];
  const addBlocker = (code: string, message: string) => blockers.push({ code, message });
  if (Math.abs(subtotalCalculated - subtotalDisplayed) > 1) addBlocker("subtotal_mismatch", "Subtotal calculado pela soma das parcelas não fecha com o subtotal exibido.");
  if (Math.abs(requiredCalculated - requiredDisplayed) > 1) addBlocker("required_load_mismatch", "Carga requerida calculada não fecha com a carga requerida exibida.");
  if (selection && Math.abs(correctedTotalCalculated - correctedTotalDisplayed) > 1) addBlocker("capacity_total_mismatch", "Capacidade total exibida não fecha com capacidade unitária corrigida multiplicada pela quantidade.");
  if (selection && Math.abs(surplusCalculated - surplusDisplayed) > 0.1) addBlocker("surplus_mismatch", "Sobra técnica exibida não fecha com capacidade corrigida total e carga requerida validada.");
  for (const alert of Array.isArray(breakdown?.validation_alerts) ? breakdown.validation_alerts : []) {
    if (["internal_rh_zero", "product_energy_inconsistent"].includes(String(alert.code))) addBlocker(String(alert.code), String(alert.message));
    if (["negative_room_without_defrost", "door_without_infiltration"].includes(String(alert.code))) addBlocker(String(alert.code), String(alert.message));
  }
  if (!selection) warnings.push({ code: "equipment_selection_missing", message: "Seleção de equipamento ainda não vinculada ao resultado validado." });
  const status = dimensioningStatus(requiredCalculated, correctedTotalCalculated);
  return {
    subtotal_validado: subtotalCalculated,
    subtotal_exibido: subtotalDisplayed,
    subtotal_diferenca_kcal_h: round2(subtotalCalculated - subtotalDisplayed),
    fator_segurança: safetyFactor,
    carga_requerida_validada: requiredCalculated,
    carga_requerida_exibida: requiredDisplayed,
    carga_requerida_diferenca_kcal_h: round2(requiredCalculated - requiredDisplayed),
    capacidade_nominal_kcal_h: n(selection?.curve_metadata?.capacity_nominal_kcal_h ?? selection?.curve_metadata?.catalog_reference_capacity_kcal_h),
    capacidade_unitaria_corrigida: correctedUnit,
    quantidade: quantity,
    capacidade_total_corrigida: correctedTotalCalculated,
    capacidade_total_exibida: correctedTotalDisplayed,
    capacidade_total_diferenca_kcal_h: round2(correctedTotalCalculated - correctedTotalDisplayed),
    sobra_percentual: surplusCalculated,
    sobra_percentual_exibida: surplusDisplayed,
    sobra_diferenca_percentual: round2(surplusCalculated - surplusDisplayed),
    status_dimensionamento: status,
    emissao_permitida: blockers.length ? "PRELIMINAR" : "FINAL",
    bloqueios: blockers,
    avisos: warnings,
    curva: {
      modelo: selection?.model ?? null,
      refrigerante: selection?.refrigerant ?? null,
      temperatura_interna_c: selection?.curve_temperature_room_c ?? null,
      temperatura_evaporacao_c: selection?.curve_evaporation_temp_c ?? null,
      temperatura_condensacao_c: selection?.curve_condensation_temp_c ?? null,
      fonte: selection?.selection_method ?? null,
      r2: selection?.curve_polynomial_r2 ?? null,
      potencia_eletrica_kw: selection?.total_power_kw ?? null,
      cop: selection?.cop ?? null,
      vazao_m3_h: selection?.air_flow_total_m3_h ?? null,
      versao_calculo: "coldpro-validation-v1",
      data_curva: selection?.created_at ?? null,
    },
    loads,
  };
}

function saturationVaporPressureKpa(tempC: number): number {
  return 0.61078 * Math.exp((17.2694 * tempC) / (tempC + 237.29));
}

function humidityRatioKgKg(tempC: number, relativeHumidityPercent: number, atmosphericPressureKpa: number): number {
  const rh = Math.max(0, Math.min(1, relativeHumidityPercent / 100));
  const pws = saturationVaporPressureKpa(tempC);
  const pv = rh * pws;
  if (atmosphericPressureKpa <= pv || atmosphericPressureKpa <= 0) return 0;
  return 0.62198 * pv / (atmosphericPressureKpa - pv);
}

export function calculateSeedDehumidificationLoad(env: ColdProEnvironment) {
  const warnings: string[] = [];
  if (env.environment_type !== "seed_storage") {
    return { applies: false, total_kcal_h: 0, total_kw: 0, warnings, memory: null };
  }

  const pressure = n(env.atmospheric_pressure_kpa, 101.325) || 101.325;
  const externalRh = n(env.external_relative_humidity_percent);
  const internalRh = n(env.relative_humidity_percent);
  const externalW = humidityRatioKgKg(n(env.external_temp_c), externalRh, pressure);
  const internalW = humidityRatioKgKg(n(env.internal_temp_c), internalRh, pressure);
  const deltaW = externalW - internalW;
  const volumeFlowM3H = n(env.volume_m3) * n(env.air_changes_per_hour) + n(env.fresh_air_m3_h) + n(env.door_infiltration_m3_h);
  const dryAirFlowKgH = volumeFlowM3H * AIR_DENSITY_KG_M3;
  const waterFromAirKgH = deltaW > 0 ? dryAirFlowKgH * deltaW : 0;
  if (deltaW <= 0) warnings.push("Umidade externa menor ou igual à umidade interna desejada: não foi calculada remoção de umidade do ar externo.");

  const initialMoisture = n(env.seed_initial_moisture_percent) / 100;
  const finalMoisture = n(env.seed_final_moisture_percent) / 100;
  const seedMass = n(env.seed_mass_kg);
  const stabilizationTimeH = n(env.seed_stabilization_time_h);
  const waterFromSeedKg = initialMoisture > finalMoisture && finalMoisture < 1 ? seedMass * (initialMoisture - finalMoisture) / (1 - finalMoisture) : 0;
  if (initialMoisture <= finalMoisture) warnings.push("Umidade inicial da semente menor ou igual à umidade final desejada: não foi calculada remoção de água da semente.");
  if (waterFromSeedKg > 0 && stabilizationTimeH <= 0) warnings.push("Informe o tempo de estabilização para transformar a água removida da semente em kg/h.");
  const waterFromSeedKgH = waterFromSeedKg > 0 && stabilizationTimeH > 0 ? waterFromSeedKg / stabilizationTimeH : 0;
  const latentAirKw = waterFromAirKgH * WATER_LATENT_HEAT_KJ_KG / 3600;
  const latentSeedKw = waterFromSeedKgH * WATER_LATENT_HEAT_KJ_KG / 3600;
  const totalKw = latentAirKw + latentSeedKw;

  return {
    applies: true,
    total_kcal_h: round2(kwToKcalh(totalKw)),
    total_kw: round2(totalKw),
    external_absolute_humidity_kg_kg: roundN(externalW, 5),
    internal_absolute_humidity_kg_kg: roundN(internalW, 5),
    delta_w_kg_kg: roundN(deltaW, 5),
    air_flow_m3_h: round2(volumeFlowM3H),
    dry_air_flow_kg_h: round2(dryAirFlowKgH),
    water_removed_air_kg_h: round2(waterFromAirKgH),
    water_removed_seed_kg: round2(waterFromSeedKg),
    water_removed_seed_kg_h: round2(waterFromSeedKgH),
    latent_air_kw: round2(latentAirKw),
    latent_seed_kw: round2(latentSeedKw),
    warnings,
    memory: {
      formula_pv: "Pv = UR × Pws",
      formula_w: "W = 0,62198 × Pv / (P_atm - Pv)",
      formula_air: "água_ar_kg_h = vazão_ar_kg_h × (W_externo - W_interno)",
      formula_seed: "água_semente = massa × (Ui - Uf) / (1 - Uf)",
      formula_latent: "Q_latente_kW = água_kg_h × 2500 / 3600",
    },
  };
}

function positive(value: number): number {
  return Math.max(0, value);
}

function kcalFromKj(value: unknown): number {
  const kj = n(value);
  return kj > 0 ? kj / KCAL_TO_KJ : 0;
}

function thermalValueKcal(kcal: unknown, kj: unknown): number {
  return n(kcal) || kcalFromKj(kj);
}

function waterFreezeFraction(item: Pick<ColdProEnvironmentProduct | ColdProTunnel, "frozen_water_fraction" | "freezable_water_content_percent" | "water_content_percent">): number {
  const explicit = n(item.frozen_water_fraction, NaN);
  if (Number.isFinite(explicit) && explicit > 0) return explicit > 1 ? explicit / 100 : explicit;
  const freezable = n(item.freezable_water_content_percent, NaN);
  if (Number.isFinite(freezable) && freezable > 0) return freezable / 100;
  const water = n(item.water_content_percent, NaN);
  if (Number.isFinite(water) && water > 0) return Math.min(1, water / 100);
  return 1;
}

export function calculateVolume(env: Pick<ColdProEnvironment, "length_m" | "width_m" | "height_m">): number {
  return positive(n(env.length_m) * n(env.width_m) * n(env.height_m));
}

export function calculateSurfaceAreas(env: ColdProEnvironment) {
  const length = n(env.length_m);
  const width = n(env.width_m);
  const height = n(env.height_m);

  return {
    wallArea: 2 * (length * height + width * height),
    ceilingArea: length * width,
    floorArea: length * width,
  };
}

export function calculateUValue(layers: Pick<ColdProWallLayer, "thickness_m" | "conductivity_w_mk">[]): number {
  const layerResistance = layers.reduce((sum, layer) => {
    const thickness = n(layer.thickness_m);
    const conductivity = n(layer.conductivity_w_mk);
    return conductivity > 0 ? sum + thickness / conductivity : sum;
  }, 0);
  const totalResistance = R_INTERNAL_M2K_W + layerResistance + R_EXTERNAL_M2K_W;
  return totalResistance > 0 ? 1 / totalResistance : 0;
}

function constructionFaces(env: ColdProEnvironment): ColdProConstructionFace[] {
  return Array.isArray(env.construction_faces) ? env.construction_faces.filter((face) => face.local !== "__GEOMETRY__") : [];
}

function faceArea(face: ColdProConstructionFace) {
  return positive(n(face.panel_area_m2));
}

function faceDeltaT(face: ColdProConstructionFace, env: ColdProEnvironment) {
  const targetTemp = face.local === "PISO"
    ? (face.external_temp_c ?? env.floor_temp_c ?? (env.has_floor_insulation ? env.external_temp_c : 20))
    : face.external_temp_c ?? env.external_temp_c;
  return positive(n(targetTemp) - n(env.internal_temp_c));
}

function glassUValue(face: ColdProConstructionFace) {
  const key = String(face.glass_type ?? "none").trim().toLowerCase();
  return GLASS_U_VALUES_W_M2K[key] ?? GLASS_U_VALUES_W_M2K.none;
}

function glassSolarFactor(face: ColdProConstructionFace) {
  const key = String(face.glass_type ?? "none").trim().toLowerCase();
  return GLASS_SOLAR_FACTORS[key] ?? GLASS_SOLAR_FACTORS.none;
}

export function calculateFaceTransmission(face: ColdProConstructionFace, env: ColdProEnvironment) {
  const layers = Array.isArray(face.layers) ? face.layers.filter((layer) => n(layer.thickness_m) > 0 && n(layer.conductivity_w_mk) > 0) : [];
  const area = faceArea(face);
  const glassArea = Math.min(area, positive(n(face.glass_area_m2)));
  const insulatedArea = positive(area - glassArea);
  const deltaT = faceDeltaT(face, env);
  const uValue = layers.length ? calculateUValue(layers) : n(face.u_value_w_m2k);
  const panelWatts = uValue * insulatedArea * deltaT;
  const glassU = glassArea > 0 ? glassUValue(face) : 0;
  const glassWatts = glassU * glassArea * deltaT;
  const solarRadiation = glassArea > 0 ? positive(n(face.solar_radiation_w_m2)) : 0;
  const solarFactor = glassArea > 0 ? glassSolarFactor(face) : 0;
  const glassSolarWatts = glassArea * solarRadiation * solarFactor;
  const watts = panelWatts + glassWatts + glassSolarWatts;
  const kcalH = watts * W_TO_KCAL_H;
  return {
    local: face.local,
    area_m2: round2(area),
    insulated_area_m2: round2(insulatedArea),
    glass_area_m2: round2(glassArea),
    delta_t_c: round2(deltaT),
    solar_radiation_w_m2: round2(solarRadiation),
    glass_solar_factor: round2(solarFactor),
    u_value_w_m2k: round2(uValue),
    glass_u_value_w_m2k: round2(glassU),
    panel_transmission_w: round2(panelWatts),
    glass_transmission_w: round2(glassWatts),
    glass_solar_w: round2(glassSolarWatts),
    panel_transmission_kcal_h: round2(panelWatts * W_TO_KCAL_H),
    glass_transmission_kcal_h: round2(glassWatts * W_TO_KCAL_H),
    glass_solar_kcal_h: round2(glassSolarWatts * W_TO_KCAL_H),
    transmission_w: round2(watts),
    transmission_kw: round2(watts / 1000),
    transmission_kcal_h: round2(kcalH),
    transmission_tr: round2(kcalhToTr(kcalH)),
    layers: layers.map((layer) => ({
      material_name: layer.material_name,
      thickness_m: n(layer.thickness_m),
      conductivity_w_mk: n(layer.conductivity_w_mk),
      position: n(layer.position),
    })),
  };
}

export function calculateConstructionTransmission(env: ColdProEnvironment) {
  const faces = constructionFaces(env).filter((face) => faceArea(face) > 0 && (Array.isArray(face.layers) || n(face.u_value_w_m2k) > 0));
  const faceResults = faces.map((face) => calculateFaceTransmission(face, env));
  const totalW = faceResults.reduce((sum, face) => sum + face.transmission_w, 0);
  const totalKcalH = totalW * W_TO_KCAL_H;
  const totalGlassW = faceResults.reduce((sum, face) => sum + face.glass_transmission_w + face.glass_solar_w, 0);
  return {
    total_w: round2(totalW),
    total_kw: round2(totalW / 1000),
    total_kcal_h: round2(totalKcalH),
    total_tr: round2(kcalhToTr(totalKcalH)),
    glass_total_w: round2(totalGlassW),
    glass_total_kcal_h: round2(totalGlassW * W_TO_KCAL_H),
    faces: faceResults,
  };
}

export function calculateTransmissionLoad(params: {
  env: ColdProEnvironment;
  insulation: ColdProInsulationMaterial;
}): number {
  const { env, insulation } = params;
  const construction = calculateConstructionTransmission(env);
  if (construction.faces.length > 0) return construction.total_kcal_h;
  const areas = calculateSurfaceAreas(env);
  const deltaT = positive(n(env.external_temp_c) - n(env.internal_temp_c));
  const k = n(insulation.conductivity_kcal_h_m_c);

  const wallThicknessM = positive(n(env.wall_thickness_mm) / 1000);
  const ceilingThicknessM = positive(n(env.ceiling_thickness_mm) / 1000);
  const floorThicknessM = positive(n(env.floor_thickness_mm) / 1000);

  const wallU = wallThicknessM > 0 ? k / wallThicknessM : 0;
  const ceilingU = ceilingThicknessM > 0 ? k / ceilingThicknessM : 0;
  const floorU = env.has_floor_insulation && floorThicknessM > 0 ? k / floorThicknessM : 0;

  const wallLoad = wallU * areas.wallArea * deltaT;
  const ceilingLoad = ceilingU * areas.ceilingArea * deltaT;

  const floorDeltaT =
    env.has_floor_insulation && env.floor_temp_c !== null && env.floor_temp_c !== undefined
      ? positive(n(env.floor_temp_c) - n(env.internal_temp_c))
      : deltaT;

  const floorLoad = floorU * areas.floorArea * floorDeltaT;

  return wallLoad + ceilingLoad + floorLoad;
}

export function calculateProductLoad(product: ColdProEnvironmentProduct): number {
  return calculateProductLoadBreakdown(product).total_kcal_h;
}

export function calculateProductRespirationLoad(product: ColdProEnvironmentProduct, storageTempC: number): number {
  const points = [
    [0, product.respiration_rate_0c_w_kg ?? (product.respiration_rate_0c_mw_kg != null ? product.respiration_rate_0c_mw_kg / 1000 : null)],
    [5, product.respiration_rate_5c_w_kg ?? (product.respiration_rate_5c_mw_kg != null ? product.respiration_rate_5c_mw_kg / 1000 : null)],
    [10, product.respiration_rate_10c_w_kg ?? (product.respiration_rate_10c_mw_kg != null ? product.respiration_rate_10c_mw_kg / 1000 : null)],
    [15, product.respiration_rate_15c_w_kg ?? (product.respiration_rate_15c_mw_kg != null ? product.respiration_rate_15c_mw_kg / 1000 : null)],
    [20, product.respiration_rate_20c_w_kg ?? (product.respiration_rate_20c_mw_kg != null ? product.respiration_rate_20c_mw_kg / 1000 : null)],
  ].filter((row): row is [number, number] => row[1] !== null && row[1] !== undefined && Number.isFinite(Number(row[1])));

  if (points.length === 0) return 0;
  const mass = n(product.mass_kg_day) > 0 ? n(product.mass_kg_day) : n(product.mass_kg_hour) * 24;
  const temp = Math.max(points[0][0], Math.min(points[points.length - 1][0], storageTempC));
  let rate = points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [t1, r1] = points[i];
    const [t2, r2] = points[i + 1];
    if (temp >= t1 && temp <= t2) {
      rate = r1 + ((r2 - r1) * (temp - t1)) / (t2 - t1);
      break;
    }
  }
  return mass * rate * W_TO_KCAL_H;
}

export function calculateProductLoadBreakdown(product: ColdProEnvironmentProduct) {
  const loadMode = String(product.product_load_mode ?? "daily_intake");
  const storedMovement = n(product.stored_mass_kg) * (n(product.daily_turnover_percent) / 100);
  const massDay = loadMode === "storage_turnover"
    ? storedMovement
    : loadMode === "hourly_intake"
      ? n(product.hourly_movement_kg || product.mass_kg_hour) * 24
      : loadMode === "room_pull_down_or_freezing"
        ? n(product.freezing_batch_mass_kg)
        : n(product.daily_movement_kg) || n(product.mass_kg_day) || n(product.mass_kg_hour) * n(product.process_time_h);
  const hours = loadMode === "hourly_intake"
    ? 1
    : loadMode === "room_pull_down_or_freezing"
      ? n(product.freezing_batch_time_h) || n(product.recovery_time_h) || n(product.process_time_h, 24) || 24
      : n(product.recovery_time_h) || n(product.process_time_h, 24) || 24;
  const hourlyMass = loadMode === "hourly_intake" ? n(product.hourly_movement_kg || product.mass_kg_hour) : hours > 0 ? massDay / hours : 0;
  const tin = n(product.inlet_temp_c);
  const tout = n(product.outlet_temp_c);
  const tfreeze = product.initial_freezing_temp_c;

  const cpAbove = thermalValueKcal(product.specific_heat_above_kcal_kg_c, product.specific_heat_above_kj_kg_k);
  const cpBelow = thermalValueKcal(product.specific_heat_below_kcal_kg_c, product.specific_heat_below_kj_kg_k);
  const latent = thermalValueKcal(product.latent_heat_kcal_kg, product.latent_heat_kj_kg);
  const allowPhaseChange = product.allow_phase_change !== false;
  const frozenFraction = waterFreezeFraction(product);

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;

  if (allowPhaseChange && tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = massDay * cpAbove * positive(tin - tfreeze);
    latentLoad = massDay * latent * frozenFraction;
    sensibleBelow = massDay * cpBelow * positive(tfreeze - tout);
  } else {
    const cp = tin >= 0 && tout >= 0 ? cpAbove : cpBelow || cpAbove;
    sensibleAbove = massDay * cp * Math.abs(tin - tout);
  }

  const totalEnergy = sensibleAbove + latentLoad + sensibleBelow;
  const total = loadMode === "hourly_intake" ? totalEnergy / 24 : totalEnergy / hours;
  const warnings = [loadMode === "room_pull_down_or_freezing" ? "Câmara de armazenagem usada para resfriar/congelar produto novo: validar circulação de ar, empilhamento, embalagem, área exposta e tempo disponível; para cargas intensas ou recorrentes, considerar túnel dedicado." : null].filter(Boolean);
  return {
    product_name: product.product_name,
    product_load_mode: loadMode,
    movement_basis: product.movement_basis ?? (loadMode === "storage_turnover" ? "calculated_from_stock" : loadMode === "hourly_intake" ? "manual_hourly" : loadMode === "room_pull_down_or_freezing" ? "batch_recovery" : "manual_daily"),
    stored_mass_kg: round2(n(product.stored_mass_kg)),
    daily_turnover_percent: round2(n(product.daily_turnover_percent)),
    daily_movement_kg: round2(loadMode === "storage_turnover" ? storedMovement : n(product.daily_movement_kg) || n(product.mass_kg_day)),
    hourly_movement_kg: round2(hourlyMass),
    recovery_time_h: round2(hours),
    is_freezing_inside_storage_room: loadMode === "room_pull_down_or_freezing" || product.is_freezing_inside_storage_room === true,
    warnings,
    mass_kg_day: round2(massDay),
    hours,
    inlet_temp_c: tin,
    outlet_temp_c: tout,
    freezing_temp_c: tfreeze ?? null,
    cp_above_kcal_kg_c: cpAbove,
    cp_below_kcal_kg_c: cpBelow,
    cp_above_kj_kg_k: product.specific_heat_above_kj_kg_k ?? round2(cpAbove * KCAL_TO_KJ),
    cp_below_kj_kg_k: product.specific_heat_below_kj_kg_k ?? round2(cpBelow * KCAL_TO_KJ),
    latent_heat_kcal_kg: latent,
    latent_heat_kj_kg: product.latent_heat_kj_kg ?? round2(latent * KCAL_TO_KJ),
    frozen_water_fraction: frozenFraction,
    composition_percent: {
      water: product.water_content_percent ?? null,
      protein: product.protein_content_percent ?? null,
      fat: product.fat_content_percent ?? null,
      carbohydrate: product.carbohydrate_content_percent ?? null,
      fiber: product.fiber_content_percent ?? null,
      ash: product.ash_content_percent ?? null,
    },
    total_energy_kcal: round2(totalEnergy),
    sensible_above_energy_kcal: round2(sensibleAbove),
    latent_energy_kcal: round2(latentLoad),
    sensible_below_energy_kcal: round2(sensibleBelow),
    energy_steps_sum_kcal: round2(sensibleAbove + latentLoad + sensibleBelow),
    energy_consistency_delta_kcal: round2(Math.abs(totalEnergy - (sensibleAbove + latentLoad + sensibleBelow))),
    specific_energy_kcal_kg: massDay > 0 ? round2(totalEnergy / massDay) : 0,
    sensible_above_kcal_h: round2(loadMode === "hourly_intake" ? sensibleAbove / 24 : sensibleAbove / hours),
    latent_kcal_h: round2(loadMode === "hourly_intake" ? latentLoad / 24 : latentLoad / hours),
    sensible_below_kcal_h: round2(loadMode === "hourly_intake" ? sensibleBelow / 24 : sensibleBelow / hours),
    total_kcal_h: round2(total),
    source: product.product_id ? "Catálogo ASHRAE/CN ColdPro" : "Manual",
  };
}

export function calculatePackagingLoad(product: ColdProEnvironmentProduct): number {
  const mass = n(product.packaging_mass_kg_day);
  const cp = n(product.packaging_specific_heat_kcal_kg_c);
  const tin = product.packaging_inlet_temp_c ?? product.inlet_temp_c;
  const tout = product.packaging_outlet_temp_c ?? product.outlet_temp_c;
  const hours = n(product.process_time_h, 24) || 24;

  return (mass * cp * Math.abs(n(tin) - n(tout))) / hours;
}

export function calculateInfiltrationLoad(env: ColdProEnvironment): number {
  return calculateTechnicalInfiltration(env).totalInfiltrationKcalH;
}

export function calculatePeopleLoad(env: ColdProEnvironment): number {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  return (n(env.people_count) * DEFAULT_PEOPLE_LOAD_KCAL_H * n(env.people_hours_day)) / compressorHours;
}

export function calculateLightingLoad(env: ColdProEnvironment): number {
  const compressorHours = n(env.compressor_runtime_hours_day, 20) || 20;
  return (kwToKcalh(n(env.lighting_power_w) / 1000) * n(env.lighting_hours_day)) / compressorHours;
}

export function calculateMotorsLoad(env: ColdProEnvironment): number {
  return calculateMotorLoadKcalH(env);
}

export function calculateTunnelLoad(tunnel: ColdProTunnel) {
  const processType = String(tunnel.process_type ?? (tunnel.operation_mode === "batch" ? "static_pallet_freezing" : "continuous_individual_freezing"));
  const isStatic = processType === "static_cart_freezing" || processType === "static_pallet_freezing" || tunnel.operation_mode === "batch";
  const arrangementType = String(tunnel.arrangement_type ?? (isStatic ? "pallet_block" : "individual_exposed"));
  const arrangementDefaults = tunnelArrangementDefaults(arrangementType);
  const airExposureFactor = n(tunnel.air_exposure_factor, arrangementDefaults.airExposure) || arrangementDefaults.airExposure;
  const penetrationFactor = n(tunnel.thermal_penetration_factor, arrangementDefaults.penetration) || arrangementDefaults.penetration;
  const unitWeight = n(tunnel.unit_weight_kg) || n(tunnel.product_unit_weight_kg);
  const massHour = isStatic
    ? 0
    : n(tunnel.mass_kg_hour) > 0
      ? n(tunnel.mass_kg_hour)
      : unitWeight * n(tunnel.units_per_cycle) * n(tunnel.cycles_per_hour);
  const staticMass = n(tunnel.pallet_mass_kg) * Math.max(1, n(tunnel.number_of_pallets, 1));
  const batchTimeH = n(tunnel.batch_time_h) || n(tunnel.process_time_min) / 60;
  const tin = n(tunnel.inlet_temp_c);
  const tout = n(tunnel.outlet_temp_c);
  const tfreeze = tunnel.freezing_temp_c;
  const cpAbove = thermalValueKcal(tunnel.specific_heat_above_kcal_kg_c, tunnel.specific_heat_above_kj_kg_k);
  const cpBelow = thermalValueKcal(tunnel.specific_heat_below_kcal_kg_c, tunnel.specific_heat_below_kj_kg_k);
  const latent = thermalValueKcal(tunnel.latent_heat_kcal_kg, tunnel.latent_heat_kj_kg);
  const frozenFraction = waterFreezeFraction(tunnel);
  const productThicknessM = n(tunnel.product_thickness_m) || n(tunnel.product_thickness_mm) / 1000;
  const blockDimensions = [n(tunnel.pallet_length_m), n(tunnel.pallet_width_m), n(tunnel.pallet_height_m)].filter((value) => value > 0);
  const blockCharacteristicM = blockDimensions.length ? Math.min(...blockDimensions) : 0;
  const characteristicDimensionM = isStatic ? blockCharacteristicM : productThicknessM;
  const distanceToCoreM = characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0;
  const baseConvectiveCoefficient = calculateConvectionCoefficient(tunnel.air_velocity_m_s, tunnel.convective_coefficient_manual_w_m2_k ?? tunnel.convective_coefficient_w_m2_k);
  const convectiveCoefficient = baseConvectiveCoefficient ? round2(baseConvectiveCoefficient * airExposureFactor) : null;
  const effectiveConductivity = n(tunnel.thermal_conductivity_frozen_w_m_k) > 0 ? n(tunnel.thermal_conductivity_frozen_w_m_k) * penetrationFactor : 0;
  const estimatedFreezingTimeMin = estimateFreezingTimePlankMin({
    thicknessM: characteristicDimensionM,
    distanceToCoreM,
    densityKgM3: tunnel.density_kg_m3,
    thermalConductivityFrozenWMK: tunnel.thermal_conductivity_frozen_w_m_k,
    effectiveConductivityWMK: effectiveConductivity,
    freezingTempC: tunnel.freezing_temp_c,
    latentHeatKcalKg: tunnel.latent_heat_kcal_kg,
    airTempC: tunnel.air_temp_c,
    airVelocityMS: tunnel.air_velocity_m_s,
    convectiveCoefficientWM2K: convectiveCoefficient,
  });

  let sensibleAbove = 0;
  let latentLoad = 0;
  let sensibleBelow = 0;
  const calculationMass = isStatic ? staticMass : massHour;

  if (tunnel.tunnel_type === "blast_freezer" && tfreeze !== null && tfreeze !== undefined && tin > tfreeze && tout < tfreeze) {
    sensibleAbove = calculationMass * cpAbove * positive(tin - tfreeze);
    latentLoad = calculationMass * latent * frozenFraction;
    sensibleBelow = calculationMass * cpBelow * positive(tfreeze - tout);
  } else {
    const cp = tin >= 0 && tout >= 0 ? cpAbove : cpBelow || cpAbove;
    sensibleAbove = calculationMass * cp * Math.abs(tin - tout);
  }

  const timeDivisor = isStatic && batchTimeH > 0 ? batchTimeH : 1;
  const productHourly = (sensibleAbove + latentLoad + sensibleBelow) / timeDivisor;
  const qSpecificKjKg = calculationMass > 0 ? ((sensibleAbove + latentLoad + sensibleBelow) / calculationMass) * KCAL_TO_KJ : 0;
  const packaging = n(tunnel.packaging_mass_kg_hour) * n(tunnel.packaging_specific_heat_kcal_kg_c) * Math.abs(tin - tout);
  const internalLoads = kwToKcalh(n(tunnel.belt_motor_kw) + n(tunnel.internal_fans_kw) + n(tunnel.other_internal_kw));
  const total = productHourly + packaging + internalLoads;
  const availableTimeMin = isStatic ? batchTimeH * 60 : n(tunnel.process_time_min);
  const optimization = optimizeProcessAirCondition({
    processType,
    arrangementType,
    operationMode: isStatic ? "batch" : "continuous",
    qSpecificKjKg,
    massKgHour: massHour,
    batchMassKg: staticMass,
    batchTimeH,
    desiredTimeMin: availableTimeMin,
    initialAirTempC: n(tunnel.air_temp_c),
    initialAirVelocityMS: n(tunnel.air_velocity_m_s),
    minAirTempC: n((tunnel as any).min_air_temp_c, -40),
    maxAirTempC: n((tunnel as any).max_air_temp_c, -25),
    minAirVelocityMS: n((tunnel as any).min_air_velocity_m_s, 1),
    maxAirVelocityMS: n((tunnel as any).max_air_velocity_m_s, 6),
    airTempStepC: n((tunnel as any).air_temp_step_c, 5),
    airVelocityStepMS: n((tunnel as any).air_velocity_step_m_s, 1),
    airDeltaTK: n((tunnel as any).air_delta_t_k, 6),
    airExposureFactor,
    thermalPenetrationFactor: penetrationFactor,
    distanceToCoreM,
    densityKgM3: tunnel.density_kg_m3,
    thermalConductivityFrozenWMK: tunnel.thermal_conductivity_frozen_w_m_k,
    freezingTempC: tunnel.freezing_temp_c,
    latentHeatKcalKg: tunnel.latent_heat_kcal_kg,
    frozenWaterFraction: frozenFraction,
  });
  const retentionMargin = estimatedFreezingTimeMin && availableTimeMin > 0 ? availableTimeMin / estimatedFreezingTimeMin : null;
  const retentionStatus = optimization.status === "adequado" ? "Adequado por otimização" : !retentionMargin ? "Sem dados suficientes" : retentionMargin < 1 ? "Insuficiente" : retentionMargin < 1.1 ? "Adequado com baixa margem" : "Adequado";
  const warnings = [arrangementDefaults.warning, !estimatedFreezingTimeMin ? "Tempo até núcleo não estimado por falta de densidade, condutividade congelada, calor latente, temperatura de congelamento ou dimensão térmica." : null, ...optimization.warnings].filter(Boolean);

  return {
    process_type: processType,
    arrangement_type: arrangementType,
    arrangement_label: arrangementDefaults.label,
    calculation_model: isStatic ? "static_equivalent_block" : "continuous_individual_unit",
    mass_kg_hour: round2(massHour),
    static_mass_kg: round2(staticMass),
    batch_time_h: round2(batchTimeH),
    total_energy_kcal: round2(sensibleAbove + latentLoad + sensibleBelow),
    q_specific_kj_kg: round2(qSpecificKjKg),
    sensible_above_kcal_h: round2(sensibleAbove / timeDivisor),
    latent_kcal_h: round2(latentLoad / timeDivisor),
    sensible_below_kcal_h: round2(sensibleBelow / timeDivisor),
    cp_above_kcal_kg_c: round2(cpAbove),
    cp_below_kcal_kg_c: round2(cpBelow),
    latent_heat_kcal_kg: round2(latent),
    frozen_water_fraction: round2(frozenFraction),
    composition_percent: {
      water: tunnel.water_content_percent ?? null,
      protein: tunnel.protein_content_percent ?? null,
      fat: tunnel.fat_content_percent ?? null,
      carbohydrate: tunnel.carbohydrate_content_percent ?? null,
      fiber: tunnel.fiber_content_percent ?? null,
      ash: tunnel.ash_content_percent ?? null,
    },
    packaging_kcal_h: round2(packaging),
    internal_loads_kcal_h: round2(internalLoads),
    total_kcal_h: round2(total),
    total_kw: round2(kcalhToKw(total)),
    total_tr: round2(kcalhToTr(total)),
    air_velocity_m_s: n(tunnel.air_velocity_m_s),
    airflow_m3_h: n(tunnel.airflow_m3_h),
    process_time_min: availableTimeMin,
    base_convective_coefficient_w_m2_k: baseConvectiveCoefficient,
    air_exposure_factor: round2(airExposureFactor),
    thermal_penetration_factor: round2(penetrationFactor),
    effective_thermal_conductivity_w_m_k: round2(effectiveConductivity),
    convective_coefficient_w_m2_k: convectiveCoefficient,
    convective_coefficient_effective_w_m2_k: convectiveCoefficient,
    thermal_characteristic_dimension_m: round2(characteristicDimensionM),
    distance_to_core_m: round2(distanceToCoreM),
    estimated_freezing_time_min: estimatedFreezingTimeMin,
    retention_margin: retentionMargin ? round2(retentionMargin) : null,
    retention_status: retentionStatus,
    technical_status: retentionStatus,
    warnings,
    recommended_air_temp_c: optimization.recommendation?.air_temp_c ?? null,
    recommended_air_velocity_m_s: optimization.recommendation?.air_velocity_m_s ?? null,
    recommended_airflow_m3_h: optimization.recommendation?.airflow_m3_h ?? calculateRecommendedAirFlowM3H(kcalhToKw(total), n((tunnel as any).air_delta_t_k, 6)),
    optimization_status: optimization.status,
    optimization_margin_percent: optimization.recommendation?.margin_percent ?? null,
    optimization_attempts_count: optimization.attempts_count,
    optimization_attempts: optimization.attempts,
    optimization_memory: optimization.memory,
  };
}

function buildColdProValidationAlerts(env: ColdProEnvironment, products: any[], infiltration: any, defrostKcalH: number, fanLoad: any) {
  const alerts: Array<{ level: "error" | "warning" | "info"; code: string; message: string }> = [];
  if (env.relative_humidity_percent !== null && env.relative_humidity_percent !== undefined && n(env.relative_humidity_percent) <= 0) {
    alerts.push({ level: "error", code: "internal_rh_zero", message: "UR interna igual a 0% é fisicamente inválida; use valor manual real ou deixe em branco para adotar a premissa automática." });
  }
  if (infiltration.doorAreaM2 > 0 && infiltration.doorOpeningsPerDay > 0 && infiltration.totalInfiltrationM3Day <= 0) {
    alerts.push({ level: "warning", code: "door_without_infiltration", message: "Há porta e aberturas informadas, mas a infiltração calculada ficou zerada; revisar dimensões, tempo aberta e perfil operacional." });
  }
  if (n(env.internal_temp_c) < 0 && defrostKcalH <= 0) {
    alerts.push({ level: "warning", code: "negative_room_without_defrost", message: "Câmara negativa com degelo equivalente zerado; revisar umidade, infiltração e premissas de degelo." });
  }
  for (const product of products) {
    if (Math.abs(n(product.energy_consistency_delta_kcal)) > 1) alerts.push({ level: "error", code: "product_energy_inconsistent", message: `Carga de produto inconsistente em ${product.product_name}: soma das etapas difere do total.` });
  }
  if (n(env.motors_power_kw) > 0 && (env.motors_dissipation_factor === null || env.motors_dissipation_factor === undefined || n(env.motors_dissipation_factor) < 0 || n(env.motors_dissipation_factor) > 1)) {
    alerts.push({ level: "warning", code: "motor_dissipation_invalid", message: "Motor informado sem fator de dissipação válido; use 100% interno, 30-70% parcial ou 0% externo." });
  }
  if (fanLoad.source === "unavailable") alerts.push({ level: "warning", code: "fans_unavailable", message: "Ventiladores do evaporador não calculados por falta de potência, seleção ou vazão de ar." });
  return alerts;
}

export function calculateColdProLoad(params: {
  env: ColdProEnvironment;
  products: ColdProEnvironmentProduct[];
  insulation: ColdProInsulationMaterial;
  tunnel?: ColdProTunnel | null;
  advancedProcesses?: any[];
  selection?: any | null;
}): ColdProResult {
  const transmission = calculateTransmissionLoad(params);
  const transmissionBreakdown = calculateConstructionTransmission(params.env);
  const productBreakdown = params.products.map(calculateProductLoadBreakdown);
  const product = productBreakdown.reduce((acc, item) => acc + item.total_kcal_h, 0);
  const packaging = params.products.reduce((acc, item) => acc + calculatePackagingLoad(item), 0);
  const respiration = params.products.reduce((acc, item) => acc + calculateProductRespirationLoad(item, n(params.env.internal_temp_c)), 0);
  const tunnelResult = params.tunnel ? calculateTunnelLoad(params.tunnel) : null;
  const tunnelInternalLoad = tunnelResult?.total_kcal_h ?? 0;
  const dehumidification = calculateSeedDehumidificationLoad(params.env);
  const dehumidificationLoad = dehumidification.total_kcal_h;
  const advancedProcesses = (params.advancedProcesses ?? []).map(calculateAdvancedProcess);
  const advancedProcessLoad = advancedProcesses.reduce((sum, item) => sum + n(item.total_additional_kcal_h), 0);
  const infiltration = calculateInfiltrationLoad(params.env);
  const infiltrationBreakdown = calculateTechnicalInfiltration(params.env);
  const evaporatorFrost = calculateEvaporatorFrostRisk(params.env, infiltration);
  const people = calculatePeopleLoad(params.env);
  const lighting = calculateLightingLoad(params.env);
  const motors = calculateMotorsLoad(params.env);
  const fanLoad = calculateEvaporatorFanLoad(params.env, params.selection);
  const fans = fanLoad.fansKcalH;
  const defrostSuggestion = calculateTechnicalDefrost(params.env, infiltrationBreakdown.iceKgDay);
  const defrost = n(params.env.defrost_kcal_h) > 0 ? n(params.env.defrost_kcal_h) : defrostSuggestion.defrostKcalH;
  const other = n(params.env.other_kcal_h);

  const validationAlerts = buildColdProValidationAlerts(params.env, productBreakdown, infiltrationBreakdown, defrost, fanLoad);
  const subtotal = consolidateColdProSubtotal({ transmission, product, packaging, respiration, tunnel_internal_load: tunnelInternalLoad, seed_dehumidification: dehumidificationLoad, advanced_processes: advancedProcessLoad, infiltration, evaporator_frost: evaporatorFrost.additional_load_kcal_h, people, lighting, motors, fans, defrost, other });
  const safetyFactor = n(params.env.safety_factor_percent);
  const safety = subtotal * (safetyFactor / 100);
  const total = subtotal + safety;

  return {
    transmission_kcal_h: round2(transmission),
    product_kcal_h: round2(product),
    packaging_kcal_h: round2(packaging),
    infiltration_kcal_h: round2(infiltration),
    people_kcal_h: round2(people),
    lighting_kcal_h: round2(lighting),
    motors_kcal_h: round2(motors),
    tunnel_internal_load_kcal_h: round2(tunnelInternalLoad),
    fans_kcal_h: round2(fans),
    defrost_kcal_h: round2(defrost),
    other_kcal_h: round2(other),
    subtotal_kcal_h: round2(subtotal),
    safety_factor_percent: round2(safetyFactor),
    safety_kcal_h: round2(safety),
    total_required_kcal_h: round2(total),
    total_required_kw: round2(kcalhToKw(total)),
    total_required_tr: round2(kcalhToTr(total)),
    calculation_breakdown: {
      transmission_summary: {
        total_w: transmissionBreakdown.total_w,
        total_kw: transmissionBreakdown.total_kw,
        total_kcal_h: transmissionBreakdown.total_kcal_h,
        total_tr: transmissionBreakdown.total_tr,
        glass_total_w: transmissionBreakdown.glass_total_w,
        glass_total_kcal_h: transmissionBreakdown.glass_total_kcal_h,
      },
      transmission_faces: transmissionBreakdown.faces,
      tunnel: tunnelResult,
      seed_dehumidification: dehumidification,
      infiltration_technical: infiltrationBreakdown,
      defrost_suggestion: defrostSuggestion,
      evaporator_fans: fanLoad,
      motors: {
        power_kw: round2(n(params.env.motors_power_kw)),
        hours_day: round2(n(params.env.motors_hours_day)),
        dissipation_factor: round2(n(params.env.motors_dissipation_factor, 1)),
        dissipation_rule: "interno = 100%; parcial = 30-70%; externo = 0%",
        formula: "Q_motor = kW x 859,845 x horas_dia / horas_compressor x fator_dissipacao",
      },
      advanced_processes: advancedProcesses,
      advanced_processes_kcal_h: round2(advancedProcessLoad),
      evaporator_frost: evaporatorFrost,
      products: productBreakdown,
      validation_alerts: validationAlerts,
      mathematical_audit: null,
      thermalCalculationResult: null,
      final_sum_formula: "Carga total = transmissão + produto + embalagem + respiração + infiltração sensível/latente + gelo/degelo + motores + iluminação + pessoas + ventiladores + outros + segurança",
      respiration_kcal_h: round2(respiration),
      formulas: {
        transmission: "Q_linha = (Área opaca × U painel × ΔT) + (Área vidro × U vidro × ΔT) + (Área vidro × radiação solar × fator solar)",
        product: "Q = m × cp × ΔT / h; congelamento inclui calor latente",
        respiration: "Q_respiração = massa_kg × taxa_W_kg × 0,859845, com interpolação por temperatura",
        tunnel: "Q túnel = sensível acima + latente + sensível abaixo + embalagem + cargas internas",
        seed_dehumidification: "W = 0,62198 × Pv / (P_atm - Pv); Q_latente = água_kg_h × 2500 / 3600",
        infiltration: "Q = V_ar × densidade_ar × cp_ar × ΔT / h; gelo = ar_infiltrado × diferença_umidade_absoluta",
        lighting: "Q = kW × 860 × horas / horas_compressor",
        motors: "Q = kW × 860 × horas / horas_compressor",
      },
    },
  };
  const thermalCalculationResult = buildThermalCalculationResult(calculatedResult, params.selection);
  calculatedResult.calculation_breakdown.mathematical_audit = thermalCalculationResult;
  calculatedResult.calculation_breakdown.thermalCalculationResult = thermalCalculationResult;
  return calculatedResult;
}
