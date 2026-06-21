import { strict as assert } from "node:assert";
import { calculateEnergy, estimateCOP } from "../energy/energyCalculator";
import { runColdProEngineeringPipeline } from "./coldProEngineeringPipeline";
import { selectCompressor } from "./compressorSelector";
import { selectEvaporator } from "./evaporatorSelector";

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

function nearlyEqual(actual: number, expected: number, tolerance = 0.001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

{
  const selected = selectEvaporator(10, {
    evaporators: [
      {
        id: "small",
        model: "EVP-10",
        capacityKcalH: 10_000,
        evaporatingTempC: -30,
        deltaT: 6,
        type: "tunel",
      },
      {
        id: "fit",
        model: "EVP-12",
        capacityKcalH: 12_000,
        evaporatingTempC: -30,
        deltaT: 6,
        type: "tunel",
      },
      {
        id: "large",
        model: "EVP-20",
        capacityKcalH: 20_000,
        evaporatingTempC: -30,
        deltaT: 6,
        type: "tunel",
      },
    ],
    evaporatingTempC: -30,
    deltaT: 6,
    type: "tunel",
  });
  assert.equal(selected.evaporator?.id, "small");
  nearlyEqual(selected.requiredCapacityKcalH, 9890);
}

{
  const cop = estimateCOP(-30, 40, 0.5);
  assert.ok(cop > 0);
  const selected = selectCompressor(10, -30, 40, {
    compressors: [
      { id: "under", model: "CMP-8", capacityKW: 8, cop },
      { id: "fit", model: "CMP-11", capacityKW: 11, cop },
    ],
  });
  assert.equal(selected.selected?.compressor.id, "fit");
  assert.equal(selected.selected?.cop, cop);
}

{
  const energy = calculateEnergy({
    coolingLoadKW: 10,
    COP: 2,
    hoursPerDay: 10,
    daysPerMonth: 20,
    energyCostPerKWh: 1.2,
    massPerDay: 1000,
  });
  nearlyEqual(energy.powerKW, 5);
  nearlyEqual(energy.monthlyKWh, 1000);
  nearlyEqual(energy.monthlyCost, 1200);
  nearlyEqual(energy.costPerKg, 0.06);
}

{
  const pipeline = runColdProEngineeringPipeline({
    tunnelInput: thermalBase,
    evaporatorConditions: {
      evaporatingTempC: -30,
      airDeltaTC: 6,
      type: "tunel",
    },
    compressorConditions: {
      evapTempC: -30,
      condTempC: 40,
    },
    evaporators: [
      {
        id: "evp",
        model: "EVP",
        capacityKcalH: 90_000,
        evaporatingTempC: -30,
        deltaT: 6,
        type: "tunel",
      },
    ],
    compressors: [{ id: "cmp", model: "CMP", capacityKW: 100 }],
    energy: { hoursPerDay: 10, daysPerMonth: 20, energyCostPerKWh: 1.2, massPerDay: 1000 },
  });
  assert.equal(pipeline.equipment.evaporator.evaporator?.id, "evp");
  assert.equal(pipeline.equipment.compressor.selected?.compressor.id, "cmp");
  assert.ok(pipeline.energy.monthlyKWh > 0);
}

console.log("coldProEngineeringPipeline tests passed");
