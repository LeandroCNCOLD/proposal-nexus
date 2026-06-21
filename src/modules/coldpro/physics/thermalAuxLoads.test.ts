import { strict as assert } from "node:assert";
import {
  calculateDefrostLoad,
  calculateLightingLoad,
  calculateMotorLoad,
  calculatePeopleLoad,
} from "./thermalAuxLoads";

function nearlyEqual(actual: number, expected: number, tolerance = 0.001) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

{
  const load = calculateMotorLoad(5);
  nearlyEqual(load.kcalH, 4300);
  nearlyEqual(load.kW, 5);
}

{
  const load = calculateLightingLoad(1000);
  nearlyEqual(load.kcalH, 860);
  nearlyEqual(load.kW, 1);
}

{
  const load = calculatePeopleLoad(3);
  nearlyEqual(load.kcalH, 900);
  nearlyEqual(load.kW, 900 / 860);
}

{
  const load = calculateDefrostLoad({ evaporatorLoadKW: 20, defrostFactor: 0.2 });
  nearlyEqual(load.kW, 4);
  nearlyEqual(load.kcalH, 3440);
}

{
  const lowClamp = calculateDefrostLoad({ evaporatorLoadKW: 20, defrostFactor: 0.01 });
  const highClamp = calculateDefrostLoad({ evaporatorLoadKW: 20, defrostFactor: 0.9 });
  nearlyEqual(lowClamp.kW, 2);
  nearlyEqual(highClamp.kW, 6);
}

console.log("thermalAuxLoads tests passed");
