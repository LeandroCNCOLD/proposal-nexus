import { COLDPRO_CALCULATION_METHODS } from "./calculationMethodRegistry";

export interface AshraeColdProComparison {
  area: string;
  title: string;
  coldProCurrentMethod: string;
  ashraeRecommendedMethod: string;
  decision: "keep" | "adjust" | "add_advanced_method" | "document_limitation" | "deprecate";
  actionRequired: string;
  priority: "high" | "medium" | "low";
  notes: string;
}

export const ASHRAE_COLDPRO_COMPARISONS: AshraeColdProComparison[] = [
  {
    area: "transmission",
    title: "Transmissão térmica",
    coldProCurrentMethod: "Q = U × A × ΔT por face construtiva.",
    ashraeRecommendedMethod: "Carga por transmissão em regime permanente usando U, área e diferença de temperatura.",
    decision: "keep",
    actionRequired: "Manter fórmula e melhorar rastreabilidade por face.",
    priority: "low",
    notes: "Fórmula atual está adequada.",
  },
  {
    area: "product",
    title: "Carga térmica do produto",
    coldProCurrentMethod: "Sensível acima + latente + sensível abaixo.",
    ashraeRecommendedMethod: "Energia removida com propriedades térmicas do alimento, incluindo mudança de fase quando aplicável.",
    decision: "keep",
    actionRequired: "Manter fórmula e exibir energia específica detalhada.",
    priority: "low",
    notes: "Estrutura atual está adequada.",
  },
  {
    area: "packaging",
    title: "Carga térmica da embalagem",
    coldProCurrentMethod: "Predominantemente tratada como kg/h em alguns fluxos.",
    ashraeRecommendedMethod: "Energia da embalagem calculada por massa, Cp, ΔT e tempo de processo.",
    decision: "adjust",
    actionRequired: "Corrigir batelada para usar massa total de embalagem da batelada.",
    priority: "high",
    notes: "Em túnel estático, pallet, carrinho e blast freezer, embalagem deve ser kg por batelada, não kg/h.",
  },
  {
    area: "infiltration",
    title: "Infiltração",
    coldProCurrentMethod: "Método simplificado por carga extra/troca de ar.",
    ashraeRecommendedMethod: "Preferir diferença de entalpia psicrométrica em baixa temperatura quando houver dados de umidade.",
    decision: "add_advanced_method",
    actionRequired: "Manter método simples e adicionar método psicrométrico avançado.",
    priority: "medium",
    notes: "Para câmaras negativas, umidade e gelo podem ser parcela relevante.",
  },
  {
    area: "airflow",
    title: "Vazão de ar",
    coldProCurrentMethod: COLDPRO_CALCULATION_METHODS.airFlowBalance.formula,
    ashraeRecommendedMethod: "Balanço térmico sensível para estimar vazão de ar.",
    decision: "keep",
    actionRequired: "Manter e documentar como vazão térmica recomendada.",
    priority: "low",
    notes: "A fórmula é coerente, mas não substitui análise de distribuição de ar.",
  },
  {
    area: "airVelocity",
    title: "Velocidade real do ar",
    coldProCurrentMethod: "v = vazão / área livre.",
    ashraeRecommendedMethod: "Velocidade deve considerar seção livre, bloqueio e arranjo do produto.",
    decision: "keep",
    actionRequired: "Manter e validar fator de bloqueio em percentual.",
    priority: "low",
    notes: "Método atual é adequado para diagnóstico de túnel.",
  },
  {
    area: "freezingTime",
    title: "Tempo até o núcleo",
    coldProCurrentMethod: "Modelo tipo Plank simplificado/modificado.",
    ashraeRecommendedMethod: "Modelos de cooling/freezing time considerando geometria, h, k, densidade e propriedades do alimento.",
    decision: "document_limitation",
    actionRequired: "Manter, mas exibir limitação técnica e usar fatores conservadores para pallets/blocos.",
    priority: "high",
    notes: "Tempo até núcleo é estimativa e depende fortemente da geometria e do arranjo.",
  },
  {
    area: "equipmentSelection",
    title: "Seleção de equipamento",
    coldProCurrentMethod: "Seleciona por carga requerida e curva real de catálogo.",
    ashraeRecommendedMethod: "Selecionar equipamento no ponto de operação considerando capacidade corrigida.",
    decision: "keep",
    actionRequired: "Manter e exibir ponto de curva, sobra e origem da carga.",
    priority: "medium",
    notes: "Seleção depende da confiabilidade da carga consolidada.",
  },
];

export function compareColdProFormulaWithAshrae(area: string) {
  return ASHRAE_COLDPRO_COMPARISONS.find((item) => item.area === area) ?? null;
}

export function listAshraeColdProComparisons() {
  return ASHRAE_COLDPRO_COMPARISONS;
}

export function getHighPriorityAshraeActions() {
  return ASHRAE_COLDPRO_COMPARISONS.filter((item) => item.priority === "high");
}

export function listAshraeComparisons() {
  return listAshraeColdProComparisons();
}
