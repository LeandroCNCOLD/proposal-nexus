/**
 * extraLoadsCalculator.ts
 * 
 * Calcula cargas extras (infiltração, degelo, pessoas, etc) com rateio correto de tempo.
 * Usa resolveLoadRateHours para determinar horas de rateio apropriadas.
 */

import { resolveLoadRateHours, LoadRateResolverInput } from "./loadRateResolver";

export interface ExtraLoadsInput {
  // Infiltração
  infiltrationKcalDay?: number | null;
  infiltrationRecoveryHoursPerDay?: number | null;
  
  // Degelo
  defrostKcalDay?: number | null;
  defrostRecoveryHoursPerDay?: number | null;
  
  // Pessoas
  peopleLoadKcalH?: number | null;
  peopleHoursPerDay?: number | null;
  peopleCount?: number | null;
  
  // Iluminação
  lightingPowerKW?: number | null;
  lightingHoursPerDay?: number | null;
  
  // Motores
  motorsPowerKW?: number | null;
  motorsHoursPerDay?: number | null;
  
  // Ventiladores
  fansPowerKW?: number | null;
  fansHoursPerDay?: number | null;
  
  // Cargas extras manuais
  manualExtraKcalDay?: number | null;
  
  // Horas de operação
  batchTimeH?: number | null;
  operatingHoursPerDay?: number | null;
  compressorHoursPerDay?: number | null;
}

