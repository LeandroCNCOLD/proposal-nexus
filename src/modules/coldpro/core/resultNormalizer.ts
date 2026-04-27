import { listAshraeColdProComparisons } from "./ashraeComparison";
import { simulateMonthlyEnergyConsumption } from "../energy/monthlyEnergySimulation";
import { auditColdProTechnicalConsistency } from "./technicalAudit";

export type ColdProNormalizedResult = ReturnType<typeof normalizeColdProResult>;

const KCAL_PER_KW = 859.845;
const KCAL_PER_TR = 3024;
const ENERGY_COP_WARNING = "COP ausente ou inválido; simulação energética calculada sem potência elétrica real.";

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function pct(part: number, total: number): number {
  return total > 0 ? round((part / total) * 100, 2) : 0;
}

function kwToKcalH(value: unknown): number {
  return num(value) * KCAL_PER_KW;
}

function tunnelLoadBreakdown(result: any, tunnel: any) {
  const loads = tunnel?.calculation_breakdown?.loads ?? tunnel?.calculationBreakdown?.loads ?? tunnel?.calculation_breakdown?.persistedLoads ?? tunnel?.calculationBreakdown?.persistedLoads ?? {};
  const productKW = num(result.tunnel_product_load_kw ?? tunnel.tunnel_product_load_kw ?? tunnel.product_load_kw ?? tunnel.productLoadKW ?? loads.productLoadKW);
  const packagingKW = num(result.tunnel_packaging_load_kw ?? tunnel.tunnel_packaging_load_kw ?? tunnel.packaging_load_kw ?? tunnel.packagingLoadKW ?? loads.packagingLoadKW);
  const transmissionKW = num(result.tunnel_transmission_load_kw ?? tunnel.tunnel_transmission_load_kw ?? tunnel.transmission_load_kw ?? tunnel.transmissionLoadKW ?? loads.transmissionLoadKW);
  const infiltrationKW = num(result.tunnel_infiltration_load_kw ?? tunnel.tunnel_infiltration_load_kw ?? tunnel.infiltration_load_kw ?? tunnel.infiltrationLoadKW ?? loads.infiltrationLoadKW);
  const internalKW = num(result.tunnel_internal_load_kw ?? tunnel.tunnel_internal_load_kw ?? tunnel.internal_load_kw ?? tunnel.internalLoadKW ?? loads.internalLoadKW);
  const totalKW = num(result.tunnel_total_load_kw ?? tunnel.tunnel_total_load_kw ?? tunnel.total_kw ?? tunnel.totalKW ?? loads.totalKW) || productKW + packagingKW + transmissionKW + infiltrationKW + internalKW;

  return {
    productKW,
    packagingKW,
    transmissionKW,
    infiltrationKW,
    internalKW,
    totalKW,
    productKcalH: kwToKcalH(productKW),
    packagingKcalH: kwToKcalH(packagingKW),
    transmissionKcalH: kwToKcalH(transmissionKW),
    infiltrationKcalH: kwToKcalH(infiltrationKW),
    internalKcalH: kwToKcalH(internalKW),
    totalKcalH: num(result.tunnel_total_load_kcal_h ?? tunnel.tunnel_total_load_kcal_h ?? tunnel.total_kcal_h ?? tunnel.totalKcalH ?? loads.totalKcalH) || kwToKcalH(totalKW),
    totalTR: num(result.tunnel_total_load_tr ?? tunnel.tunnel_total_load_tr ?? tunnel.total_tr ?? tunnel.totalTR ?? loads.totalTR) || (totalKW * KCAL_PER_KW) / KCAL_PER_TR,
  };
}

