import { COLDPRO_CONSTANTS } from "./constants";

export const ENGINE_ENERGY_UNIT = "kJ" as const;
export const ENGINE_POWER_UNIT = "kW" as const;
export const DEFAULT_THERMAL_DISPLAY_UNIT = "kcal/h" as const;
export type ThermalLoadUnit = "kcal/h" | "kW" | "TR" | "BTU/h";

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

export function kwToBtuh(kw: number): number {
  return safeNumber(kw) * COLDPRO_CONSTANTS.BTUH_PER_KW;
}

export function convertThermalLoad(valueKW: number, targetUnit: ThermalLoadUnit): number {
  const kw = safeNumber(valueKW);
  if (targetUnit === "kcal/h") return kwToKcalH(kw);
  if (targetUnit === "TR") return kwToTr(kw);
  if (targetUnit === "BTU/h") return kwToBtuh(kw);
  return kw;
}

export function convertThermalLoadToKW(value: number, sourceUnit: ThermalLoadUnit): number {
  const safeValue = safeNumber(value);
  if (sourceUnit === "kcal/h") return kcalHToKw(safeValue);
  if (sourceUnit === "TR") return safeValue * COLDPRO_CONSTANTS.KW_PER_TR;
  if (sourceUnit === "BTU/h") return safeValue / COLDPRO_CONSTANTS.BTUH_PER_KW;
  return safeValue;
}
