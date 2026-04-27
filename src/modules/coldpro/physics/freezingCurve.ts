import { safeNumber } from "../core/units";
import { calculateProductSpecificEnergy } from "./productThermal";

export type FreezingCurvePoint = {
  temperatureC: number;
  frozenFraction: number;
  cpKJkgK?: number | null;
};

export type FreezingCurveInput = {
  initialTempC?: number | null;
  finalTempC?: number | null;
  freezingPointC?: number | null;
  cpAboveKJkgK?: number | null;
  cpBelowKJkgK?: number | null;
  latentHeatKJkg?: number | null;
  frozenWaterFraction?: number | null;
  latentResidualFactor?: number | null;
  allowPhaseChange?: boolean | null;
  curve?: FreezingCurvePoint[] | null;
};

export type FreezingCurveInterval = {
  startTempC: number;
  endTempC: number;
  averageTempC: number;
  frozenFractionStart: number;
  frozenFractionEnd: number;
  frozenFractionDelta: number;
  cpKJkgK: number;
  sensibleKJkg: number;
  latentKJkg: number;
  totalKJkg: number;
};

export type FreezingCurveFallbackEnergy = ReturnType<typeof calculateProductSpecificEnergy>;

export type FreezingCurveResult = {
  usedCurve: boolean;
  fallbackRequired: boolean;
  fallbackReason?: string;
  intervals: FreezingCurveInterval[];
  sensibleTotalKJkg: number;
  latentTotalKJkg: number;
  totalKJkg: number;
  fallbackEnergy: FreezingCurveFallbackEnergy;
  warnings: string[];
};

const ENERGY_CONSERVATION_TOLERANCE = 0.01;

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = safeNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampFraction(value: unknown, fallback = 0): number {
  const parsed = finiteNumber(value, fallback);
  return Math.min(Math.max(parsed, 0), 1);
}

function roundTechnical(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
}

function buildFallbackResult(input: FreezingCurveInput, fallbackReason: string, warnings: string[] = []): FreezingCurveResult {
  const fallbackEnergy = calculateProductSpecificEnergy(input);
  return {
    usedCurve: false,
    fallbackRequired: true,
    fallbackReason,
    intervals: [],
    sensibleTotalKJkg: roundTechnical(fallbackEnergy.sensibleAboveKJkg + fallbackEnergy.sensibleBelowKJkg),
    latentTotalKJkg: roundTechnical(fallbackEnergy.latentKJkg),
    totalKJkg: roundTechnical(fallbackEnergy.totalKJkg),
    fallbackEnergy,
    warnings: [...warnings, `Fallback aplicado: ${fallbackReason}`],
  };
}

export function validateFreezingCurve(points: FreezingCurvePoint[] | null | undefined): string[] {
  if (!Array.isArray(points) || points.length < 2) return ["Curva de congelamento ausente ou insuficiente."];

  const warnings: string[] = [];
  points.forEach((point, index) => {
    if (!Number.isFinite(Number(point?.temperatureC))) warnings.push(`Temperatura inválida no ponto ${index + 1}.`);
    if (!Number.isFinite(Number(point?.frozenFraction))) warnings.push(`Fração congelada inválida no ponto ${index + 1}.`);
    const fraction = Number(point?.frozenFraction);
    if (Number.isFinite(fraction) && (fraction < 0 || fraction > 1)) warnings.push(`Fração congelada fora do intervalo físico no ponto ${index + 1}.`);
  });

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (Number(current.temperatureC) >= Number(previous.temperatureC)) warnings.push("Temperatura da curva deve ser monotonicamente decrescente.");
    if (Number(current.frozenFraction) < Number(previous.frozenFraction)) warnings.push("Fração congelada da curva deve ser monotonicamente crescente.");
  }

  return Array.from(new Set(warnings));
}