export function buildCalculationMethodSummary(result: any) {
  const breakdown = result?.calculation_breakdown ?? result?.calculationBreakdown ?? {};
  const method = breakdown.calculationMethod ?? {};
  const methodValues = Object.values(method).filter((item: any) => item?.name || item?.formula || typeof item === "string");
  const methods = [...Object.values(method.methods ?? {}), ...methodValues.map((item: any) => item?.name ?? item)].filter(Boolean);
  const limitations = [...(Array.isArray(method.limitations) ? method.limitations : []), ...methodValues.map((item: any) => item?.limitations).filter(Boolean)];
  const ashraeComparison = Array.isArray(breakdown.ashraeComparison) ? breakdown.ashraeComparison : listAshraeColdProComparisons();
  const warnings = [
    ...(Array.isArray(breakdown.validation?.warnings) ? breakdown.validation.warnings : []),
    ...(Array.isArray(breakdown.tunnel?.warnings) ? breakdown.tunnel.warnings : []),
    ...(Array.isArray(breakdown.infiltration_technical?.psychrometric?.warnings) ? breakdown.infiltration_technical.psychrometric.warnings : []),
  ];
  return { methods: Array.from(new Set(methods.map(String))), limitations: Array.from(new Set(limitations.map(String))), warnings: Array.from(new Set(warnings.map(String))), ashraeComparison };
}

function selectedTunnelAttempt(tunnel: any) {
  const attempts = Array.isArray(tunnel?.optimization_attempts) ? tunnel.optimization_attempts : [];
  return attempts.find((attempt: any) => attempt?.meets) ?? attempts[0] ?? null;
}

