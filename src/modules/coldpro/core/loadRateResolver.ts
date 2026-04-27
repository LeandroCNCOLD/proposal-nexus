/**
 * loadRateResolver.ts
 * 
 * Resolve as horas de rateio para cada tipo de carga térmica.
 * Evita usar tempo de batelada automaticamente para cargas que não são do processo.
 */

export type LoadType = 
  | 'product_process'
  | 'infiltration'
  | 'defrost'
  | 'people'
  | 'lighting'
  | 'motors'
  | 'fans'
  | 'manual_extra';

export interface LoadRateResolverInput {
  loadType: LoadType;
  batchTimeH?: number | null;
  operatingHoursPerDay?: number | null;
  infiltrationRecoveryHoursPerDay?: number | null;
  defrostRecoveryHoursPerDay?: number | null;
  compressorHoursPerDay?: number | null;
  peopleHoursPerDay?: number | null;
  lightingHoursPerDay?: number | null;
  motorsHoursPerDay?: number | null;
  fansHoursPerDay?: number | null;
}

/**
 * Resolve as horas de rateio para cada tipo de carga
 * 
 * Regras:
 * - product_process: usa batch_time_h ou operating_hours_day
 * - infiltration: usa infiltration_recovery_hours_per_day, depois compressor_hours_per_day, depois operating_hours_per_day, senão 16h
 * - defrost: usa defrost_recovery_hours_per_day, depois compressor_hours_per_day, depois operating_hours_per_day, senão 16h
 * - people: usa people_hours_per_day, depois operating_hours_per_day, senão 16h
 * - lighting: usa lighting_hours_per_day, depois operating_hours_per_day, senão 16h
 * - motors: usa motors_hours_per_day, depois operating_hours_per_day, senão 16h
 * - fans: usa fans_hours_per_day, depois operating_hours_per_day, senão 16h
 * - manual_extra: usa operating_hours_per_day, senão 16h
 * 
 * IMPORTANTE: Nunca usa batch_time_h automaticamente para infiltração, degelo ou pessoas!
 */
export function resolveLoadRateHours(input: LoadRateResolverInput): {
  rateHours: number;
  source: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const safeNumber = (val: any): number => {
    const num = Number(val);
    return num > 0 ? num : 0;
  };

  const batchTimeH = safeNumber(input.batchTimeH);
  const operatingHoursPerDay = safeNumber(input.operatingHoursPerDay) || 16;
  const infiltrationRecoveryHoursPerDay = safeNumber(input.infiltrationRecoveryHoursPerDay);
  const defrostRecoveryHoursPerDay = safeNumber(input.defrostRecoveryHoursPerDay);
  const compressorHoursPerDay = safeNumber(input.compressorHoursPerDay);
  const peopleHoursPerDay = safeNumber(input.peopleHoursPerDay);
  const lightingHoursPerDay = safeNumber(input.lightingHoursPerDay);
  const motorsHoursPerDay = safeNumber(input.motorsHoursPerDay);
  const fansHoursPerDay = safeNumber(input.fansHoursPerDay);

  switch (input.loadType) {
    case 'product_process':
      if (batchTimeH > 0) {
        return { rateHours: batchTimeH, source: 'batch_time_h', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para produto'] };

    case 'infiltration':
      if (infiltrationRecoveryHoursPerDay > 0) {
        return { rateHours: infiltrationRecoveryHoursPerDay, source: 'infiltration_recovery_hours_per_day', warnings };
      }
      if (compressorHoursPerDay > 0) {
        return { rateHours: compressorHoursPerDay, source: 'compressor_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para infiltração'] };

    case 'defrost':
      if (defrostRecoveryHoursPerDay > 0) {
        return { rateHours: defrostRecoveryHoursPerDay, source: 'defrost_recovery_hours_per_day', warnings };
      }
      if (compressorHoursPerDay > 0) {
        return { rateHours: compressorHoursPerDay, source: 'compressor_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para degelo'] };

    case 'people':
      if (peopleHoursPerDay > 0) {
        return { rateHours: peopleHoursPerDay, source: 'people_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para pessoas'] };

    case 'lighting':
      if (lightingHoursPerDay > 0) {
        return { rateHours: lightingHoursPerDay, source: 'lighting_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para iluminação'] };

    case 'motors':
      if (motorsHoursPerDay > 0) {
        return { rateHours: motorsHoursPerDay, source: 'motors_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para motores'] };

    case 'fans':
      if (fansHoursPerDay > 0) {
        return { rateHours: fansHoursPerDay, source: 'fans_hours_per_day', warnings };
      }
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para ventiladores'] };

    case 'manual_extra':
      if (operatingHoursPerDay > 0) {
        return { rateHours: operatingHoursPerDay, source: 'operating_hours_per_day', warnings };
      }
      return { rateHours: 16, source: 'default', warnings: [...warnings, 'Usando 16h padrão para cargas extras'] };

    default:
      return { rateHours: 16, source: 'default', warnings: [...warnings, `Tipo de carga desconhecido: ${input.loadType}`] };
  }
}
