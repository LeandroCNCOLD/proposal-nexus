import { strict as assert } from "node:assert";
import { tunnelResultToDatabasePayload } from "../adapters/tunnelInputToDatabasePayload";
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
    productThicknessM: 0.03,
  });
  nearlyEqual(result.productLoadKW, 70.125);
  nearlyEqual(result.totalKW, 73.125);
  nearlyEqual(result.estimatedAirflowM3H, 36380.6, 0.1);
  assert.equal(result.engineVersion, COLDPRO_TUNNEL_ENGINE_VERSION);
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