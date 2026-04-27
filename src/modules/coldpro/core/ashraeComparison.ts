type AshraeComparison = {
  area: string;
  coldProCurrentMethod: string;
  ashraeRecommendedMethod: string;
  decision: string;
  actionRequired: string;
  notes: string;
};

const COMPARISONS: Record<string, AshraeComparison> = {
  transmission: {
    area: "Transmissão",
    coldProCurrentMethod: "U × A × ΔT, com decomposição por faces quando disponível.",
    ashraeRecommendedMethod: "Carga em regime permanente por coeficiente global, área e diferencial de temperatura.",
    decision: "manter",
    actionRequired: "Registrar o método no breakdown e no relatório.",
    notes: "Alinhado à abordagem de cargas de instalações refrigeradas.",
  },
  product: {
    area: "Produto",
    coldProCurrentMethod: "Sensível acima + latente + sensível abaixo do congelamento.",
    ashraeRecommendedMethod: "Energia específica por propriedades térmicas do alimento e mudança de fase.",
    decision: "manter",
    actionRequired: "Exibir energia específica e parcelas sensível/latente/sensível.",
    notes: "A fórmula principal está correta; a governança deve declarar unidades e método.",
  },
  packaging: {
    area: "Embalagem",
    coldProCurrentMethod: "Massa horária predominante.",
    ashraeRecommendedMethod: "Energia por massa e tempo disponível do processo.",
    decision: "ajustar para batelada",
    actionRequired: "Usar massa total da embalagem na batelada quando operationRegime = batch.",
    notes: "Em processo estático/pallet/blast freezer, kg/h só deve ser fallback com aviso.",
  },
  infiltration: {
    area: "Infiltração",
    coldProCurrentMethod: "Método simplificado por trocas/vazão de ar e cálculo técnico sensível/latente quando há umidade.",
    ashraeRecommendedMethod: "Diferença psicrométrica de entalpia para baixa temperatura; método simples aceitável como aproximação.",
    decision: "manter simples e preparar psicrométrico",
    actionRequired: "Registrar fallback quando método psicrométrico for solicitado sem dados suficientes.",
    notes: "Câmaras negativas se beneficiam do método por entalpia por capturar umidade e gelo.",
  },
  airflow: {
    area: "Vazão de ar",
    coldProCurrentMethod: "Q × 3600 / (ρ × Cp × ΔT).",
    ashraeRecommendedMethod: "Balanço térmico sensível coerente para estimativa mínima.",
    decision: "manter",
    actionRequired: "Indicar que é vazão térmica mínima estimada.",
    notes: "Seleção final depende de distribuição de ar, velocidade no produto, geometria e perda de carga.",
  },
  velocity: {
    area: "Velocidade real",
    coldProCurrentMethod: "Vazão dividida pela área livre.",
    ashraeRecommendedMethod: "Coerente com engenharia de escoamento em seção livre.",
    decision: "manter",
    actionRequired: "Validar área livre positiva e limites operacionais por tipo de túnel/produto.",
    notes: "O fator de bloqueio deve ser registrado no breakdown.",
  },
  freezingTime: {
    area: "Tempo até o núcleo",
    coldProCurrentMethod: "Plank simplificado/modificado.",
    ashraeRecommendedMethod: "Modelos de resfriamento/congelamento orientados por propriedades, geometria, h e k.",
    decision: "manter com limitação técnica",
    actionRequired: "Registrar aviso conservador para pallets/blocos e validação em campo.",
    notes: "Carga térmica deve vir do balanço de energia; tempo até núcleo é uma estimativa separada.",
  },
};

export function compareColdProFormulaWithAshrae(area: string): AshraeComparison {
  const key = area.trim().toLowerCase();
  return COMPARISONS[key] ?? {
    area,
    coldProCurrentMethod: "Não registrado.",
    ashraeRecommendedMethod: "Não registrado.",
    decision: "revisar",
    actionRequired: "Mapear método antes de oficializar.",
    notes: "Área ainda não cadastrada na auditoria ASHRAE x ColdPro.",
  };
}

export function listAshraeComparisons(): AshraeComparison[] {
  return Object.values(COMPARISONS);
}