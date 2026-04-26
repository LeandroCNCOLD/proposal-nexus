import type { ColdProNormalizedResult } from "./resultNormalizer";
import type { ColdProEnvironmentNormalizedResult } from "./environmentResultNormalizer";
import type { ColdProProjectConsolidatedResult } from "./projectResultConsolidator";

function baseEnvironmentContext(normalizedResult: ColdProNormalizedResult | ColdProEnvironmentNormalizedResult) {
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

export function buildColdProAIContext(normalizedResult: ColdProNormalizedResult) {
  return baseEnvironmentContext(normalizedResult);
}

export function buildColdProEnvironmentAIContext(normalizedResult: ColdProEnvironmentNormalizedResult) {
  return { scope: "environment", environment: normalizedResult.environment, ...baseEnvironmentContext(normalizedResult) };
}

export function buildColdProProjectAIContext(consolidatedResult: ColdProProjectConsolidatedResult) {
  return {
    scope: "project",
    project: consolidatedResult.project,
    summary: consolidatedResult.summary,
    groupedLoads: consolidatedResult.groupedLoads,
    ranking: consolidatedResult.ranking,
    consistencyAudit: consolidatedResult.consistencyAudit,
    environmentSummaries: consolidatedResult.environmentResults.map((item) => ({
      environment: item.environment,
      summary: item.summary,
      groupedLoads: item.groupedLoads,
      equipment: item.equipment,
      consistencyAudit: item.consistencyAudit,
    })),
    requiredChecks: [
      "verificar totais consolidados do projeto",
      "comparar ambientes por carga requerida",
      "identificar ambientes com divergência crítica",
      "não atribuir carga global a um ambiente individual",
      "preservar a regra produto direto zerado com túnel/processo maior que zero",
    ],
  };
}

export function compactColdProAIQuestion(action: string, instruction: string, scope: "environment" | "project") {
  return `${scope === "environment" ? "ESCOPO_AMBIENTE" : "ESCOPO_PROJETO"} | ${action}: ${instruction}`.slice(0, 1900);
}

export function buildColdProAISystemPrompt() {
  return "Você é um especialista em engenharia frigorífica industrial. Use apenas os dados estruturados fornecidos. Não invente valores. Não afirme que a carga de produto está ausente se houver carga classificada como túnel/processo ou processo especial. Quando houver divergência de classificação, trate como alerta de classificação, não como erro matemático automático. Gere análise em 5 seções: conclusão executiva, principais cargas, validação do túnel, seleção de equipamentos, recomendações práticas.";
}
