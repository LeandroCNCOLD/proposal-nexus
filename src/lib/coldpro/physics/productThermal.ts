/**
 * productThermal.ts
 * 
 * Módulo de cálculos termofísicos do produto
 * Baseado em padrões ASHRAE 2022
 * 
 * Fórmulas:
 * Q1 (Resfriamento) = m × Cp_AT × (T_inicial - T_congelamento)
 * Q2 (Congelamento) = m × Cl × Fator_congelamento  [CRÍTICO: incluir fator!]
 * Q3 (Subresfriamento) = m × Cp_AP × (T_congelamento - T_final)
 * Q_total = Q1 + Q2 + Q3 [kJ]
 */

export interface ProductThermalProperties {
  // Identificação
  productId: string;
  productName: string;
  
  // Temperaturas (°C)
  tempInicial: number;
  tempCongelamento: number;
  tempFinal: number;
  
  // Propriedades termofísicas
  // ⚠️ IMPORTANTE: Todas em kJ/kg·K (não kcal!)
  // Se seus dados estão em kcal, use convertProductPropertiesIfNeeded()
  // Fator de conversão: 1 kcal = 4.184 kJ
  cpAT: number; // kJ/kg·K - Calor específico acima do ponto de congelamento
  cpAP: number; // kJ/kg·K - Calor específico abaixo do ponto de congelamento
  calorLatente: number; // kJ/kg - Calor latente de congelamento
  
  // Fator de congelamento (0 a 1)
  fatorCongelamento: number;
  
  // Propriedades físicas
  densidade: number; // kg/m³
  
  // Respiração (para produtos vivos)
  taxaRespiracao?: number; // mW/kg @ temperatura de referência
  fatorTemperaturaRespiracao?: number; // Fator de correção por temperatura
}

export interface ThermalLoadResult {
  // Cargas por fase (kJ)
  Q1_resfriamento: number;
  Q2_congelamento: number;
  Q3_subresfriamento: number;
  
  // Carga total do produto (kJ)
  Q_total_kJ: number;
  
  // Potência (kW) - depende do tempo
  Q_total_kW?: number;
  
  // Respiração (kW)
  Q_respiracao_kW?: number;
  
  // Detalhes
  energiaEspecifica_kJ_kg: number; // Energia específica do produto
  massaProcessada_kg?: number;
  tempoCongelamento_horas?: number;
}

/**
 * Converte propriedades de kcal para kJ se necessário
 * 
 * IMPORTANTE: Use esta função se seus dados estão em kcal/kg·K
 * Fator de conversão: 1 kcal = 4.184 kJ
 * 
 * @param props Propriedades termofísicas do produto
 * @param sourceUnit Unidade de origem ("kcal" ou "kJ")
 * @returns Propriedades convertidas para kJ
 */
export function convertProductPropertiesIfNeeded(
  props: ProductThermalProperties,
  sourceUnit: "kcal" | "kJ" = "kJ"
): ProductThermalProperties {
  if (sourceUnit === "kcal") {
    console.warn(
      `⚠️  Convertendo propriedades de kcal para kJ para ${props.productName}`
    );
    return {
      ...props,
      cpAT: props.cpAT * 4.184,
      cpAP: props.cpAP * 4.184,
      calorLatente: props.calorLatente * 4.184,
    };
  }
  return props;
}

/**
 * Calcula a energia específica do produto (kJ/kg)
 * 
 * Esta é a função CRÍTICA que estava faltando no sistema original
 * 
 * @param props Propriedades termofísicas do produto
 * @returns Energia específica em kJ/kg
 */
export function calculateProductSpecificEnergy(
  props: ProductThermalProperties
): number {
  const {
    tempInicial,
    tempCongelamento,
    tempFinal,
    cpAT,
    cpAP,
    calorLatente,
    fatorCongelamento,
  } = props;

  // Fase 1: Resfriamento (acima do ponto de congelamento)
  // Q1 = Cp_AT × (T_inicial - T_congelamento)
  const Q1_especifica = cpAT * (tempInicial - tempCongelamento);

  // Fase 2: Congelamento (latente) - CORREÇÃO: Se latente já está preenchido, usar direto
  // Q2 = Cl (SEM multiplicar por fator_congelamento)
  // Fator de congelamento deve ser usado APENAS como origem/auditoria
  const Q2_especifica = calorLatente;

  // Fase 3: Subresfriamento (abaixo do ponto de congelamento)
  // Q3 = Cp_AP × (T_congelamento - T_final)
  const Q3_especifica = cpAP * (tempCongelamento - tempFinal);

  // Energia específica total (kJ/kg)
  const energiaEspecifica = Q1_especifica + Q2_especifica + Q3_especifica;

  // Validação
  if (energiaEspecifica < 0) {
    console.warn(
      `Energia específica negativa para ${props.productName}: ${energiaEspecifica} kJ/kg`
    );
  }

  return energiaEspecifica;
}

