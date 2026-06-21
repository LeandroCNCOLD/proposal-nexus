/**
 * MELHORIA 5.1 — Recomendação com IA Real (LLM)
 *
 * Usa a API da OpenAI para gerar argumento de vendas persuasivo e técnico
 * baseado nos dados reais do cálculo de carga térmica.
 */

export interface AIRecommendationInput {
  applicationType: string;
  totalLoadKW: number;
  totalLoadTR: number;
  loadBreakdown: {
    transmissionPercent: number;
    productPercent: number;
    infiltrationPercent: number;
    internalPercent: number;
    advancedProcessPercent?: number;
  };
  recommendedEquipment: {
    name: string;
    capacityKW: number;
    marginPercent: number;
    cop: number;
  };
  energySimulation: {
    monthlyKwh: number;
    monthlyCostBRL: number;
    annualCostBRL: number;
  };
  internalTempC: number;
  mainProduct?: string | null;
  productionCapacity?: string | null;
  energyCostBRL_kWh?: number;
  language?: "pt-BR" | "en-US";
}

export interface AIRecommendationResult {
  commercialArgument: string;
  highlights: string[];
  paybackMonths?: number | null;
  technicalAlerts: string[];
  improvementSuggestions: string[];
  source: "ai" | "rules_fallback";
  model?: string;
}

function buildPrompt(input: AIRecommendationInput): string {
  const appTypeLabel: Record<string, string> = {
    cold_room: "câmara de resfriamento",
    freezer_room: "câmara de congelamento",
    climatized_room: "sala climatizada",
    seed_storage: "câmara de armazenamento de sementes",
    cooling_tunnel: "túnel de resfriamento/congelamento",
    blast_freezer: "blast freezer (câmara de congelamento rápido)",
  };
  const appLabel = appTypeLabel[input.applicationType] ?? input.applicationType;

  return `Você é um especialista em refrigeração industrial e vendas técnicas de equipamentos para câmaras frias.

Analise os dados abaixo de um projeto de ${appLabel} e gere:
1. Um argumento comercial persuasivo (2-3 parágrafos) focado no ROI e payback do equipamento
2. 3-5 pontos de destaque técnico para incluir na proposta comercial
3. 2-3 alertas técnicos relevantes para o projeto
4. 2-3 sugestões de melhoria do projeto

DADOS DO PROJETO:
- Tipo: ${appLabel} | Temperatura interna: ${input.internalTempC}°C
- Produto: ${input.mainProduct ?? "não informado"} | Capacidade: ${input.productionCapacity ?? "não informada"}

CARGA TÉRMICA:
- Total: ${input.totalLoadKW.toFixed(1)} kW (${input.totalLoadTR.toFixed(1)} TR)
- Transmissão: ${input.loadBreakdown.transmissionPercent.toFixed(1)}% | Produto: ${input.loadBreakdown.productPercent.toFixed(1)}%
- Infiltração: ${input.loadBreakdown.infiltrationPercent.toFixed(1)}% | Internas: ${input.loadBreakdown.internalPercent.toFixed(1)}%

EQUIPAMENTO: ${input.recommendedEquipment.name} — ${input.recommendedEquipment.capacityKW.toFixed(1)} kW | Margem: ${input.recommendedEquipment.marginPercent.toFixed(1)}% | COP: ${input.recommendedEquipment.cop.toFixed(2)}

ENERGIA: ${input.energySimulation.monthlyKwh.toLocaleString("pt-BR")} kWh/mês | R$ ${input.energySimulation.monthlyCostBRL.toLocaleString("pt-BR")}/mês | R$ ${input.energySimulation.annualCostBRL.toLocaleString("pt-BR")}/ano

Responda em JSON:
{"commercialArgument":"...","highlights":["..."],"technicalAlerts":["..."],"improvementSuggestions":["..."],"paybackMonths":null}`;
}

function rulesFallback(input: AIRecommendationInput): AIRecommendationResult {
  const { totalLoadKW, totalLoadTR, recommendedEquipment, energySimulation } = input;
  return {
    commercialArgument: `Este projeto requer ${totalLoadKW.toFixed(1)} kW (${totalLoadTR.toFixed(1)} TR) de capacidade de refrigeração. O equipamento ${recommendedEquipment.name} foi selecionado com ${recommendedEquipment.marginPercent.toFixed(1)}% de margem técnica, garantindo operação estável mesmo em condições de pico. O custo operacional estimado é de R$ ${energySimulation.monthlyCostBRL.toLocaleString("pt-BR")}/mês.`,
    highlights: [
      `Carga térmica calculada: ${totalLoadKW.toFixed(1)} kW (${totalLoadTR.toFixed(1)} TR)`,
      `Equipamento: ${recommendedEquipment.name} com ${recommendedEquipment.marginPercent.toFixed(1)}% de margem`,
      `Custo operacional: R$ ${energySimulation.monthlyCostBRL.toLocaleString("pt-BR")}/mês`,
      `COP do sistema: ${recommendedEquipment.cop.toFixed(2)}`,
    ],
    technicalAlerts: [],
    improvementSuggestions: [
      input.loadBreakdown.infiltrationPercent > 25 ? "Infiltração elevada — considere cortinas de ar ou porta rápida" : "Manter boas práticas de vedação",
      input.loadBreakdown.transmissionPercent > 30 ? "Transmissão elevada — revisar espessura do isolamento" : "Isolamento adequado para a aplicação",
    ],
    source: "rules_fallback",
  };
}

export async function generateAIRecommendation(
  input: AIRecommendationInput,
  apiKey?: string,
): Promise<AIRecommendationResult> {
  if (!apiKey) return rulesFallback(input);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Especialista em refrigeração industrial. Responda sempre em JSON válido." },
          { role: "user", content: buildPrompt(input) },
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return rulesFallback(input);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return rulesFallback(input);

    const parsed = JSON.parse(content);
    return {
      commercialArgument: String(parsed.commercialArgument ?? ""),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
      paybackMonths: typeof parsed.paybackMonths === "number" ? parsed.paybackMonths : null,
      technicalAlerts: Array.isArray(parsed.technicalAlerts) ? parsed.technicalAlerts.map(String) : [],
      improvementSuggestions: Array.isArray(parsed.improvementSuggestions) ? parsed.improvementSuggestions.map(String) : [],
      source: "ai",
      model: data.model,
    };
  } catch {
    return rulesFallback(input);
  }
}

export function calculatePayback(params: {
  additionalInvestmentBRL: number;
  currentMonthlyCostBRL: number;
  efficientMonthlyCostBRL: number;
}): { paybackMonths: number; savingPerMonth: number; savingPerYear: number } | null {
  const { additionalInvestmentBRL, currentMonthlyCostBRL, efficientMonthlyCostBRL } = params;
  const savingPerMonth = currentMonthlyCostBRL - efficientMonthlyCostBRL;
  if (savingPerMonth <= 0 || additionalInvestmentBRL <= 0) return null;
  return {
    paybackMonths: Math.ceil(additionalInvestmentBRL / savingPerMonth),
    savingPerMonth: Math.round(savingPerMonth * 100) / 100,
    savingPerYear: Math.round(savingPerMonth * 12 * 100) / 100,
  };
}
