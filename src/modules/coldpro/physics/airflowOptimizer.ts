/**
 * airflowOptimizer.ts
 * 
 * Otimiza a vazão de ar para acertar o tempo de congelamento.
 * Usa busca binária para encontrar a vazão mínima que congela no tempo disponível.
 */

import { calculatePlankFreezingTimeMin } from "./freezingTime";

export interface AirflowOptimizationParams {
  availableTimeMin: number;
  densityKgM3: number;
  latentHeatKJkg: number;
  frozenWaterFraction: number;
  freezingPointC: number;
  airTempC: number;
  distanceToCoreM: number;
  kEffectiveWMK: number;
  areaLibreM2: number;
  minVelocityMS?: number; // 2.5 m/s padrão
  maxVelocityMS?: number; // 10 m/s máximo
  cpAboveKJkgK?: number; // Para cálculo de h
}

export interface AirflowOptimizationResult {
  requiredAirflowM3H: number;
  requiredVelocityMS: number;
  estimatedTimeMin: number;
  feasible: boolean;
  warnings: string[];
  iterations: number;
}

/**
 * Estima o coeficiente convectivo (h) baseado na velocidade do ar
 * Usa correlação empírica para convecção forçada
 * 
 * Referência: ASHRAE Handbook
 * h = 5.8 + 3.94 * v (para ar em movimento)
 * onde v é a velocidade em m/s e h é em W/m²K
 */
function estimateConvectiveCoefficient(velocityMS: number): number {
  if (velocityMS <= 0) return 5.8; // Convecção natural
  // Correlação para convecção forçada
  return 5.8 + 3.94 * velocityMS;
}

/**
 * Calcula a vazão de ar necessária para congelar no tempo disponível
 * Usa busca binária para encontrar a vazão mínima
 * 
 * @param params Parâmetros de otimização
 * @returns Resultado da otimização com vazão necessária
 */
export function calculateRequiredAirflowForFreezingTime(
  params: AirflowOptimizationParams
): AirflowOptimizationResult {
  const minVelocityMS = params.minVelocityMS || 2.5;
  const maxVelocityMS = params.maxVelocityMS || 10;
  const minAirflowM3H = params.areaLibreM2 * minVelocityMS * 3600;
  const maxAirflowM3H = params.areaLibreM2 * maxVelocityMS * 3600;

  const warnings: string[] = [];
  let iterations = 0;
  const maxIterations = 30;

  // Validação de entrada
  if (params.availableTimeMin <= 0) {
    return {
      requiredAirflowM3H: maxAirflowM3H,
      requiredVelocityMS: maxVelocityMS,
      estimatedTimeMin: 0,
      feasible: false,
      warnings: ["Tempo disponível inválido"],
      iterations: 0,
    };
  }

  if (params.densityKgM3 <= 0 || params.latentHeatKJkg <= 0 || params.frozenWaterFraction <= 0) {
    return {
      requiredAirflowM3H: maxAirflowM3H,
      requiredVelocityMS: maxVelocityMS,
      estimatedTimeMin: 0,
      feasible: false,
      warnings: ["Propriedades do produto inválidas"],
      iterations: 0,
    };
  }

  // Testar se é possível com vazão máxima
  const maxVelocity = maxAirflowM3H / (params.areaLibreM2 * 3600);
  const maxH = estimateConvectiveCoefficient(maxVelocity);
  const timeAtMaxAirflow = calculatePlankFreezingTimeMin({
    densityKgM3: params.densityKgM3,
    latentHeatKJkg: params.latentHeatKJkg,
    frozenWaterFraction: params.frozenWaterFraction,
    freezingPointC: params.freezingPointC,
    airTempC: params.airTempC,
    distanceToCoreM: params.distanceToCoreM,
    hEffectiveWM2K: maxH,
    kEffectiveWMK: params.kEffectiveWMK,
  });

  if (timeAtMaxAirflow === null || timeAtMaxAirflow > params.availableTimeMin) {
    warnings.push(
      `Não é possível congelar no tempo disponível (${params.availableTimeMin} min) ` +
      `mesmo com vazão máxima (${maxAirflowM3H.toFixed(0)} m³/h, tempo: ${timeAtMaxAirflow?.toFixed(1) || "N/A"} min)`
    );
    return {
      requiredAirflowM3H: maxAirflowM3H,
      requiredVelocityMS: maxVelocity,
      estimatedTimeMin: timeAtMaxAirflow || params.availableTimeMin * 2,
      feasible: false,
      warnings,
      iterations: 1,
    };
  }

  // Busca binária para encontrar vazão mínima
  let lowAirflow = minAirflowM3H;
  let highAirflow = maxAirflowM3H;
  let bestAirflow = maxAirflowM3H;
  let bestTime = timeAtMaxAirflow;

  while (lowAirflow < highAirflow && iterations < maxIterations) {
    iterations++;
    const midAirflow = (lowAirflow + highAirflow) / 2;
    const velocity = midAirflow / (params.areaLibreM2 * 3600);
    const h = estimateConvectiveCoefficient(velocity);

    const timeAtMidAirflow = calculatePlankFreezingTimeMin({
      densityKgM3: params.densityKgM3,
      latentHeatKJkg: params.latentHeatKJkg,
      frozenWaterFraction: params.frozenWaterFraction,
      freezingPointC: params.freezingPointC,
      airTempC: params.airTempC,
      distanceToCoreM: params.distanceToCoreM,
      hEffectiveWM2K: h,
      kEffectiveWMK: params.kEffectiveWMK,
    });

    if (timeAtMidAirflow === null) {
      // Erro no cálculo, usar vazão maior
      lowAirflow = midAirflow;
      continue;
    }

    if (timeAtMidAirflow <= params.availableTimeMin) {
      // Tempo é suficiente, tentar vazão menor
      bestAirflow = midAirflow;
      bestTime = timeAtMidAirflow;
      highAirflow = midAirflow - 0.1; // Pequeno decremento para evitar loop infinito
    } else {
      // Tempo é insuficiente, precisa de vazão maior
      lowAirflow = midAirflow + 0.1; // Pequeno incremento
    }
  }

  const finalVelocity = bestAirflow / (params.areaLibreM2 * 3600);

  if (iterations >= maxIterations) {
    warnings.push(`Otimização atingiu limite de iterações (${maxIterations})`);
  }

  return {
    requiredAirflowM3H: bestAirflow,
    requiredVelocityMS: finalVelocity,
    estimatedTimeMin: bestTime || params.availableTimeMin,
    feasible: (bestTime || 0) <= params.availableTimeMin,
    warnings,
    iterations,
  };
}

