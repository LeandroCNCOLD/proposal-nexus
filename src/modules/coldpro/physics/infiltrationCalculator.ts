/**
 * CALCULADORA DE INFILTRAÇÃO - Método Correto por Tipo de Operação
 * 
 * Regra Principal: NUNCA misturar V_dia com t_ciclo
 * 
 * Dois métodos distintos:
 * 1. Por Ciclo (Túnel Blast Freezer) - V_ciclo / t_ciclo_h
 * 2. Por Dia (Câmara Fria) - V_dia / h_rateio
 */

export interface InfiltrationInput {
  // Identificação do tipo
  environmentType?: string; // 'blast_freezer', 'cold_room', 'freezer_room', etc
  processMode?: string; // 'batch', 'continuous'
  
  // Dados da porta
  doorWidthM?: number;
  doorHeightM?: number;
  doorAirVelocityMS?: number; // 0.5 m/s típico
  doorProtectionFactor?: number; // 1.0 = sem proteção
  
  // Método por Ciclo (Túnel)
  openingsPerCycle?: number; // Aberturas POR CICLO
  doorOpenTimeSecondsPerOpening?: number; // Tempo aberta por abertura
  batchTimeH?: number; // Tempo do ciclo em horas
  
  // Método por Dia (Câmara)
  openingsPerDay?: number; // Aberturas POR DIA
  infiltrationRecoveryHoursPerDay?: number;
  compressorHoursPerDay?: number;
  operatingHoursPerDay?: number;
}

export interface InfiltrationResult {
  method: 'per_cycle' | 'per_day';
  volumeM3PerCycle?: number; // Para método por ciclo
  volumeM3PerDay?: number; // Para método por dia
  airflowM3H: number; // Vazão equivalente em m³/h
  warnings: string[];
  errors: string[];
}

/**
 * Detecta qual método usar baseado no tipo de ambiente
 */
function detectMethod(input: InfiltrationInput): 'per_cycle' | 'per_day' {
  const envType = String(input.environmentType || '').toLowerCase();
  const processMode = String(input.processMode || '').toLowerCase();
  const batchTimeH = input.batchTimeH ?? 0;
  const openingsPerDay = input.openingsPerDay ?? 0;
  const openingsPerCycle = input.openingsPerCycle ?? 0;

  if (
    (envType.includes('blast') || envType.includes('tunnel')) &&
    (processMode === 'batch' || batchTimeH > 0)
  ) {
    return 'per_cycle';
  }

  if (
    envType.includes('cold_room') ||
    envType.includes('freezer_room') ||
    envType.includes('storage') ||
    envType.includes('conserv')
  ) {
    return 'per_day';
  }

  if (openingsPerDay > 0) return 'per_day';
  if (openingsPerCycle > 0 && batchTimeH > 0) return 'per_cycle';
  return 'per_day';
}

/**
 * Calcula infiltração por CICLO (Túnel Blast Freezer)
 * 
 * V_ciclo = A_porta × velocidade_ar × t_abertura_ciclo × fator_protecao
 * Q_vol_m3_h = V_ciclo / t_ciclo_h
 */
function calculatePerCycle(input: InfiltrationInput): InfiltrationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validações
  if (!input.doorWidthM || !input.doorHeightM) {
    errors.push('Dimensões da porta não informadas');
  }
  if (!input.doorAirVelocityMS) {
    warnings.push('Velocidade do ar não informada, usando 0.5 m/s');
  }
  if (!input.openingsPerCycle) {
    errors.push('Aberturas por ciclo não informadas');
  }
  if (!input.batchTimeH) {
    errors.push('Tempo de ciclo não informado');
  }
  
  if (errors.length > 0) {
    return {
      method: 'per_cycle',
      airflowM3H: 0,
      warnings,
      errors,
    };
  }
  
  // Cálculos
  const doorAreaM2 = (input.doorWidthM ?? 0) * (input.doorHeightM ?? 0);
  const velocityMS = input.doorAirVelocityMS || 0.5;
  const protectionFactor = input.doorProtectionFactor || 1.0;
  const timeOpenSecondsPerOpening = input.doorOpenTimeSecondsPerOpening || 300;
  const totalOpenTimeSeconds = (input.openingsPerCycle ?? 0) * timeOpenSecondsPerOpening;

  // Volume por ciclo
  const volumeM3PerCycle = doorAreaM2 * velocityMS * totalOpenTimeSeconds * protectionFactor;

  // Vazão equivalente em m³/h
  const airflowM3H = volumeM3PerCycle / (input.batchTimeH ?? 1);
  
  // Validações adicionais
  if (totalOpenTimeSeconds > 600) {
    warnings.push(`Tempo de porta aberta por ciclo elevado: ${totalOpenTimeSeconds}s (> 600s)`);
  }
  
  return {
    method: 'per_cycle',
    volumeM3PerCycle,
    airflowM3H,
    warnings,
    errors,
  };
}

/**
 * Calcula infiltração por DIA (Câmara Fria)
 * 
 * V_dia = A_porta × velocidade_ar × t_abertura_dia × fator_protecao
 * Q_vol_m3_h = V_dia / h_rateio
 */
function calculatePerDay(input: InfiltrationInput): InfiltrationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validações
  if (!input.doorWidthM || !input.doorHeightM) {
    errors.push('Dimensões da porta não informadas');
  }
  if (!input.doorAirVelocityMS) {
    warnings.push('Velocidade do ar não informada, usando 0.5 m/s');
  }
  if (!input.openingsPerDay) {
    errors.push('Aberturas por dia não informadas');
  }
  
  if (errors.length > 0) {
    return {
      method: 'per_day',
      airflowM3H: 0,
      warnings,
      errors,
    };
  }
  
  // Cálculos
  const doorAreaM2 = (input.doorWidthM ?? 0) * (input.doorHeightM ?? 0);
  const velocityMS = input.doorAirVelocityMS || 0.5;
  const protectionFactor = input.doorProtectionFactor || 1.0;
  const timeOpenSecondsPerOpening = input.doorOpenTimeSecondsPerOpening || 300;
  const totalOpenTimeSeconds = (input.openingsPerDay ?? 0) * timeOpenSecondsPerOpening;
  
  // Volume por dia
  const volumeM3PerDay = doorAreaM2 * velocityMS * totalOpenTimeSeconds * protectionFactor;
  
  // Horas de rateio (prioridade)
  const rateHours =
    (input.infiltrationRecoveryHoursPerDay && input.infiltrationRecoveryHoursPerDay > 0 ? input.infiltrationRecoveryHoursPerDay : null) ||
    (input.compressorHoursPerDay && input.compressorHoursPerDay > 0 ? input.compressorHoursPerDay : null) ||
    (input.operatingHoursPerDay && input.operatingHoursPerDay > 0 ? input.operatingHoursPerDay : null) ||
    16; // Fallback técnico
  
  // Vazão equivalente em m³/h
  const airflowM3H = volumeM3PerDay / rateHours;
  
  return {
    method: 'per_day',
    volumeM3PerDay,
    airflowM3H,
    warnings,
    errors,
  };
}

/**
 * Função principal: Calcula infiltração com método correto
 */
export function calculateInfiltrationAirflow(input: InfiltrationInput): InfiltrationResult {
  const method = detectMethod(input);
  
  if (method === 'per_cycle') {
    return calculatePerCycle(input);
  } else {
    return calculatePerDay(input);
  }
}