function normalizeFreezingCurvePoints(points: FreezingCurvePoint[]): FreezingCurvePoint[] {
  return points.map((point) => ({
    temperatureC: finiteNumber(point.temperatureC),
    frozenFraction: clampFraction(point.frozenFraction),
    cpKJkgK: point.cpKJkgK === null || point.cpKJkgK === undefined ? null : Math.max(finiteNumber(point.cpKJkgK), 0),
  }));
}

export function interpolateFrozenFraction(temperatureC: number, points: FreezingCurvePoint[]): number {
  if (points.length === 0) return 0;
  if (temperatureC >= points[0].temperatureC) return clampFraction(points[0].frozenFraction);
  if (temperatureC <= points[points.length - 1].temperatureC) return clampFraction(points[points.length - 1].frozenFraction);

  for (let index = 1; index < points.length; index += 1) {
    const warm = points[index - 1];
    const cold = points[index];
    if (temperatureC <= warm.temperatureC && temperatureC >= cold.temperatureC) {
      const span = warm.temperatureC - cold.temperatureC;
      if (span <= 0) return clampFraction(cold.frozenFraction);
      const progress = (warm.temperatureC - temperatureC) / span;
      return clampFraction(warm.frozenFraction + progress * (cold.frozenFraction - warm.frozenFraction));
    }
  }

  return 0;
}

function resolveCpForInterval(averageTempC: number, input: FreezingCurveInput, points: FreezingCurvePoint[]): number {
  const pointsWithCp = points.filter((point) => Number.isFinite(Number(point.cpKJkgK)) && Number(point.cpKJkgK) > 0);
  if (pointsWithCp.length >= 2) {
    if (averageTempC >= pointsWithCp[0].temperatureC) return finiteNumber(pointsWithCp[0].cpKJkgK, 0);
    if (averageTempC <= pointsWithCp[pointsWithCp.length - 1].temperatureC) return finiteNumber(pointsWithCp[pointsWithCp.length - 1].cpKJkgK, 0);
    for (let index = 1; index < pointsWithCp.length; index += 1) {
      const warm = pointsWithCp[index - 1];
      const cold = pointsWithCp[index];
      if (averageTempC <= warm.temperatureC && averageTempC >= cold.temperatureC) {
        const span = warm.temperatureC - cold.temperatureC;
        const progress = span > 0 ? (warm.temperatureC - averageTempC) / span : 0;
        return Math.max(finiteNumber(warm.cpKJkgK, 0) + progress * (finiteNumber(cold.cpKJkgK, 0) - finiteNumber(warm.cpKJkgK, 0)), 0);
      }
    }
  }

  const freezingPointC = finiteNumber(input.freezingPointC, -1.5);
  return averageTempC > freezingPointC ? Math.max(finiteNumber(input.cpAboveKJkgK, 0), 0) : Math.max(finiteNumber(input.cpBelowKJkgK, 0), 0);
}

function buildTemperatureIntervals(initialTempC: number, finalTempC: number, points: FreezingCurvePoint[]) {
  const breakpoints = [initialTempC, ...points.map((point) => point.temperatureC).filter((temperature) => temperature < initialTempC && temperature > finalTempC), finalTempC];
  return Array.from(new Set(breakpoints)).sort((a, b) => b - a).slice(0, -1).map((startTempC, index, sorted) => ({
    startTempC,
    endTempC: sorted[index + 1] ?? finalTempC,
  })).filter((interval) => interval.startTempC > interval.endTempC);
}

