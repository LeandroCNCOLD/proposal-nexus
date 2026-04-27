import type { ColdProNormalizedResult } from "./resultNormalizer";
import type { ColdProEnvironmentNormalizedResult } from "./environmentResultNormalizer";
import type { ColdProProjectConsolidatedResult } from "./projectResultConsolidator";
import { getHighPriorityAshraeActions } from "./ashraeComparison";

function baseEnvironmentContext(normalizedResult: ColdProNormalizedResult | ColdProEnvironmentNormalizedResult) {
  const distribution = Object.entries(normalizedResult.groupedLoads)
    .map(([key, value]) => ({ key, value: Number(value ?? 0), percent: normalizedResult.summary.requiredKcalH > 0 ? (Number(value ?? 0) / normalizedResult.summary.requiredKcalH) * 100 : 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const largest = distribution[0] ?? null;
  return {
    summary: normalizedResult.summary,
    loadDistribution: normalizedResult.loadDistribution,
    groupedLoads: normalizedResult.groupedLoads,
    tunnelValidation: normalizedResult.tunnelValidation,
    equipment: normalizedResult.equipment,
    consistencyAudit: normalizedResult.consistencyAudit,
    iceAndDefrost: normalizedResult.iceAndDefrost,
    ashraeMethodContext: {
      methodsUsed: normalizedResult.calculationMethodSummary.methods,
      limitations: normalizedResult.calculationMethodSummary.limitations,
      comparisonFindings: normalizedResult.calculationMethodSummary.ashraeComparison,
      highPriorityActions: getHighPriorityAshraeActions(),
    },
    chartSummary: {
      largestComponent: largest,
      distributionByCategory: distribution,
      equipmentSurplusStatus: normalizedResult.equipment.surplusPercent < 0 ? "subdimensionado" : normalizedResult.equipment.surplusPercent < 5 ? "atenção" : normalizedResult.equipment.surplusPercent <= 20 ? "adequado" : normalizedResult.equipment.surplusPercent <= 30 ? "alto" : "possível superdimensionamento",
      warnings: normalizedResult.consistencyAudit.warnings,
    },
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
      "Não diga que uma fórmula oficial está errada; diferencie método simplificado permitido de melhoria recomendada.",
      "Para infiltração simples em baixa temperatura, recomende psicrometria como melhoria, sem invalidar automaticamente.",
      "Para tempo até núcleo, declare que é estimativa dependente de geometria, h efetivo, condutividade e arranjo.",
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
  const groupedDistribution = Object.entries(consolidatedResult.groupedLoads)
    .map(([key, value]) => ({ key, value: Number(value ?? 0), percent: consolidatedResult.summary.requiredKcalH > 0 ? (Number(value ?? 0) / consolidatedResult.summary.requiredKcalH) * 100 : 0 }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
  const dominantEnvironment = consolidatedResult.ranking[0] ?? null;
  return {
    scope: "project",
    project: consolidatedResult.project,
    summary: consolidatedResult.summary,
    groupedLoads: consolidatedResult.groupedLoads,
    ranking: consolidatedResult.ranking,
    consistencyAudit: consolidatedResult.consistencyAudit,
    ashraeMethodContext: {
      methodsUsed: consolidatedResult.calculationMethodSummary.methods,
      limitations: consolidatedResult.calculationMethodSummary.limitations,
      comparisonFindings: consolidatedResult.calculationMethodSummary.ashraeComparison,
      highPriorityActions: getHighPriorityAshraeActions(),
    },
    chartSummary: {
      dominantEnvironment,
      largestGlobalCategory: groupedDistribution[0] ?? null,
      distributionByCategory: groupedDistribution,
      equipmentSurplusStatus: consolidatedResult.summary.equipmentSurplusPercent < 0 ? "subdimensionado" : consolidatedResult.summary.equipmentSurplusPercent < 5 ? "atenção" : consolidatedResult.summary.equipmentSurplusPercent <= 20 ? "adequado" : consolidatedResult.summary.equipmentSurplusPercent <= 30 ? "alto" : "possível superdimensionamento",
      warnings: consolidatedResult.consistencyAudit.warnings,
    },
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
  return "Você é um especialista em engenharia frigorífica industrial. Use apenas os dados estruturados fornecidos. Não invente valores. Não afirme que a carga de produto está ausente se houver carga classificada como túnel/processo ou processo especial. Não diga que uma fórmula oficial do ColdPro está errada; diferencie método simplificado permitido de melhoria recomendada. Para infiltração simples em baixa temperatura, recomende psicrometria como melhoria. Para tempo até núcleo, sempre declare que é estimativa dependente de geometria, h efetivo, condutividade e arranjo; em pallets/blocos recomende validação de campo ou fator conservador. Gere análise em 5 seções: conclusão executiva, principais cargas, validação do túnel, seleção de equipamentos, recomendações práticas.";
}
