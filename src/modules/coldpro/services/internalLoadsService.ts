import type { ColdProInternalLoadsInput } from "../types/coldPro.types";
import { round } from "../utils/numbers";

export function calculateInternalLoads(input: ColdProInternalLoadsInput) {
  const peopleKw = (input.peopleQuantity * input.peopleLoadW * input.peopleUseFactor) / 1000;
  const lightingKw = (input.lightingAreaM2 * input.lightingWM2 * input.lightingUseFactor) / 1000;
  const motorsKw = input.motorsPowerKw * input.motorsUseFactor;
  const packagingKw = (input.packagingMassKg * input.packagingCpKjKgK * input.packagingDeltaTK) / 3600;
  const respirationKw = input.applyRespiration ? (input.respirationMassKg * input.respirationRateWKg) / 1000 : 0;
  return { peopleKw: round(peopleKw, 3), lightingKw: round(lightingKw, 3), motorsKw: round(motorsKw, 3), packagingKw: round(packagingKw, 3), respirationKw: round(respirationKw, 3), pullDownKw: round(input.pullDownKw, 3) };
}