/**
 * Calcula a carga térmica total do produto
 * 
 * @param props Propriedades termofísicas do produto
 * @param massa Massa do produto em kg
 * @param tempoCongelamento Tempo de congelamento em horas
 * @returns Resultado detalhado da carga térmica
 */
export function calculateProductThermalLoad(
  props: ProductThermalProperties,
  massa: number,
  tempoCongelamento: number
): ThermalLoadResult {
  const {
    tempInicial,
    tempCongelamento,
    tempFinal,
    cpAT,
    cpAP,
    calorLatente,
    fatorCongelamento,
    taxaRespiracao,
    fatorTemperaturaRespiracao = 1.0,
  } = props;

  // Fase 1: Resfriamento
  // Q1 = m × Cp_AT × (T_inicial - T_congelamento)
  const Q1_resfriamento = massa * cpAT * (tempInicial - tempCongelamento);

  // Fase 2: Congelamento (CORREÇÃO: Se latente já está preenchido, usar direto)
  // Q2 = m × Cl (SEM multiplicar por fator_congelamento)
  const Q2_congelamento = massa * calorLatente;

  // Fase 3: Subresfriamento
  // Q3 = m × Cp_AP × (T_congelamento - T_final)
  const Q3_subresfriamento = massa * cpAP * (tempCongelamento - tempFinal);

  // Carga total do produto (kJ)
  const Q_total_kJ = Q1_resfriamento + Q2_congelamento + Q3_subresfriamento;

  // Converter para potência (kW)
  // Tempo em segundos
  const tempoSegundos = tempoCongelamento * 3600;
  const Q_total_kW = Q_total_kJ / tempoSegundos;

  // Carga de respiração (se aplicável)
  let Q_respiracao_kW = 0;
  if (taxaRespiracao && taxaRespiracao > 0) {
    // Taxa em mW/kg, converter para W/kg e depois para kW
    const Q_respiracao_W = massa * taxaRespiracao * fatorTemperaturaRespiracao;
    Q_respiracao_kW = Q_respiracao_W / 1000;
  }

  // Energia específica (kJ/kg)
  const energiaEspecifica = calculateProductSpecificEnergy(props);

  return {
    Q1_resfriamento,
    Q2_congelamento,
    Q3_subresfriamento,
    Q_total_kJ,
    Q_total_kW,
    Q_respiracao_kW: Q_respiracao_kW > 0 ? Q_respiracao_kW : undefined,
    energiaEspecifica_kJ_kg: energiaEspecifica,
    massaProcessada_kg: massa,
    tempoCongelamento_horas: tempoCongelamento,
  };
}

/**
 * Valida as propriedades termofísicas do produto
 * 
 * @param props Propriedades a validar
 * @returns Array de erros (vazio se válido)
 */
export function validateProductProperties(
  props: ProductThermalProperties
): string[] {
  const errors: string[] = [];

  // Validar temperaturas
  if (props.tempInicial <= props.tempCongelamento) {
    errors.push(
      `Temperatura inicial (${props.tempInicial}°C) deve ser maior que temperatura de congelamento (${props.tempCongelamento}°C)`
    );
  }

  if (props.tempCongelamento <= props.tempFinal) {
    errors.push(
      `Temperatura de congelamento (${props.tempCongelamento}°C) deve ser maior que temperatura final (${props.tempFinal}°C)`
    );
  }

  // Validar propriedades termofísicas
  if (props.cpAT <= 0) {
    errors.push(`Cp_AT deve ser positivo: ${props.cpAT}`);
  }

  if (props.cpAP <= 0) {
    errors.push(`Cp_AP deve ser positivo: ${props.cpAP}`);
  }

  if (props.calorLatente <= 0) {
    errors.push(`Calor latente deve ser positivo: ${props.calorLatente}`);
  }

  // Validar fator de congelamento
  if (props.fatorCongelamento < 0 || props.fatorCongelamento > 1) {
    errors.push(
      `Fator de congelamento deve estar entre 0 e 1: ${props.fatorCongelamento}`
    );
  }

  // Validar densidade
  if (props.densidade <= 0) {
    errors.push(`Densidade deve ser positiva: ${props.densidade}`);
  }

  return errors;
}

/**
 * Exemplo de uso:
 * 
 * const paoDQueijo: ProductThermalProperties = {
 *   productId: "pao-queijo-1",
 *   productName: "Pão de Queijo",
 *   tempInicial: 25,
 *   tempCongelamento: -2.83,
 *   tempFinal: -18,
 *   cpAT: 2.02,
 *   cpAP: 1.12,
 *   calorLatente: 146.42,
 *   fatorCongelamento: 0.72, // CRÍTICO!
 *   densidade: 1070,
 * };
 * 
 * const resultado = calculateProductThermalLoad(paoDQueijo, 1000, 1.9615);
 * console.log(resultado);
 * // Resultado esperado:
 * // Q1: 56.200 kJ
 * // Q2: 105.422 kJ (COM fator!)
 * // Q3: 16.990 kJ
 * // Total: 178.612 kJ = 25,3 kW
 */
