import type { ColdProInfiltrationInput } from "../types/coldPro.types";
import { round } from "../utils/numbers";
import { calculateAirDensityKgM3 } from "./airDensityService";
import { sensibleAirLoadKw } from "./psychrometricService";

export function calculateInfiltrationLoad(input: ColdProInfiltrationInput) {
  const density = calculateAirDensityKgM3(input.altitudeM);
  const doorVolumeM3H = (Math.max(0, input.doorAreaM2) * Math.max(0, input.doorOpeningsPerDay) * Math.max(0, input.openingFactor)) / 24;
  const volumeM3H = Math.max(0, input.airVolumeInfiltratedM3H) + Math.max(0, input.airRenovationM3H) + doorVolumeM3H;
  const deltaT = Math.max(0, input.externalTempC - input.internalTempC);
  const totalKw = sensibleAirLoadKw({ densityKgM3: density, volumeM3H, deltaTK: deltaT });
  return { totalKw, densityKgM3: density, volumeM3H: round(volumeM3H, 2), deltaT: round(deltaT, 2), doorVolumeM3H: round(doorVolumeM3H, 2) };
}
