import { round } from "../utils/numbers";

export function calculateAtmosphericPressurePa(altitudeM: number): number {
  return 101325 * Math.pow(1 - 2.25577e-5 * Math.max(0, altitudeM), 5.2559);
}

export function calculateAirDensityKgM3(altitudeM: number): number {
  if (altitudeM < 500) return 1.2;
  return round(1.2 * (calculateAtmosphericPressurePa(altitudeM) / 101325), 4);
}
