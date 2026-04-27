import { safeNumber } from "../core/units";

export type CompressorType = "reciprocating" | "scroll" | "screw" | "semi_hermetic" | "unknown" | string;
export type RefrigerantType = "R404A" | "R507" | "R448A" | "R449A" | "R134a" | "R717" | "CO2" | "unknown" | string;
export type TechnicalRisk = "low" | "medium" | "high";

export type CompressorPerformanceInput = {
  compressorType?: CompressorType | null;
  refrigerant?: RefrigerantType | null;
  evaporatingTempC?: number | null;
  condensingTempC?: number | null;
  requiredCoolingCapacityKW?: number | null;
  estimatedEfficiency?: number | null;
};

export type CompressorPerformanceResult = {
  normalizedCompressorType: "reciprocating" | "scroll" | "screw" | "semi_hermetic" | "unknown";
  normalizedRefrigerant: string;
  typicalEfficiencyRange: { min: number; max: number };
  efficiencyFactor: number;
  capacityCorrectionFactor: number;
  efficiencyCorrectionFactor: number;
  operatingRisk: TechnicalRisk;
  warnings: string[];
  assumptions: Record<string, unknown>;
};

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = safeNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeCompressorType(value: unknown): CompressorPerformanceResult["normalizedCompressorType"] {
  const normalized = String(value ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (["reciprocating", "piston", "alternativo", "semi_hermetic_piston"].includes(normalized)) return "reciprocating";
  if (["scroll"].includes(normalized)) return "scroll";
  if (["screw", "parafuso"].includes(normalized)) return "screw";
  if (["semi_hermetic", "semihermetic", "semi_hermetico"].includes(normalized)) return "semi_hermetic";
  return "unknown";
}

function normalizeRefrigerant(value: unknown): string {
  const normalized = String(value ?? "unknown").trim().toUpperCase().replace(/[\s-]+/g, "");
  if (["R404A", "R507", "R448A", "R449A", "R134A", "R717", "NH3", "CO2", "R744"].includes(normalized)) {
    if (normalized === "NH3") return "R717";
    if (normalized === "R744") return "CO2";
    return normalized;
  }
  return "unknown";
}

function typicalEfficiencyRange(compressorType: CompressorPerformanceResult["normalizedCompressorType"]): { min: number; max: number } {
  if (compressorType === "reciprocating" || compressorType === "semi_hermetic") return { min: 0.45, max: 0.55 };
  if (compressorType === "scroll") return { min: 0.5, max: 0.6 };
  if (compressorType === "screw") return { min: 0.55, max: 0.65 };
  return { min: 0.45, max: 0.6 };
}

function refrigerantEfficiencyCorrection(refrigerant: string): number {
  if (refrigerant === "R717") return 1.06;
  if (refrigerant === "CO2") return 0.92;
  if (refrigerant === "R448A" || refrigerant === "R449A") return 1.02;
  if (refrigerant === "R404A" || refrigerant === "R507") return 0.98;
  return 1;
}

export function estimateCompressorPerformance(input: CompressorPerformanceInput): CompressorPerformanceResult {
  const normalizedCompressorType = normalizeCompressorType(input?.compressorType);
  const normalizedRefrigerant = normalizeRefrigerant(input?.refrigerant);
  const evaporatingTempC = finiteNumber(input?.evaporatingTempC, -35);
  const condensingTempC = finiteNumber(input?.condensingTempC, 40);
  const requiredCoolingCapacityKW = Math.max(finiteNumber(input?.requiredCoolingCapacityKW, 0), 0);
  const range = typicalEfficiencyRange(normalizedCompressorType);
  const userEfficiency = finiteNumber(input?.estimatedEfficiency, 0);
  const baseEfficiency = userEfficiency > 0 ? clamp(userEfficiency, 0.2, 0.85) : (range.min + range.max) / 2;
  const liftK = condensingTempC - evaporatingTempC;
  const liftPenalty = liftK > 65 ? clamp(1 - (liftK - 65) * 0.004, 0.78, 1) : liftK < 35 ? clamp(1 + (35 - liftK) * 0.002, 1, 1.08) : 1;
  const capacityCorrectionFactor = requiredCoolingCapacityKW > 0 && requiredCoolingCapacityKW < 10 ? 0.95 : requiredCoolingCapacityKW > 250 ? 0.97 : 1;
  const efficiencyCorrectionFactor = refrigerantEfficiencyCorrection(normalizedRefrigerant) * liftPenalty;
  const efficiencyFactor = clamp(baseEfficiency * efficiencyCorrectionFactor, 0.2, 0.85);
  const warnings: string[] = [];

  if (normalizedCompressorType === "unknown") warnings.push("Tipo de compressor não informado ou não reconhecido; eficiência típica conservadora aplicada.");
  if (normalizedRefrigerant === "unknown") warnings.push("Fluido refrigerante não informado ou não reconhecido; sem correção específica de fluido.");
  if (liftK <= 0) warnings.push("Temperatura de condensação deve ser maior que a temperatura de evaporação.");
  if (liftK > 75) warnings.push("Diferencial condensação-evaporação elevado; COP real pode ser baixo e o risco operacional aumenta.");
  if (requiredCoolingCapacityKW <= 0) warnings.push("Carga térmica requerida ausente; potência elétrica retornada por outros módulos deve ser zero.");

  const operatingRisk: TechnicalRisk = liftK > 75 || efficiencyFactor < 0.38 ? "high" : liftK > 60 || efficiencyFactor < 0.48 ? "medium" : "low";

  return {
    normalizedCompressorType,
    normalizedRefrigerant,
    typicalEfficiencyRange: range,
    efficiencyFactor,
    capacityCorrectionFactor,
    efficiencyCorrectionFactor,
    operatingRisk,
    warnings,
    assumptions: {
      baseEfficiency,
      liftK,
      liftPenalty,
      refrigerantEfficiencyCorrection: refrigerantEfficiencyCorrection(normalizedRefrigerant),
      capacityCorrectionBasis: "Correção aproximada por faixa de capacidade, sem curva de fabricante.",
    },
  };
}