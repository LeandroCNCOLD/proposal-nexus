import { strict as assert } from "node:assert";
import { formToTunnelInput } from "../adapters/formToTunnelInput";
import { compareColdProFormulaWithAshrae, getHighPriorityAshraeActions } from "../core/ashraeComparison";
import { COLDPRO_CALCULATION_METHODS } from "../core/calculationMethodRegistry";
import { buildCalculationMethodSummary } from "../core/resultNormalizer";
import { tunnelResultToDatabasePayload } from "../adapters/tunnelInputToDatabasePayload";
import { createAirPropertiesContext } from "../physics/airProperties";
import { calculateProductSpecificEnergy } from "../physics/productThermal";
import type { TunnelEngineInput, TunnelEngineResult } from "../types/tunnelEngine.types";
import { calculateTunnelEngine, COLDPRO_TUNNEL_ENGINE_VERSION } from "./tunnelEngine";

function nearlyEqual(actual: number, expected: number, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

const thermalBase = {
  initialTempC: 5,
  finalTempC: -18,
  freezingPointC: -1.5,
  cpAboveKJkgK: 3.5,
  cpBelowKJkgK: 1.8,
  latentHeatKJkg: 250,
  latentMode: "full" as const,
  frozenWaterFraction: 0.8,
  frozenConductivityWMK: 1.5,
  densityKgM3: 1000,
  thermalPenetrationFactor: 1,
  airExposureFactor: 1,
  airTempC: -30,
  airVelocityMS: 3,
  airDeltaTK: 6,
  packagingMassKgH: 0,
  packagingCpKJkgK: 0,
  beltMotorKW: 1,
  internalFansKW: 2,
  otherInternalKW: 0,
};

{
  const input: TunnelEngineInput = {
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    continuousMassMode: "direct_mass_flow",
    directMassKgH: 1000,
    retentionTimeMin: 30,
    productThicknessM: 0.03,
  };
  const result: TunnelEngineResult = calculateTunnelEngine(input);
  nearlyEqual(result.productLoadKW, 70.125);
  nearlyEqual(result.totalKW, 73.125);
  nearlyEqual(result.estimatedAirflowM3H, 30126.24, 0.1);
  assert.equal(result.engineVersion, COLDPRO_TUNNEL_ENGINE_VERSION);
  assert.ok(result.calculatedAt);
  assert.ok(result.totalKW > 0);
  assert.ok(result.calculationBreakdown);
  assert.equal(result.status, "insufficient");

  const payload = tunnelResultToDatabasePayload({ environment_id: "00000000-0000-0000-0000-000000000000", air_flow_m3_h: 123, campo_desconhecido: "não salvar" }, result);
  assert.equal(Object.hasOwn(payload, "campo_desconhecido"), false);
  assert.equal(Object.hasOwn(payload, "air_flow_m3_h"), false);
  assert.equal(payload.engine_version, COLDPRO_TUNNEL_ENGINE_VERSION);
  nearlyEqual(Number(payload.tunnel_total_load_kw), result.totalKW, 0.01);
  nearlyEqual(Number(payload.airflow_m3_h), result.airFlowM3H, 0.01);
}

{
  const paoDeQueijo = calculateProductSpecificEnergy({
    initialTempC: 24,
    finalTempC: -18,
    freezingPointC: -2.83,
    cpAboveKJkgK: 2.0,
    cpBelowKJkgK: 1.1,
    latentHeatKJkg: 140,
    frozenWaterFraction: 0.7,
  });
  assert.equal(paoDeQueijo.latentMode, "effective");
  nearlyEqual(paoDeQueijo.latentEffectiveKJkg, 140, 0.001);
  nearlyEqual(paoDeQueijo.latentKJkg, 140, 0.001);
  assert.ok(paoDeQueijo.totalKJkg >= 200 && paoDeQueijo.totalKJkg <= 220, `expected pão de queijo total kJ/kg between 200 and 220, got ${paoDeQueijo.totalKJkg}`);
  assert.ok(paoDeQueijo.totalKcalKg >= 48 && paoDeQueijo.totalKcalKg <= 52, `expected pão de queijo total kcal/kg between 48 and 52, got ${paoDeQueijo.totalKcalKg}`);

  const fullLatent = calculateProductSpecificEnergy({
    initialTempC: 24,
    finalTempC: -18,
    freezingPointC: -2.83,
    cpAboveKJkgK: 2.0,
    cpBelowKJkgK: 1.1,
    latentHeatKJkg: 140,
    frozenWaterFraction: 0.7,
    latentMode: "full",
  });
  assert.equal(fullLatent.latentMode, "full");
  nearlyEqual(fullLatent.latentEffectiveKJkg, 98, 0.001);
  assert.ok(fullLatent.totalKJkg < paoDeQueijo.totalKJkg, "latentMode full must be lower than effective when fraction < 1");
}

{
  const hardcodedAirflow = (12.09 * 3600) / (1.2 * 1.005 * 6);
  const rafaAir = createAirPropertiesContext({ temperatureC: -25, altitudeM: 700, relativeHumidityPercent: 85, mode: "sublimation" });
  const dynamicAirflow = (12.09 * 3600) / (rafaAir.densityKgM3 * rafaAir.specificHeatKJkgK * 6);
  assert.ok(rafaAir.densityKgM3 >= 1.3 && rafaAir.densityKgM3 <= 1.42, `expected dynamic density near 1.30–1.42 kg/m³, got ${rafaAir.densityKgM3}`);
  assert.ok(dynamicAirflow < hardcodedAirflow, `expected dynamic airflow ${dynamicAirflow} lower than hardcoded ${hardcodedAirflow}`);

  const result = calculateTunnelEngine({
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    directMassKgH: 170,
    retentionTimeMin: 30,
    productThicknessM: 0.03,
    airTempC: -25,
    altitudeM: 700,
    relativeHumidityPercent: 85,
    airDeltaTK: 6,
  });
  assert.ok(Number((result.calculationBreakdown.air as any)?.airProperties?.densityKgM3) >= 1.3);
  assert.ok(result.airFlowM3H > 0);
}

{
  const result = calculateTunnelEngine({
    ...thermalBase,
    initialTempC: 40,
    finalTempC: -12,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    continuousMassMode: "calculated_by_belt_surface_density",
    beltAreaM2: 32.5,
    beltSurfaceDensityKgM2: 6,
    beltWidthM: 2,
    beltSpeedMMin: 1.38,
    retentionTimeMin: 12,
    beltNominalCapacityKgH: 1000,
    beltMotorKW: 20,
    beltMotorInsideEnvironment: true,
    productThicknessM: 0.03,
  });
  const belt = (result.calculationBreakdown.mass as any).beltSurface;
  nearlyEqual(belt.massOnBeltKg, 195, 0.001);
  nearlyEqual(belt.flowByRetentionKgH, 975, 0.001);
  nearlyEqual(belt.flowBySpeedKgH, 993.6, 0.001);
  nearlyEqual(result.usedMassKgH, 975, 0.001);
  nearlyEqual(((result.calculationBreakdown.loads as any)?.internalLoads)?.beltMotorDissipatedKW, 20, 0.001);
  assert.equal(result.massBasis, "belt_surface_density");
  assert.equal(result.warnings.some((warning) => warning.includes("densityKgM3 fora da faixa") || warning.includes("densidade volumétrica")), false);
}

{
  const result = calculateTunnelEngine({
    ...thermalBase,
    processType: "static_pallet_freezing",
    operationMode: "batch",
    tunnelType: "static_pallet",
    arrangementType: "pallet_block",
    productGeometry: "slab",
    staticMassMode: "calculated_pallet_composition",
    unitWeightKg: 1,
    unitsPerBox: 10,
    boxesPerLayer: 5,
    numberOfLayers: 4,
    boxPackagingWeightKg: 5,
    palletBaseWeightKg: 20,
    numberOfPallets: 2,
    batchTimeH: 4,
    productThicknessM: 0.03,
  });
  assert.equal(result.isStatic, true);
  nearlyEqual(result.staticMassKg, 450);
  nearlyEqual(result.productLoadKW, 7.8891, 0.001);
  assert.equal(result.engineVersion, COLDPRO_TUNNEL_ENGINE_VERSION);
}

{
  const input = formToTunnelInput({
    process_type: "static_pallet_freezing",
    operation_mode: "batch",
    tunnel_type: "static_pallet",
    arrangement_type: "palletized_blocks",
    product_geometry: "rectangular_prism",
    surface_exposure_model: "stacked_product",
    static_mass_mode: "direct_pallet_mass",
    pallet_mass_kg: 250,
    number_of_pallets: 8,
    batch_time_h: 8,
    pallet_length_m: 1.2,
    pallet_width_m: 1,
    pallet_height_m: 1.7,
    product_length_m: 0.3,
    product_width_m: 0.2,
    product_thickness_m: 0.1,
    inlet_temp_c: 5,
    outlet_temp_c: -2,
    freezing_temp_c: -5.6,
    air_temp_c: -30,
    air_temp_source: "manual",
    airflow_source: "airflow_by_fans",
    fan_airflow_m3_h: 822,
    tunnel_cross_section_width_m: 0.6,
    tunnel_cross_section_height_m: 0.6,
    blockage_factor: 0.3,
    air_delta_t_k: 6,
    specific_heat_above_kj_kg_k: 3.4,
    specific_heat_below_kj_kg_k: 1.75,
    latent_heat_kj_kg: 204,
    frozen_water_fraction: null,
    density_kg_m3: 605,
    thermal_conductivity_frozen_w_m_k: 0.8,
    thermal_penetration_factor: 1,
  }, { internal_temp_c: -30 });
  const result = calculateTunnelEngine(input);
  assert.ok(result.energy.totalKJkg > 0);
  assert.equal(result.energy.latentKJkg, 0);
  assert.ok(result.productLoadKW > 1);
  assert.equal(result.calculationBreakdown.loads?.productLoadMissingFields?.includes("fração congelável"), false);
}

{
  const continuous = calculateTunnelEngine({
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    directMassKgH: 1000,
    retentionTimeMin: 30,
    productThicknessM: 0.03,
    packagingMassKgH: 120,
    packagingCpKJkgK: 1.4,
  });
  nearlyEqual(continuous.packagingLoadKW, 1.0733, 0.001);
  assert.equal(continuous.packagingLoadMethod, "continuous_mass_flow");

  const batch = calculateTunnelEngine({
    ...thermalBase,
    processType: "static_pallet_freezing",
    operationMode: "batch",
    tunnelType: "blast_freezer",
    arrangementType: "pallet_block",
    productGeometry: "slab",
    staticMassMode: "direct_batch_mass",
    directBatchMassKg: 2000,
    batchTimeH: 8,
    productThicknessM: 0.05,
    packagingMassKgBatch: 240,
    packagingCpKJkgK: 1.4,
  });
  nearlyEqual(batch.packagingLoadKW, 0.2683, 0.001);
  assert.equal(batch.packagingLoadMethod, "batch_total_mass");
  assert.equal(batch.calculationMethod.methods.infiltration, "simple_air_change");
}

{
  const result = calculateTunnelEngine({
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    directMassKgH: 1000,
    retentionTimeMin: 30,
    productThicknessM: 0.03,
    infiltrationCalculationMethod: "psychrometric_enthalpy",
  });
  assert.equal(result.calculationBreakdown.infiltration?.usedMethod, "simple_air_change");
  assert.ok(result.warnings.includes("Método psicrométrico solicitado, mas faltam dados de umidade/entalpia. Usando método simplificado."));
  assert.equal(result.calculationBreakdown.calculationMethod?.methods?.product, COLDPRO_CALCULATION_METHODS.productCoolingFreezing.formula);
  assert.equal(compareColdProFormulaWithAshrae("transmission")?.decision, "keep");
  assert.equal(compareColdProFormulaWithAshrae("product")?.decision, "keep");
}

{
  assert.ok(COLDPRO_CALCULATION_METHODS.transmission);
  assert.ok(COLDPRO_CALCULATION_METHODS.productCoolingFreezing);
  assert.ok(COLDPRO_CALCULATION_METHODS.airFlowBalance);
  assert.ok(COLDPRO_CALCULATION_METHODS.freezingTime);
  const highPriority = getHighPriorityAshraeActions().map((item) => item.area);
  assert.ok(highPriority.includes("packaging"));
  assert.ok(highPriority.includes("freezingTime"));
}

{
  const result = calculateTunnelEngine({
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    directMassKgH: 1000,
    retentionTimeMin: 30,
    productThicknessM: 0.03,
  });
  assert.ok(result.calculationBreakdown.calculationMethod?.productEnergy);
  assert.ok(result.calculationBreakdown.calculationMethod?.productLoad);
  assert.ok(result.calculationBreakdown.calculationMethod?.airflow);
  assert.ok(result.calculationBreakdown.calculationMethod?.freezingTime);
  const summary = buildCalculationMethodSummary({ calculation_breakdown: result.calculationBreakdown });
  assert.ok(summary.methods.length > 0);
  assert.ok(summary.limitations.length > 0);
}

{
  const result = calculateTunnelEngine({
    ...thermalBase,
    processType: "continuous_individual_freezing",
    operationMode: "continuous",
    tunnelType: "continuous_belt",
    arrangementType: "individual_exposed",
    productGeometry: "slab",
    continuousMassMode: "direct_mass_flow",
    directMassKgH: 1000,
    retentionTimeMin: 30,
    productThicknessM: 0,
  });
  assert.ok(result.missingFields.length > 0);
  assert.notEqual(result.status, "adequate");
}

console.log("tunnelEngine tests passed");