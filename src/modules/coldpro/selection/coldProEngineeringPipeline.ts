import type { TunnelEngineInput, TunnelEngineResult } from "../types/tunnelEngine.types";
import { calculateTunnelEngine } from "../engines/tunnelEngine";
import {
  calculateEnergy,
  type EnergyCalculationInput,
  type EnergyCalculationResult,
} from "../energy/energyCalculator";
import {
  selectCompressor,
  type CompressorCandidate,
  type CompressorSelectionConditions,
  type CompressorSelectionResult,
} from "./compressorSelector";
import {
  selectEvaporator,
  type EvaporatorCandidate,
  type EvaporatorSelectionConditions,
  type EvaporatorSelectionResult,
} from "./evaporatorSelector";

export type ColdProEngineeringPipelineInput = {
  tunnelInput?: TunnelEngineInput;
  load?: {
    totalKW?: number | null;
    totalKcalH?: number | null;
    breakdown?: TunnelEngineResult["breakdown"];
  };
  conditions?: {
    evaporatingTempC?: number | null;
    condensingTempC?: number | null;
    evaporatorDeltaT?: number | null;
    evaporatorType?: string | null;
  } | null;
  evaporators?: EvaporatorCandidate[] | null;
  compressors?: CompressorCandidate[] | null;
  evaporatorConditions?: EvaporatorSelectionConditions | null;
  compressorConditions?: Omit<CompressorSelectionConditions, "loadKW"> | null;
  energy?: Omit<EnergyCalculationInput, "coolingLoadKW" | "COP"> & { COP?: number | null };
};

export type ColdProEngineeringPipelineResult = {
  load: {
    totalKW: number;
    totalKcalH: number;
    breakdown: TunnelEngineResult["breakdown"];
  };
  equipment: {
    evaporator: EvaporatorSelectionResult;
    compressor: CompressorSelectionResult;
  };
  energy: {
    powerKW: number;
    monthlyKWh: number;
    monthlyCost: number;
    costPerKg: number;
    detail: EnergyCalculationResult;
  };
  thermal: TunnelEngineResult;
};

export function runColdProEngineeringPipeline(
  input: ColdProEngineeringPipelineInput,
): ColdProEngineeringPipelineResult {
  const thermal = input.tunnelInput
    ? calculateTunnelEngine(input.tunnelInput)
    : ({} as TunnelEngineResult);
  const loadKW = input.load?.totalKW ?? thermal.totalLoadKW ?? thermal.totalKW;
  const totalKcalH = input.load?.totalKcalH ?? thermal.totalLoadKcalH ?? thermal.totalKcalH;
  const breakdown = input.load?.breakdown ?? thermal.breakdown;
  const evaporator = selectEvaporator(loadKW, {
    ...(input.evaporatorConditions ?? {}),
    evaporatingTempC:
      input.evaporatorConditions?.evaporatingTempC ?? input.conditions?.evaporatingTempC,
    airDeltaTC: input.evaporatorConditions?.airDeltaTC ?? input.conditions?.evaporatorDeltaT,
    type: input.evaporatorConditions?.type ?? input.conditions?.evaporatorType,
    candidates: input.evaporators ?? input.evaporatorConditions?.candidates ?? [],
  });
  const compressor = selectCompressor(
    loadKW,
    input.compressorConditions?.evapTempC ?? input.conditions?.evaporatingTempC ?? 0,
    input.compressorConditions?.condTempC ?? input.conditions?.condensingTempC ?? 0,
    input.compressors ?? input.compressorConditions?.candidates ?? [],
  );
  const energy = calculateEnergy({
    ...(input.energy ?? {}),
    coolingLoadKW: loadKW,
    COP: input.energy?.COP ?? compressor.selected?.cop ?? 0,
  });

  return {
    load: {
      totalKW: loadKW,
      totalKcalH,
      breakdown,
    },
    equipment: {
      evaporator,
      compressor,
    },
    energy: {
      powerKW: energy.powerInputKW,
      monthlyKWh: energy.monthlyConsumptionKWh,
      monthlyCost: energy.monthlyCost,
      costPerKg: energy.costPerKg,
      detail: energy,
    },
    thermal,
  };
}
