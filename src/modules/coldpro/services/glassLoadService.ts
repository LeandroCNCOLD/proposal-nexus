import type { ColdProGlassType, ColdProSolarLevel } from "../types/coldPro.types";

export const GLASS_U_VALUES_W_M2K: Record<ColdProGlassType, number> = {
  none: 0,
  vidro_simples: 5.8,
  vidro_duplo: 2.8,
  vidro_triplo: 1.8,
  low_e_duplo: 1.6,
  vidro_frigorifico_aquecido: 2.5,
};

export const SOLAR_RADIATION_W_M2: Record<ColdProSolarLevel, number> = {
  sem_sol: 0,
  moderado: 150,
  forte: 300,
  critico: 500,
};

export function glassTransmissionWatts(areaM2: number, glassType: ColdProGlassType, deltaTK: number) {
  return Math.max(0, areaM2) * (GLASS_U_VALUES_W_M2K[glassType] ?? 0) * Math.max(0, deltaTK);
}

export function glassSolarWatts(areaM2: number, solarLevel: ColdProSolarLevel, solarFactor: number) {
  return Math.max(0, areaM2) * (SOLAR_RADIATION_W_M2[solarLevel] ?? 0) * Math.max(0, solarFactor);
}
