import { strict as assert } from "node:assert";
import type { TunnelEngineInput } from "../types/tunnelEngine.types";
import { calculateTunnelEngine } from "./tunnelEngine";

const thermalBase: TunnelEngineInput = {
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
  beltMotorKW: 0,
  internalFansKW: 0,
  otherInternalKW: 0,
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

const base = calculateTunnelEngine(thermalBase);
const withAux = calculateTunnelEngine({
  ...thermalBase,
  internalFansKW: 2,
  beltMotorKW: 1,
  lightingPowerW: 1000,
  peopleCount: 2,
  defrostFactor: 0.1,
});

assert.equal(base.productLoadKW, withAux.productLoadKW);
assert.equal(base.infiltrationLoadKW, withAux.infiltrationLoadKW);
assert.ok(withAux.totalKW > base.totalKW);

const auxLoads = (withAux.calculationBreakdown.loads ?? {}) as Record<string, unknown>;
const auxIncreasePercent = Number(auxLoads.auxiliaryIncreasePercent ?? 0);
assert.ok(auxIncreasePercent > 0);
assert.ok(Number(auxLoads.defrostLoadKW ?? 0) > 0);

console.log(
  JSON.stringify(
    {
      baseTotalKW: base.totalKW,
      withAuxTotalKW: withAux.totalKW,
      auxiliaryIncreasePercent: auxIncreasePercent,
    },
    null,
    2,
  ),
);
console.log("tunnelEngineAuxLoads tests passed");
