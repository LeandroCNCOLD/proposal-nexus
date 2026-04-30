import { estimateCOP } from "../energy/energyCalculator";

export type CompressorCandidate = {
  id?: string | number | null;
  model?: string | null;
  name?: string | null;
  capacityKW?: number | null;
  capacity_kw?: number | null;
  capacityKcalH?: number | null;
  capacity_kcal_h?: number | null;
  cop?: number | null;
  evaporatingTempC?: number | null;
  evaporating_temp_c?: number | null;
  condensingTempC?: number | null;
  condensing_temp_c?: number | null;
  [key: string]: unknown;
};

export type CompressorSelection = {
  compressor: CompressorCandidate;
  capacityKW: number;
  requiredLoadKW: number;
  cop: number;
  oversizingPercent: number;
  estimatedPowerKW: number;
};

export type CompressorSelectionResult = {
  selected: CompressorSelection | null;
  candidates: CompressorSelection[];
  warnings: string[];
};

const KW_PER_KCAL_H = 1 / 860;

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function capacityKW(compressor: CompressorCandidate): number {
  return (
    positiveNumber(compressor.capacityKW ?? compressor.capacity_kw) ||
    positiveNumber(compressor.capacityKcalH ?? compressor.capacity_kcal_h) * KW_PER_KCAL_H
  );
}

function supportsConditions(
  compressor: CompressorCandidate,
  evapTemp: number,
  condTemp: number,
): boolean {
  const compressorEvap = compressor.evaporatingTempC ?? compressor.evaporating_temp_c;
  const compressorCond = compressor.condensingTempC ?? compressor.condensing_temp_c;
  const evapOk =
    compressorEvap === null ||
    compressorEvap === undefined ||
    Number(compressorEvap) <= evapTemp + 5;
  const condOk =
    compressorCond === null ||
    compressorCond === undefined ||
    Number(compressorCond) >= condTemp - 5;
  return evapOk && condOk;
}

export function selectCompressor(
  loadKW: number,
  evapTemp: number,
  condTemp: number,
  compressors:
    | CompressorCandidate[]
    | {
        compressors?: CompressorCandidate[] | null;
        candidates?: CompressorCandidate[] | null;
      } = [],
): CompressorSelectionResult {
  const requiredLoadKW = positiveNumber(loadKW);
  const estimatedCOP = estimateCOP(evapTemp, condTemp);
  const compressorList = Array.isArray(compressors)
    ? compressors
    : (compressors.compressors ?? compressors.candidates ?? []);
  const warnings: string[] = [];
  if (requiredLoadKW <= 0) warnings.push("Carga térmica inválida para seleção de compressor.");
  if (compressorList.length === 0) warnings.push("Lista de compressores vazia.");

  const candidates = compressorList
    .map((compressor): CompressorSelection | null => {
      const capacity = capacityKW(compressor);
      if (capacity <= 0 || capacity < requiredLoadKW) return null;
      if (!supportsConditions(compressor, evapTemp, condTemp)) return null;
      const cop = positiveNumber(compressor.cop) || estimatedCOP;
      return {
        compressor,
        capacityKW: capacity,
        requiredLoadKW,
        cop,
        oversizingPercent:
          requiredLoadKW > 0 ? ((capacity - requiredLoadKW) / requiredLoadKW) * 100 : 0,
        estimatedPowerKW: cop > 0 ? requiredLoadKW / cop : 0,
      };
    })
    .filter((candidate): candidate is CompressorSelection => Boolean(candidate))
    .sort((a, b) => a.oversizingPercent - b.oversizingPercent);

  if (requiredLoadKW > 0 && candidates.length === 0) {
    warnings.push("Nenhum compressor atende à carga térmica e às condições informadas.");
  }

  return {
    selected: candidates[0] ?? null,
    candidates,
    warnings,
  };
}
