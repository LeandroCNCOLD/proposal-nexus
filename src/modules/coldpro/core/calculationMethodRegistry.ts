export type ColdProCalculationMethodStatus =
  | "official"
  | "official_with_limitations"
  | "allowed_simplified"
  | "preferred"
  | "legacy"
  | "deprecated";

export type ColdProCalculationMethodArea =
  | "transmission"
  | "productCoolingFreezing"
  | "continuousProductLoad"
  | "batchProductLoad"
  | "packagingContinuous"
  | "packagingBatch"
  | "infiltrationSimple"
  | "infiltrationPsychrometric"
  | "internalLoads"
  | "airFlowBalance"
  | "airVelocity"
  | "convectiveCoefficient"
  | "freezingTime"
  | "equipmentSelection";

export interface ColdProCalculationMethodDefinition {
  area: ColdProCalculationMethodArea;
  name: string;
  ashraeReference: string;
  formula: string;
  units: string;
  description: string;
  coldProDecision: string;
  status: ColdProCalculationMethodStatus;
  limitations?: string;
  requiredInputs?: string[];
}

export const COLDPRO_CALCULATION_METHODS: Record<ColdProCalculationMethodArea, ColdProCalculationMethodDefinition> = {
  transmission: {
    area: "transmission",
    name: "Transmissão térmica em regime permanente",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads",
    formula: "Q = U × A × ΔT",
    units: "W, kW, kcal/h",
    description: "Calcula a carga térmica por condução através de paredes, teto, piso, portas e demais faces construtivas.",
    coldProDecision: "Manter como método oficial.",
    status: "official",
    requiredInputs: ["U", "área", "temperatura externa", "temperatura interna"],
  },
  productCoolingFreezing: {
    area: "productCoolingFreezing",
    name: "Energia específica do produto: sensível + latente + sensível abaixo",
    ashraeReference: "ASHRAE Refrigeration — Thermal Properties of Foods / Cooling and Freezing Times of Foods",
    formula: "q = Cp_acima × ΔT_acima + L × fração_congelável + Cp_abaixo × ΔT_abaixo",
    units: "kJ/kg",
    description: "Calcula a energia removida por kg de produto considerando resfriamento acima do congelamento, mudança de fase e resfriamento abaixo do congelamento.",
    coldProDecision: "Manter como método oficial.",
    status: "official",
    requiredInputs: ["Cp acima", "Cp abaixo", "calor latente", "fração congelável", "temperatura inicial", "temperatura final", "ponto de congelamento"],
  },
  continuousProductLoad: {
    area: "continuousProductLoad",
    name: "Carga de produto em processo contínuo",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads / Industrial Food-Freezing Systems",
    formula: "Q(kW) = m_dot(kg/h) × q(kJ/kg) / 3600",
    units: "kW",
    description: "Calcula a potência frigorífica de produto em túneis contínuos, esteiras, girofreezers e processos com vazão mássica horária.",
    coldProDecision: "Manter como método oficial.",
    status: "official",
    requiredInputs: ["massa kg/h", "energia específica kJ/kg"],
  },
  batchProductLoad: {
    area: "batchProductLoad",
    name: "Carga de produto em batelada",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads / Industrial Food-Freezing Systems",
    formula: "Q(kW) = m(kg) × q(kJ/kg) / (tempo_h × 3600)",
    units: "kW",
    description: "Calcula a potência frigorífica equivalente para túneis estáticos, pallets, carrinhos, racks e blast freezers com massa total de batelada.",
    coldProDecision: "Manter como método oficial. Não usar kg/h como massa principal em batelada.",
    status: "official",
    requiredInputs: ["massa total da batelada", "energia específica", "tempo de batelada"],
  },
  packagingContinuous: {
    area: "packagingContinuous",
    name: "Carga de embalagem em processo contínuo",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads",
    formula: "Q_emb(kW) = m_emb(kg/h) × Cp_emb(kJ/kg.K) × ΔT / 3600",
    units: "kW",
    description: "Calcula a carga térmica da embalagem em processos contínuos.",
    coldProDecision: "Manter para processos contínuos.",
    status: "official",
    requiredInputs: ["massa embalagem kg/h", "Cp embalagem", "ΔT"],
  },
  packagingBatch: {
    area: "packagingBatch",
    name: "Carga de embalagem em batelada",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads",
    formula: "Q_emb(kW) = m_emb(kg) × Cp_emb(kJ/kg.K) × ΔT / (tempo_h × 3600)",
    units: "kW",
    description: "Calcula a carga térmica da embalagem em túneis estáticos, pallets, carrinhos, racks e blast freezers.",
    coldProDecision: "Adicionar/corrigir. Em batelada, a massa de embalagem deve ser tratada como massa total da batelada, não kg/h.",
    status: "official",
    requiredInputs: ["massa embalagem da batelada", "Cp embalagem", "ΔT", "tempo de batelada"],
  },
  infiltrationSimple: {
    area: "infiltrationSimple",
    name: "Infiltração simplificada por trocas de ar",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads",
    formula: "Q ≈ ρ × V_dot × Cp × ΔT + parcela latente estimada",
    units: "kW, kcal/h",
    description: "Método simplificado para estimar infiltração com base em volume, trocas de ar, portas e diferença de temperatura.",
    coldProDecision: "Manter como método permitido simplificado.",
    status: "allowed_simplified",
    limitations: "Menos preciso em baixa temperatura quando a umidade e a formação de gelo têm grande influência.",
  },
  infiltrationPsychrometric: {
    area: "infiltrationPsychrometric",
    name: "Infiltração por diferença de entalpia psicrométrica",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads / Psychrometrics",
    formula: "Q = m_ar × (h_externo - h_interno)",
    units: "kW, kcal/h",
    description: "Método preferencial para baixa temperatura, pois considera calor sensível e latente da umidade infiltrada.",
    coldProDecision: "Criar como método avançado/preferencial quando houver dados psicrométricos.",
    status: "preferred",
    requiredInputs: ["temperatura externa", "umidade externa", "temperatura interna", "umidade interna", "vazão de infiltração ou abertura de portas"],
  },
  internalLoads: {
    area: "internalLoads",
    name: "Cargas internas",
    ashraeReference: "ASHRAE Refrigeration — Refrigerated-Facility Loads",
    formula: "Q = pessoas + iluminação + motores + ventiladores + degelo + outras cargas",
    units: "kW, kcal/h",
    description: "Soma cargas internas dissipadas dentro do ambiente refrigerado.",
    coldProDecision: "Manter. Melhorar rastreabilidade se motor/ventilador estiver dentro ou fora do ambiente.",
    status: "official",
  },
  airFlowBalance: {
    area: "airFlowBalance",
    name: "Vazão de ar por balanço térmico sensível",
    ashraeReference: "ASHRAE Refrigeration — Air coolers / load balance principles",
    formula: "V(m³/h) = Q(kW) × 3600 / (ρ_ar × Cp_ar × ΔT_ar)",
    units: "m³/h",
    description: "Estima a vazão de ar necessária para remover a carga térmica com determinado ΔT do ar.",
    coldProDecision: "Manter como método oficial para vazão recomendada.",
    status: "official",
    limitations: "A vazão calculada é referência térmica. Distribuição de ar, perda de carga, geometria e velocidade no produto ainda precisam ser avaliadas.",
  },
  airVelocity: {
    area: "airVelocity",
    name: "Velocidade real do ar pela área livre",
    ashraeReference: "ASHRAE Refrigeration — Air distribution and industrial freezing practice",
    formula: "v = (V_m³_h / 3600) / A_livre",
    units: "m/s",
    description: "Calcula a velocidade real do ar passando pelo produto considerando área bruta e fator de bloqueio.",
    coldProDecision: "Manter como método oficial.",
    status: "official",
    requiredInputs: ["vazão de ar", "largura da seção", "altura da seção", "fator de bloqueio"],
  },
  convectiveCoefficient: {
    area: "convectiveCoefficient",
    name: "Coeficiente convectivo estimado por velocidade",
    ashraeReference: "ASHRAE Refrigeration — Cooling and Freezing Times of Foods / heat transfer principles",
    formula: "h_base = 10 + 10 × v^0,8; h_efetivo = h_base × fator_exposição × fator_ar",
    units: "W/m².K",
    description: "Estima o coeficiente convectivo a partir da velocidade do ar e aplica correções de exposição. Se h manual for informado, o valor manual prevalece.",
    coldProDecision: "Manter como estimativa de engenharia com rastreabilidade.",
    status: "official_with_limitations",
    limitations: "Coeficientes convectivos reais dependem de geometria, turbulência, embalagem, arranjo e distribuição de ar.",
  },
  freezingTime: {
    area: "freezingTime",
    name: "Tempo até o núcleo por modelo tipo Plank/ASHRAE",
    ashraeReference: "ASHRAE Refrigeration — Cooling and Freezing Times of Foods",
    formula: "t = função(ρ, L, fração congelável, dimensão, h, k, T_cong, T_ar)",
    units: "min",
    description: "Estima o tempo necessário para o frio atingir o núcleo do produto, caixa ou bloco equivalente.",
    coldProDecision: "Manter como estimativa oficial com limitação explícita.",
    status: "official_with_limitations",
    limitations: "Para pallets compactos, caixas empilhadas, produtos irregulares e fluxo de ar não uniforme, o resultado deve ser tratado como estimativa conservadora e validado em campo.",
    requiredInputs: ["densidade", "calor latente", "fração congelável", "dimensão característica", "h efetivo", "condutividade", "temperatura do ar", "ponto de congelamento"],
  },
  equipmentSelection: {
    area: "equipmentSelection",
    name: "Seleção por carga validada e curva real de catálogo",
    ashraeReference: "ASHRAE Refrigeration — equipment selection principles",
    formula: "capacidade selecionada ≥ carga requerida corrigida no ponto de operação",
    units: "kcal/h, kW, TR",
    description: "Seleciona equipamentos a partir da carga requerida e da curva real de desempenho no ponto de evaporação e condensação.",
    coldProDecision: "Manter. Sempre exibir carga usada, ponto de curva e sobra técnica.",
    status: "official",
  },
};

export const COLDPRO_CALCULATION_METHOD_REGISTRY_VERSION = "ashrae-comparison-v1.0.0";
export const COLDPRO_CALCULATION_METHODS_COMPAT = {
  ...COLDPRO_CALCULATION_METHODS,
  packagingContinuousLoad: COLDPRO_CALCULATION_METHODS.packagingContinuous,
  packagingBatchLoad: COLDPRO_CALCULATION_METHODS.packagingBatch,
};
export type ColdProCalculationMethodKey = keyof typeof COLDPRO_CALCULATION_METHODS;
export type ColdProCalculationMethod = ColdProCalculationMethodDefinition;

export function getColdProCalculationMethod(area: ColdProCalculationMethodArea) {
  return COLDPRO_CALCULATION_METHODS[area];
}

export function listColdProCalculationMethods() {
  return Object.values(COLDPRO_CALCULATION_METHODS);
}