export function calculateFreezingCurveEnergy(input: FreezingCurveInput): FreezingCurveResult {
  const initialTempC = finiteNumber(input.initialTempC, 0);
  const finalTempC = finiteNumber(input.finalTempC, 0);
  const latentHeatKJkg = Math.max(finiteNumber(input.latentHeatKJkg, 0), 0);
  const frozenWaterFraction = clampFraction(input.frozenWaterFraction, 1);
  const latentResidualFactor = clampFraction(input.latentResidualFactor, 1);
  const fallbackEnergy = calculateProductSpecificEnergy(input);
  const validationWarnings = validateFreezingCurve(input.curve);

  if (input.allowPhaseChange === false) return buildFallbackResult(input, "mudança de fase desabilitada", validationWarnings);
  if (initialTempC <= finalTempC) return buildFallbackResult(input, "processo não representa resfriamento", validationWarnings);
  if (latentHeatKJkg <= 0 || frozenWaterFraction <= 0) return buildFallbackResult(input, "dados latentes insuficientes", validationWarnings);
  if (validationWarnings.length > 0) return buildFallbackResult(input, "curva de congelamento inválida", validationWarnings);

  const points = normalizeFreezingCurvePoints(input.curve ?? []);
  const latentLimitKJkg = latentHeatKJkg * frozenWaterFraction * latentResidualFactor;
  const intervals = buildTemperatureIntervals(initialTempC, finalTempC, points).map((interval) => {
    const averageTempC = (interval.startTempC + interval.endTempC) / 2;
    const frozenFractionStart = interpolateFrozenFraction(interval.startTempC, points);
    const frozenFractionEnd = interpolateFrozenFraction(interval.endTempC, points);
    const frozenFractionDelta = Math.max(frozenFractionEnd - frozenFractionStart, 0);
    const cpKJkgK = resolveCpForInterval(averageTempC, input, points);
    const sensibleKJkg = cpKJkgK * Math.abs(interval.startTempC - interval.endTempC);
    const latentKJkg = latentLimitKJkg * frozenFractionDelta;
    return {
      startTempC: roundTechnical(interval.startTempC),
      endTempC: roundTechnical(interval.endTempC),
      averageTempC: roundTechnical(averageTempC),
      frozenFractionStart: roundTechnical(frozenFractionStart),
      frozenFractionEnd: roundTechnical(frozenFractionEnd),
      frozenFractionDelta: roundTechnical(frozenFractionDelta),
      cpKJkgK: roundTechnical(cpKJkgK),
      sensibleKJkg: roundTechnical(sensibleKJkg),
      latentKJkg: roundTechnical(latentKJkg),
      totalKJkg: roundTechnical(sensibleKJkg + latentKJkg),
    };
  });

  const sensibleTotalKJkg = roundTechnical(intervals.reduce((sum, interval) => sum + interval.sensibleKJkg, 0));
  const latentTotalKJkg = roundTechnical(intervals.reduce((sum, interval) => sum + interval.latentKJkg, 0));
  const intervalTotalKJkg = roundTechnical(intervals.reduce((sum, interval) => sum + interval.totalKJkg, 0));
  const componentTotalKJkg = roundTechnical(sensibleTotalKJkg + latentTotalKJkg);
  const conservationDivergence = componentTotalKJkg > 0 ? Math.abs(intervalTotalKJkg - componentTotalKJkg) / componentTotalKJkg : 0;

  if (latentTotalKJkg > latentLimitKJkg * 1.000001) {
    return buildFallbackResult(input, "calor latente incremental excedeu o limite físico", [
      `Latente calculado ${roundTechnical(latentTotalKJkg)} kJ/kg maior que limite ${roundTechnical(latentLimitKJkg)} kJ/kg.`,
    ]);
  }

  if (conservationDivergence > ENERGY_CONSERVATION_TOLERANCE) {
    return buildFallbackResult(input, "divergência de conservação de energia acima de 1%", [
      `Divergência energética de ${roundTechnical(conservationDivergence * 100)}%.`,
    ]);
  }

  if (!Number.isFinite(componentTotalKJkg) || intervals.some((interval) => !Number.isFinite(interval.totalKJkg))) {
    return buildFallbackResult(input, "resultado numérico inválido na curva", ["Curva gerou valor não numérico."]);
  }

  return {
    usedCurve: true,
    fallbackRequired: false,
    intervals,
    sensibleTotalKJkg,
    latentTotalKJkg,
    totalKJkg: componentTotalKJkg,
    fallbackEnergy,
    warnings: [],
  };
}