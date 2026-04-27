export const KW_TO_KCAL_H = 859.845;
export const KCAL_H_TO_KW = 1 / KW_TO_KCAL_H;
export const TR_TO_KCAL_H = 3024;
export const KCAL_H_TO_TR = 1 / 3024;
export const KJ_TO_KCAL = 0.2388458966;
export const KCAL_TO_KJ = 4.1868;

export const AIR_DENSITY_KG_M3 = 1.2;
export const AIR_SPECIFIC_HEAT_KCAL_KG_C = 0.24;
export const DEFAULT_PEOPLE_LOAD_KCAL_H = 300;

export function kcalhToKw(kcalh: number): number {
  return kcalh * KCAL_H_TO_KW;
}

export function kcalhToTr(kcalh: number): number {
  return kcalh * KCAL_H_TO_TR;
}

export function kwToKcalh(kw: number): number {
  return kw * KW_TO_KCAL_H;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