export interface ExtraLoadsBreakdown {
  infiltration: {
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  defrost: {
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  people: {
    instantaneousKcalH: number;
    hoursPerDay: number;
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  lighting: {
    powerKW: number;
    hoursPerDay: number;
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  motors: {
    powerKW: number;
    hoursPerDay: number;
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  fans: {
    powerKW: number;
    hoursPerDay: number;
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  manualExtra: {
    kcalDay: number;
    rateHours: number;
    rateSource: string;
    kcalH: number;
  };
  subtotalKcalH: number;
  warnings: string[];
}

const safeNumber = (val: any): number => {
  const num = Number(val);
  return num > 0 ? num : 0;
};

/**
 * Calcula cargas extras com rateio correto de tempo
 */
export function calculateExtraLoads(input: ExtraLoadsInput): ExtraLoadsBreakdown {
  const warnings: string[] = [];
  const operatingHoursPerDay = safeNumber(input.operatingHoursPerDay) || 16;

  // Resolver horas de rateio para cada tipo de carga
  const infiltrationRate = resolveLoadRateHours({
    loadType: 'infiltration',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    infiltrationRecoveryHoursPerDay: input.infiltrationRecoveryHoursPerDay,
    compressorHoursPerDay: input.compressorHoursPerDay,
  });

  const defrostRate = resolveLoadRateHours({
    loadType: 'defrost',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    defrostRecoveryHoursPerDay: input.defrostRecoveryHoursPerDay,
    compressorHoursPerDay: input.compressorHoursPerDay,
  });

  const peopleRate = resolveLoadRateHours({
    loadType: 'people',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    peopleHoursPerDay: input.peopleHoursPerDay,
  });

  const lightingRate = resolveLoadRateHours({
    loadType: 'lighting',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    lightingHoursPerDay: input.lightingHoursPerDay,
  });

  const motorsRate = resolveLoadRateHours({
    loadType: 'motors',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    motorsHoursPerDay: input.motorsHoursPerDay,
  });

  const fansRate = resolveLoadRateHours({
    loadType: 'fans',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
    fansHoursPerDay: input.fansHoursPerDay,
  });

  const manualExtraRate = resolveLoadRateHours({
    loadType: 'manual_extra',
    batchTimeH: input.batchTimeH,
    operatingHoursPerDay,
  });

  warnings.push(...infiltrationRate.warnings);
  warnings.push(...defrostRate.warnings);
  warnings.push(...peopleRate.warnings);
  warnings.push(...lightingRate.warnings);
  warnings.push(...motorsRate.warnings);
  warnings.push(...fansRate.warnings);
  warnings.push(...manualExtraRate.warnings);

  // Calcular infiltração
  const infiltrationKcalDay = safeNumber(input.infiltrationKcalDay);
  const infiltrationKcalH = infiltrationKcalDay > 0 
    ? infiltrationKcalDay / infiltrationRate.rateHours
    : 0;

  // Calcular degelo
  const defrostKcalDay = safeNumber(input.defrostKcalDay);
  const defrostKcalH = defrostKcalDay > 0
    ? defrostKcalDay / defrostRate.rateHours
    : 0;

  // Calcular pessoas
  const peopleLoadKcalH = safeNumber(input.peopleLoadKcalH);
  const peopleHoursPerDay = safeNumber(input.peopleHoursPerDay);
  const peopleKcalDay = peopleLoadKcalH * peopleHoursPerDay;
  const peopleKcalH = peopleKcalDay > 0
    ? peopleKcalDay / peopleRate.rateHours
    : 0;

  // Calcular iluminação
  const lightingPowerKW = safeNumber(input.lightingPowerKW);
  const lightingHoursPerDay = safeNumber(input.lightingHoursPerDay);
  const lightingKcalDay = lightingPowerKW * lightingHoursPerDay * 860; // 1 kW = 860 kcal/h
  const lightingKcalH = lightingKcalDay > 0
    ? lightingKcalDay / lightingRate.rateHours
    : 0;

  // Calcular motores
  const motorsPowerKW = safeNumber(input.motorsPowerKW);
  const motorsHoursPerDay = safeNumber(input.motorsHoursPerDay);
  const motorsKcalDay = motorsPowerKW * motorsHoursPerDay * 860;
  const motorsKcalH = motorsKcalDay > 0
    ? motorsKcalDay / motorsRate.rateHours
    : 0;

  // Calcular ventiladores
  const fansPowerKW = safeNumber(input.fansPowerKW);
  const fansHoursPerDay = safeNumber(input.fansHoursPerDay);
  const fansKcalDay = fansPowerKW * fansHoursPerDay * 860;
  const fansKcalH = fansKcalDay > 0
    ? fansKcalDay / fansRate.rateHours
    : 0;

  // Calcular cargas extras manuais
  const manualExtraKcalDay = safeNumber(input.manualExtraKcalDay);
  const manualExtraKcalH = manualExtraKcalDay > 0
    ? manualExtraKcalDay / manualExtraRate.rateHours
    : 0;

  const subtotalKcalH = infiltrationKcalH + defrostKcalH + peopleKcalH + lightingKcalH + motorsKcalH + fansKcalH + manualExtraKcalH;

  return {
    infiltration: {
      kcalDay: infiltrationKcalDay,
      rateHours: infiltrationRate.rateHours,
      rateSource: infiltrationRate.source,
      kcalH: infiltrationKcalH,
    },
    defrost: {
      kcalDay: defrostKcalDay,
      rateHours: defrostRate.rateHours,
      rateSource: defrostRate.source,
      kcalH: defrostKcalH,
    },
    people: {
      instantaneousKcalH: peopleLoadKcalH,
      hoursPerDay: peopleHoursPerDay,
      kcalDay: peopleKcalDay,
      rateHours: peopleRate.rateHours,
      rateSource: peopleRate.source,
      kcalH: peopleKcalH,
    },
    lighting: {
      powerKW: lightingPowerKW,
      hoursPerDay: lightingHoursPerDay,
      kcalDay: lightingKcalDay,
      rateHours: lightingRate.rateHours,
      rateSource: lightingRate.source,
      kcalH: lightingKcalH,
    },
    motors: {
      powerKW: motorsPowerKW,
      hoursPerDay: motorsHoursPerDay,
      kcalDay: motorsKcalDay,
      rateHours: motorsRate.rateHours,
      rateSource: motorsRate.source,
      kcalH: motorsKcalH,
    },
    fans: {
      powerKW: fansPowerKW,
      hoursPerDay: fansHoursPerDay,
      kcalDay: fansKcalDay,
      rateHours: fansRate.rateHours,
      rateSource: fansRate.source,
      kcalH: fansKcalH,
    },
    manualExtra: {
      kcalDay: manualExtraKcalDay,
      rateHours: manualExtraRate.rateHours,
      rateSource: manualExtraRate.source,
      kcalH: manualExtraKcalH,
    },
    subtotalKcalH,
    warnings,
  };
}

/**
 * Calcula total de cargas extras com fator de segurança
 */
export function calculateExtraLoadsTotal(
  breakdown: ExtraLoadsBreakdown,
  safetyFactor: number = 1.1
): {
  subtotalKcalH: number;
  safetyKcalH: number;
  totalKcalH: number;
} {
  const subtotalKcalH = breakdown.subtotalKcalH;
  const safetyKcalH = subtotalKcalH * (safetyFactor - 1);
  const totalKcalH = subtotalKcalH + safetyKcalH;

  return {
    subtotalKcalH,
    safetyKcalH,
    totalKcalH,
  };
}