/**
 * Calcula a vazão recomendada considerando tempo de congelamento
 * 
 * Lógica:
 * 1. Se tempo estimado > tempo disponível:
 *    - Calcular vazão necessária para acertar o tempo
 *    - Se não for possível, usar vazão máxima e alertar
 * 2. Se tempo estimado <= tempo disponível:
 *    - Usar vazão por carga térmica (mais econômica)
 */
export function resolveRecommendedAirflow(params: {
  airflowByThermalLoadM3H: number;
  airflowByMinVelocityM3H: number;
  estimatedTimeMin: number;
  availableTimeMin: number;
  freezingParams?: AirflowOptimizationParams;
}): {
  recommendedAirflowM3H: number;
  recommendedVelocityMS: number;
  rationale: string;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Se tempo é suficiente, usar vazão por carga (mais econômica)
  if (params.estimatedTimeMin <= params.availableTimeMin) {
    return {
      recommendedAirflowM3H: params.airflowByThermalLoadM3H,
      recommendedVelocityMS: params.airflowByThermalLoadM3H / (params.freezingParams?.areaLibreM2 || 1) / 3600,
      rationale: "Tempo suficiente com vazão por carga térmica (mais econômica)",
      warnings,
    };
  }

  // Se tempo é insuficiente, calcular vazão necessária
  if (params.freezingParams) {
    const optimization = calculateRequiredAirflowForFreezingTime(params.freezingParams);
    warnings.push(...optimization.warnings);

    if (optimization.feasible) {
      return {
        recommendedAirflowM3H: optimization.requiredAirflowM3H,
        recommendedVelocityMS: optimization.requiredVelocityMS,
        rationale: `Vazão otimizada para acertar tempo de congelamento (${optimization.estimatedTimeMin.toFixed(1)} min)`,
        warnings,
      };
    } else {
      // Não é possível congelar no tempo disponível
      warnings.push("Não é possível congelar no tempo disponível. Recomendando vazão máxima.");
      return {
        recommendedAirflowM3H: params.airflowByMinVelocityM3H,
        recommendedVelocityMS: params.airflowByMinVelocityM3H / (params.freezingParams.areaLibreM2 * 3600),
        rationale: "Vazão máxima (não é possível acertar tempo disponível)",
        warnings,
      };
    }
  }

  // Fallback: usar maior entre carga e velocidade mínima
  return {
    recommendedAirflowM3H: Math.max(params.airflowByThermalLoadM3H, params.airflowByMinVelocityM3H),
    recommendedVelocityMS: Math.max(params.airflowByThermalLoadM3H, params.airflowByMinVelocityM3H) / (((params.freezingParams as AirflowOptimizationParams | undefined)?.areaLibreM2) || 1) / 3600,
    rationale: "Vazão padrão (maior entre carga térmica e velocidade mínima)",
    warnings: [...warnings, "Parâmetros de congelamento não fornecidos"],
  };
}
