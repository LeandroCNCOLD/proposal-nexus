import { safeNumber } from "../core/units";
import { estimateCompressorPerformance, type CompressorType, type RefrigerantType } from "./compressorPerformance";

export type CopModelInput = {
  evaporatingTempC?: number | null;
  condensingTempC?: number | null;
  compressorType?: CompressorType | null;
  refrigerant?: RefrigerantType | null;
  requiredCoolingCapacityKW?: number | null;
  estimatedEfficiency?: number | null;
};

export type CopModelResult = {
  cop: number;
  copCarnot: number;
  theoreticalCarnotCOP: number;
  efficiencyFactor: number;
  electricalPowerKW: number;
  warnings: string[];
  assumptions: Record<string, unknown>;
};

const ABSOLUTE_ZERO_C = -273.15;

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = safeNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTechnical(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}

function celsiusToKelvin(tempC: number): number {
  return tempC - ABSOLUTE_ZERO_C;
}

export function calculateApproximateCOP(input: CopModelInput): CopModelResult {
  const evaporatingTempC = finiteNumber(input?.evaporatingTempC, -35);
  const condensingTempC = finiteNumber(input?.condensingTempC, 40);
  const requiredCoolingCapacityKW = Math.max(finiteNumber(input?.requiredCoolingCapacityKW, 0), 0);
  const evaporatingTempK = celsiusToKelvin(evaporatingTempC);
  const condensingTempK = celsiusToKelvin(condensingTempC);
  const temperatureLiftK = condensingTempK - evaporatingTempK;
  const performance = estimateCompressorPerformance(input);
  const warnings = [...performance.warnings];

  if (evaporatingTempK <= 0 || condensingTempK <= 0) warnings.push("Temperaturas absolutas inválidas para cálculo de COP de Carnot.");
  if (temperatureLiftK <= 0) {
    return {
      cop: 0,
      copCarnot: 0,
      theoreticalCarnotCOP: 0,
      efficiencyFactor: roundTechnical(performance.efficiencyFactor),
      electricalPowerKW: 0,
      warnings: Array.from(new Set([...warnings, "COP não calculado porque Tcond deve ser maior que Tevap."])),
      assumptions: {
        evaporatingTempC,
        condensingTempC,
        evaporatingTempK: roundTechnical(evaporatingTempK),
        condensingTempK: roundTechnical(condensingTempK),
        temperatureLiftK: roundTechnical(temperatureLiftK),
        compressorPerformance: performance,
      },
    };
  }

  const copCarnot = evaporatingTempK > 0 ? evaporatingTempK / temperatureLiftK : 0;
  const cop = Math.max(copCarnot * performance.efficiencyFactor, 0);
  const electricalPowerKW = cop > 0 ? requiredCoolingCapacityKW / cop : 0;

  if (cop > 0 && cop < 0.8) warnings.push("COP real muito baixo para aplicação frigorífica; revisar temperaturas de operação e seleção do compressor.");
  if (cop > 8) warnings.push("COP real alto para túnel de congelamento; revisar temperaturas informadas.");

  return {
    cop: roundTechnical(cop),
    copCarnot: roundTechnical(copCarnot),
    theoreticalCarnotCOP: roundTechnical(copCarnot),
    efficiencyFactor: roundTechnical(performance.efficiencyFactor),
    electricalPowerKW: roundTechnical(electricalPowerKW),
    warnings: Array.from(new Set(warnings)),
    assumptions: {
      formula: "COP_real = COP_Carnot × eficiência; potência elétrica = carga térmica / COP_real.",
      evaporatingTempC,
      condensingTempC,
      evaporatingTempK: roundTechnical(evaporatingTempK),
      condensingTempK: roundTechnical(condensingTempK),
      temperatureLiftK: roundTechnical(temperatureLiftK),
      requiredCoolingCapacityKW,
      compressorPerformance: performance,
    },
  };
}