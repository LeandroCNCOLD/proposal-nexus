import { strict as assert } from "node:assert";
import { formToTunnelInput } from "../adapters/formToTunnelInput";
import { compareColdProFormulaWithAshrae } from "../core/ashraeComparison";
import { tunnelResultToDatabasePayload } from "../adapters/tunnelInputToDatabasePayload";
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
  nearlyEqual(result.estimatedAirflowM3H, 36380.6, 0.1);
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
  assert.ok(result.energy.latentKJkg > 0);
  assert.ok(result.energy.totalKJkg > 200);
  assert.ok(result.productLoadKW > 15);
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
  assert.equal(continuous.calculationBreakdown.loads?.packagingMassSource, "kg/h");

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
  assert.equal(batch.calculationBreakdown.loads?.packagingMassSource, "kg/batelada");
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
  assert.equal(result.calculationBreakdown.calculationMethod?.methods?.product, "sensível + latente + sensível");
  assert.equal(compareColdProFormulaWithAshrae("transmission").decision, "manter");
  assert.equal(compareColdProFormulaWithAshrae("product").decision, "manter");
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