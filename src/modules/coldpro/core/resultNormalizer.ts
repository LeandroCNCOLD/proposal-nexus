export type ColdProNormalizedResult = ReturnType<typeof normalizeColdProResult>;

const KCAL_PER_KW = 859.845;
const KCAL_PER_TR = 3024;

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

function sumAdvanced(list: any[], picker: (item: any) => unknown): number {
  return list.reduce((sum, item) => sum + num(picker(item)), 0);
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
  const attempt = selectedTunnelAttempt(tunnel);
  const seed = breakdown.seed_dehumidification ?? {};
  const frost = breakdown.evaporator_frost ?? breakdown.infiltration_technical ?? {};
  const advanced = Array.isArray(breakdown.advanced_processes) ? breakdown.advanced_processes : [];

  const directProductKcalH = num(result.product_kcal_h);
  const tunnelProcessKcalH = num(result.tunnel_internal_load_kcal_h || tunnel.total_kcal_h || tunnel.total_kw * KCAL_PER_KW);
  const packagingKcalH = num(result.packaging_kcal_h);
  const respirationKcalH = num(breakdown.respiration_kcal_h) + sumAdvanced(advanced, (item) => item.controlled_atmosphere?.respiration_load_kcal_h);
  const dehumidificationKcalH = num(seed.total_kcal_h);
  const specialProcessesKcalH = num(breakdown.advanced_processes_kcal_h);
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

  const warnings: string[] = [];
  const deltaComponentVsSubtotalKcalH = componentSumKcalH - subtotalKcalH;
  const deltaComponentVsSubtotalPercent = pct(Math.abs(deltaComponentVsSubtotalKcalH), subtotalKcalH);
  if (subtotalKcalH > 0 && deltaComponentVsSubtotalPercent > 1) warnings.push("A soma dos componentes não fecha com o subtotal validado.");
  if (directProductKcalH === 0 && tunnelProcessKcalH > 0) warnings.push("Produto direto está zerado, mas há carga em túnel/processo considerada como processo especial de produto.");
  if (requiredKcalH > 0 && pct(loadDistribution.otherKcalH, requiredKcalH) > 5) warnings.push("Carga relevante classificada como Outros. Recomenda-se reclassificar para produto, processo especial ou carga interna.");
  if (equipmentTotal > 0 && correctedCapacity === 0) warnings.push("Auditoria de curva inconsistente: equipamento selecionado possui capacidade, mas capacidade corrigida validada está zerada.");
  if (surplusPercent < 0) warnings.push("Equipamento subdimensionado.");
  if (surplusPercent > 30) warnings.push("Possível superdimensionamento.");

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
    },
    loadDistribution,
    groupedLoads: {
      transmissionKcalH: loadDistribution.environmentKcalH,
      productsAndProcessKcalH: directProductKcalH + tunnelProcessKcalH + packagingKcalH + respirationKcalH + specialProcessesKcalH,
      airAndMoistureKcalH: loadDistribution.infiltrationKcalH + dehumidificationKcalH,
      internalLoadsKcalH: loadDistribution.peopleKcalH + loadDistribution.lightingKcalH + loadDistribution.motorsKcalH + loadDistribution.fansKcalH,
      defrostAndIceKcalH: defrostKcalH + iceImpactKcalH,
      safetyKcalH,
      otherKcalH: loadDistribution.otherKcalH,
    },
    tunnelValidation: {
      tunnelProcessKcalH: round(tunnelProcessKcalH, 2),
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
      hasCriticalDivergence: warnings.some((warning) => warning.includes("não fecha") || warning.includes("capacidade corrigida") || warning.includes("subdimensionado")),
      warnings,
    },
  };
}
