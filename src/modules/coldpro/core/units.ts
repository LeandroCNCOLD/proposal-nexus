import { COLDPRO_CONSTANTS } from "./constants";

export function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function kwToKcalH(kw: number): number {
  return safeNumber(kw) * COLDPRO_CONSTANTS.KW_TO_KCAL_H;
}

export function kcalHToKw(kcalH: number): number {
  return safeNumber(kcalH) / COLDPRO_CONSTANTS.KW_TO_KCAL_H;
}

export function kwToTr(kw: number): number {
  return safeNumber(kw) / COLDPRO_CONSTANTS.KW_PER_TR;
}
