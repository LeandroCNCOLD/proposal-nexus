import { round } from "../utils/numbers";

export const AIR_CP_KJ_KG_K = 1.005;

export function sensibleAirLoadKw(params: { densityKgM3: number; volumeM3H: number; deltaTK: number }) {
  return round((params.densityKgM3 * params.volumeM3H * AIR_CP_KJ_KG_K * params.deltaTK) / 3600, 3);
}
