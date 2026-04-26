import type { ColdProNormalizedResult } from "./resultNormalizer";

export function buildColdProAIContext(normalizedResult: ColdProNormalizedResult) {
  return {
    summary: normalizedResult.summary,
    loadDistribution: normalizedResult.loadDistribution,
    groupedLoads: normalizedResult.groupedLoads,
    tunnelValidation: normalizedResult.tunnelValidation,
    equipment: normalizedResult.equipment,
    consistencyAudit: normalizedResult.consistencyAudit,
    iceAndDefrost: normalizedResult.iceAndDefrost,
    requiredChecks: [
      "verificar fechamento matemático",
      "verificar maiores cargas",
      "verificar carga de produto/túnel/processo",
      "verificar seleção de equipamentos",
      "verificar sobra técnica",
      "verificar vazão de ar",
      "verificar tempo de congelamento",
      "verificar gelo/degelo",
      "gerar recomendações objetivas",
      "não afirmar ausência de carga de produto se tunnelProcessKcalH > 0",
      "diferenciar produto direto zerado de produto calculado como túnel/processo",
    ],
    interpretationRules: [
      "Use apenas os dados estruturados fornecidos. Não invente valores.",
      "Não afirme que a carga de produto está ausente se houver carga classificada como túnel/processo ou processo especial.",
      "Quando houver divergência de classificação, trate como alerta de classificação, não como erro matemático automático.",
      "Produto direto zerado com túnel/processo maior que zero significa produto calculado como processo especial.",
    ],
  };
}

export function buildColdProAISystemPrompt() {
  return "Você é um especialista em engenharia frigorífica industrial. Use apenas os dados estruturados fornecidos. Não invente valores. Não afirme que a carga de produto está ausente se houver carga classificada como túnel/processo ou processo especial. Quando houver divergência de classificação, trate como alerta de classificação, não como erro matemático automático. Gere análise em 5 seções: conclusão executiva, principais cargas, validação do túnel, seleção de equipamentos, recomendações práticas.";
}