export function normalizeColdProResult(rawResult: any, selection?: any | null, environment?: any | null, products: any[] = []) {
  const result = rawResult ?? {};
  const breakdown = result.calculation_breakdown ?? {};
  const audit = breakdown.thermalCalculationResult ?? breakdown.mathematical_audit ?? {};
  const tunnel = breakdown.tunnel ?? {};
  const tunnelLoads = tunnelLoadBreakdown(result, tunnel);
  const attempt = selectedTunnelAttempt(tunnel);
  const seed = breakdown.seed_dehumidification ?? {};
  const frost = breakdown.evaporator_frost ?? breakdown.infiltration_technical ?? {};
  const advanced: any[] = [];
  const calculationMethodSummary = buildCalculationMethodSummary(result);
  const technicalAudit = breakdown.technicalAudit ?? auditColdProTechnicalConsistency({ environment, result, tunnel, products, advancedProcesses: advanced, selection });

  const directProductKcalH = num(result.product_kcal_h);
  const tunnelProcessKcalH = tunnelLoads.totalKcalH || num(result.tunnel_internal_load_kcal_h || tunnel.total_kcal_h || tunnel.total_kw * KCAL_PER_KW);
  const packagingKcalH = num(result.packaging_kcal_h);
  const respirationKcalH = num(breakdown.respiration_kcal_h);
  const dehumidificationKcalH = num(seed.total_kcal_h);
  const specialProcessesKcalH = 0;
  const iceImpactKcalH = num(breakdown.evaporator_frost?.additional_load_kcal_h ?? 0);
  const defrostKcalH = num(result.defrost_kcal_h);
  const safetyKcalH = num(audit.seguranca_kcal_h ?? result.safety_kcal_h);
  const subtotalKcalH = num(audit.subtotal_validado ?? result.subtotal_kcal_h);
  const requiredKcalH = num(audit.carga_requerida_validada ?? result.total_required_kcal_h);

  const loadDistribution = {
    environmentKcalH: num(result.transmission_kcal_h),
    productKcalH: directProductKcalH,
    tunnelProcessKcalH,
    packagingKcalH,
    respirationKcalH,
    dehumidificationKcalH,
    specialProcessesKcalH,
    infiltrationKcalH: num(result.infiltration_kcal_h),
    peopleKcalH: num(result.people_kcal_h),
    lightingKcalH: num(result.lighting_kcal_h),
    motorsKcalH: num(result.motors_kcal_h),
    fansKcalH: num(result.fans_kcal_h),
    defrostKcalH,
    iceImpactKcalH,
    otherKcalH: num(result.other_kcal_h),
    safetyKcalH,
  };

  const componentSumKcalH = Object.entries(loadDistribution)
    .filter(([key]) => key !== "safetyKcalH")
    .reduce((sum, [, value]) => sum + num(value), 0);

  const equipmentTotal = num(audit.capacidade_total_corrigida || selection?.capacity_total_kcal_h);
  const correctedCapacity = num(audit.capacidade_total_corrigida ?? audit.correctedCapacity ?? audit.capacidade_corrigida_validada ?? 0);
  const requiredForEquipment = num(audit.carga_requerida_validada ?? selection?.required_capacity_kcal_h ?? requiredKcalH);
  const surplusPercent = num(audit.sobra_percentual ?? selection?.surplus_percent ?? (requiredForEquipment > 0 ? ((equipmentTotal - requiredForEquipment) / requiredForEquipment) * 100 : 0));
  const resultTotalKW = num(result.totalKW ?? result.total_kw ?? result.tunnel_total_load_kw ?? tunnel.totalKW ?? tunnel.total_kw) || num(result.total_required_kw) || requiredKcalH / KCAL_PER_KW;
  const resultCOP = num(result.cop ?? result.COP ?? result.copData?.cop ?? result.cop_data?.cop ?? selection?.cop ?? audit.curva?.cop);
  const energySimulationInput = {
    coolingLoadKW: resultTotalKW,
    cop: resultCOP,
    operatingHoursPerDay: result.operatingHoursPerDay ?? result.operating_hours_per_day ?? 8,
    operatingDaysPerMonth: result.operatingDaysPerMonth ?? result.operating_days_per_month ?? 22,
    energyCostPerKWh: result.energyCostPerKWh ?? result.energy_cost_per_kwh ?? 0.95,
    processedMassKgPerDay: result.processedMassKgPerDay ?? result.processed_mass_kg_per_day ?? products[0]?.mass_kg_day ?? products[0]?.daily_mass_kg ?? 0,
    demandFactor: result.demandFactor ?? result.demand_factor ?? 1,
  };
  const energySimulationBase = simulateMonthlyEnergyConsumption(energySimulationInput);
  const energyWarnings = resultCOP <= 0 ? [ENERGY_COP_WARNING] : [];
  const energySimulation = {
    ...energySimulationBase,
    processedMassKgMonth: num(energySimulationBase.assumptions?.monthlyProcessedMassKg),
    warnings: Array.from(new Set([...energySimulationBase.warnings, ...energyWarnings])),
  };

  const warnings: string[] = [];
  const deltaComponentVsSubtotalKcalH = componentSumKcalH - subtotalKcalH;
  const deltaComponentVsSubtotalPercent = pct(Math.abs(deltaComponentVsSubtotalKcalH), subtotalKcalH);
  if (subtotalKcalH > 0 && deltaComponentVsSubtotalPercent > 1) warnings.push("A soma dos componentes não fecha com o subtotal validado.");
  if (directProductKcalH === 0 && tunnelProcessKcalH > 0) warnings.push("Produto direto está zerado, mas há carga em túnel/processo considerada na carga de produto.");
  if (requiredKcalH > 0 && pct(loadDistribution.otherKcalH, requiredKcalH) > 5) warnings.push("Carga relevante classificada como Outros. Recomenda-se reclassificar para produto ou carga interna.");
  if (equipmentTotal > 0 && correctedCapacity === 0) warnings.push("Auditoria de curva inconsistente: equipamento selecionado possui capacidade, mas capacidade corrigida validada está zerada.");
  if (surplusPercent < 0) warnings.push("Equipamento subdimensionado.");
  if (surplusPercent > 30) warnings.push("Possível superdimensionamento.");
  warnings.push(...energyWarnings);

  return {
    summary: {
      requiredKcalH: round(requiredKcalH, 2),
      requiredKW: round(num(result.total_required_kw) || requiredKcalH / KCAL_PER_KW, 2),
      requiredTR: round(num(result.total_required_tr) || requiredKcalH / KCAL_PER_TR, 2),
      subtotalKcalH: round(subtotalKcalH, 2),
      safetyFactorPercent: round(num(audit.fator_segurança ?? result.safety_factor_percent), 2),
      safetyKcalH: round(safetyKcalH, 2),
      status: String(audit.status_dimensionamento ?? result.status ?? (requiredKcalH > 0 ? "calculado" : "pendente")),
      technicalSurplusPercent: round(surplusPercent, 2),
      technicalStatus: technicalAudit.technicalStatus,
      isBlocked: technicalAudit.isBlocked,
      isPreliminary: technicalAudit.isPreliminary,
      displayApplicationLabel: technicalAudit.displayApplicationLabel,
    },
    loadDistribution,
    tunnelLoadBreakdown: {
      productKcalH: round(tunnelLoads.productKcalH, 2),
      packagingKcalH: round(tunnelLoads.packagingKcalH, 2),
      transmissionKcalH: round(tunnelLoads.transmissionKcalH, 2),
      infiltrationKcalH: round(tunnelLoads.infiltrationKcalH, 2),
      internalKcalH: round(tunnelLoads.internalKcalH, 2),
      totalKcalH: round(tunnelLoads.totalKcalH, 2),
      productKW: round(tunnelLoads.productKW, 2),
      packagingKW: round(tunnelLoads.packagingKW, 2),
      transmissionKW: round(tunnelLoads.transmissionKW, 2),
      infiltrationKW: round(tunnelLoads.infiltrationKW, 2),
      internalKW: round(tunnelLoads.internalKW, 2),
      totalKW: round(tunnelLoads.totalKW, 2),
      totalTR: round(tunnelLoads.totalTR, 2),
    },
    groupedLoads: {
      transmissionKcalH: loadDistribution.environmentKcalH,
      productsAndProcessKcalH: directProductKcalH + tunnelProcessKcalH + (tunnelProcessKcalH > 0 ? 0 : packagingKcalH) + respirationKcalH + specialProcessesKcalH,
      airAndMoistureKcalH: loadDistribution.infiltrationKcalH + dehumidificationKcalH,
      internalLoadsKcalH: loadDistribution.peopleKcalH + loadDistribution.lightingKcalH + loadDistribution.motorsKcalH + loadDistribution.fansKcalH,
      defrostAndIceKcalH: defrostKcalH + iceImpactKcalH,
      safetyKcalH,
      otherKcalH: loadDistribution.otherKcalH,
      tunnelTotalKcalH: round(tunnelLoads.totalKcalH, 2),
    },
    tunnelValidation: {
      tunnelProcessKcalH: round(tunnelProcessKcalH, 2),
      productLoadKW: round(tunnelLoads.productKW, 2),
      transmissionLoadKW: round(tunnelLoads.transmissionKW, 2),
      infiltrationLoadKW: round(tunnelLoads.infiltrationKW, 2),
      internalLoadKW: round(tunnelLoads.internalKW, 2),
      totalLoadKW: round(tunnelLoads.totalKW, 2),
      energySpecificKJkg: round(num(tunnel.q_specific_kj_kg), 2),
      powerKW: round(num(tunnel.total_kw) || tunnelProcessKcalH / KCAL_PER_KW, 2),
      availableTimeMin: round(num(tunnel.process_time_min || products[0]?.process_time_h * 60), 2),
      coreTimeMin: round(num(tunnel.estimated_freezing_time_min || attempt?.estimated_time_min), 2),
      calculatedAirflowM3H: round(num(tunnel.recommended_airflow_m3_h || attempt?.airflow_m3_h), 2),
      informedAirflowM3H: round(num(environment?.evaporator_airflow_m3_h || environment?.airflow_m3_h || selection?.air_flow_total_m3_h), 2),
      airVelocityMS: round(num(tunnel.recommended_air_velocity_m_s || attempt?.air_velocity_m_s), 2),
      hBaseWM2K: round(num(attempt?.h_base_w_m2_k ?? tunnel.base_convective_coefficient_w_m2_k), 2),
      hEffectiveWM2K: round(num(tunnel.convective_coefficient_effective_w_m2_k || attempt?.h_effective_w_m2_k), 2),
      exposureFactor: round(num(tunnel.air_exposure_factor), 2),
      penetrationFactor: round(num(tunnel.thermal_penetration_factor), 2),
      characteristicDimensionM: round(num(tunnel.thermal_characteristic_dimension_m), 4),
      distanceToCoreM: round(num(tunnel.distance_to_core_m), 4),
      status: String(tunnel.optimization_status ?? tunnel.technical_status ?? (tunnelProcessKcalH > 0 ? "calculado" : "indisponível")),
      warnings: [...(Array.isArray(tunnel.warnings) ? tunnel.warnings : [])],
    },
    equipment: {
      selectedModel: selection?.model ?? audit.curva?.modelo ?? null,
      quantity: num(audit.quantidade ?? selection?.quantity),
      totalCapacityKcalH: round(equipmentTotal, 2),
      requiredCapacityKcalH: round(requiredForEquipment, 2),
      surplusPercent: round(surplusPercent, 2),
      airflowM3H: round(num(selection?.air_flow_total_m3_h), 2),
      airChangesPerHour: round(num(selection?.air_changes_hour), 2),
      estimatedPowerKW: round(num(selection?.total_power_kw ?? audit.curva?.potencia_eletrica_kw), 2),
      cop: round(num(selection?.cop ?? audit.curva?.cop), 2),
      method: selection?.selection_method ?? audit.curva?.fonte ?? null,
      curvePoint: audit.curva ?? selection?.curve_metadata ?? null,
      correctedCapacityKcalH: round(correctedCapacity, 2),
    },
    energySimulation,
    iceAndDefrost: {
      frostKgDay: round(num(breakdown.evaporator_frost?.frost_kg_day ?? breakdown.infiltration_technical?.iceKgDay), 2),
      efficiencyLossPercent: round(num(breakdown.evaporator_frost?.efficiency_loss_percent), 2),
      additionalLoadKcalH: round(iceImpactKcalH, 2),
      normalBlockHours: round(num(breakdown.evaporator_frost?.normal_block_hours), 2),
      riskyBlockHours: round(num(breakdown.evaporator_frost?.risky_block_hours), 2),
      complexBlockHours: round(num(breakdown.evaporator_frost?.complex_block_hours), 2),
      recommendedDefrostIntervalH: round(num(breakdown.evaporator_frost?.recommended_defrost_interval_h), 2),
    },
    temperatureProfile: {
      inletTempC: num(products[0]?.inlet_temp_c),
      freezingTempC: num(products[0]?.initial_freezing_temp_c),
      outletTempC: num(products[0]?.outlet_temp_c),
      airTempC: num(tunnel.recommended_air_temp_c ?? environment?.internal_temp_c),
      hasData: products.length > 0 && products[0]?.inlet_temp_c != null && products[0]?.outlet_temp_c != null && (products[0]?.initial_freezing_temp_c != null || tunnel.recommended_air_temp_c != null),
    },
    consistencyAudit: {
      componentSumKcalH: round(componentSumKcalH, 2),
      subtotalKcalH: round(subtotalKcalH, 2),
      requiredKcalH: round(requiredKcalH, 2),
      deltaComponentVsSubtotalKcalH: round(deltaComponentVsSubtotalKcalH, 2),
      deltaComponentVsSubtotalPercent: round(deltaComponentVsSubtotalPercent, 2),
      tunnelVsProductTabDeltaKcalH: round(tunnelProcessKcalH - directProductKcalH, 2),
      tunnelVsProductTabDeltaPercent: pct(Math.abs(tunnelProcessKcalH - directProductKcalH), Math.max(tunnelProcessKcalH, directProductKcalH)),
      hasCriticalDivergence: technicalAudit.isBlocked || warnings.some((warning) => warning.includes("não fecha") || warning.includes("capacidade corrigida") || warning.includes("subdimensionado")),
      technicalStatus: technicalAudit.technicalStatus,
      blockers: technicalAudit.blockers,
      warnings: Array.from(new Set([...warnings, ...energySimulation.warnings, ...technicalAudit.criticalWarnings, ...technicalAudit.warnings.map((item: any) => item.message)])),
    },
    calculationMethod: breakdown.calculationMethod ?? null,
    calculationMethodSummary,
    engineVersion: result.engine_version ?? tunnel.engine_version ?? breakdown.tunnel_engine?.engine_version ?? null,
    calculatedAt: result.calculated_at ?? tunnel.calculated_at ?? breakdown.tunnel_engine?.calculated_at ?? null,
    ashraeComparisonWarnings: calculationMethodSummary.ashraeComparison.filter((item: any) => item.priority === "high"),
    methodLimitations: calculationMethodSummary.limitations,
  };
}
