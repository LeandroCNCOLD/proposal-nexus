export type ColdProLoadBreakdownInput = {
  productLoadKW?: number | null;
  productKW?: number | null;
  transmissionLoadKW?: number | null;
  transmissionKW?: number | null;
  infiltrationLoadKW?: number | null;
  infiltrationKW?: number | null;
  internalLoadKW?: number | null;
  internalKW?: number | null;
  [key: string]: unknown;
};

export type ColdProEnergyRecommendationInput = {
  cop?: number | null;
  electricalPowerKW?: number | null;
  kWhMonth?: number | null;
  monthlyCost?: number | null;
  costPerKg?: number | null;
  warnings?: string[] | null;
  [key: string]: unknown;
};

export type ColdProEquipmentRecommendationInput = {
  bestEquipment?: {
    equipmentName?: string | null;
    model?: string | null;
    name?: string | null;
    capacityMarginPercent?: number | null;
    estimatedMonthlyCost?: number | null;
    meetsRequiredLoad?: boolean | null;
    isExtremelyOversized?: boolean | null;
    warnings?: string[] | null;
    scores?: { final?: number | null; [key: string]: unknown } | null;
    [key: string]: unknown;
  } | null;
  ranking?: Array<Record<string, unknown>> | null;
  warnings?: string[] | null;
  technicalJustification?: string | null;
  [key: string]: unknown;
};

export type ProjectRecommendationBuilderInput = {
  totalCoolingLoadKW?: number | null;
  totalKW?: number | null;
  requiredCoolingKW?: number | null;
  loadBreakdown?: ColdProLoadBreakdownInput | null;
  cop?: number | null;
  energySimulation?: ColdProEnergyRecommendationInput | null;
  equipmentOptimization?: ColdProEquipmentRecommendationInput | null;
  technicalWarnings?: string[] | null;
  warnings?: string[] | null;
  [key: string]: unknown;
};

export type ProjectRecommendation = {
  technicalSummary: string[];
  recommendedEquipment: string[];
  energySummary: string[];
  risks: string[];
  improvements: string[];
  commercialArgument: string[];
  warnings: string[];
};

type LoadCategory = "produto" | "infiltração" | "transmissão" | "internas";

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

function formatNumber(value: unknown, decimals = 2): string {
  const parsed = finiteNumber(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(parsed);
}

function formatCurrency(value: unknown): string {
  const parsed = finiteNumber(value);
  return parsed === null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed);
}

function uniqueText(items: Array<string | null | undefined>): string[] {
  return Array.from(new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function equipmentName(equipment: NonNullable<ColdProEquipmentRecommendationInput["bestEquipment"]> | null | undefined): string | null {
  const name = equipment?.equipmentName ?? equipment?.model ?? equipment?.name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function dominantLoad(loads: Record<LoadCategory, number | null>, totalKW: number | null): { category: LoadCategory | null; value: number | null; percent: number | null } {
  const entries = Object.entries(loads) as Array<[LoadCategory, number | null]>;
  const valid = entries.filter(([, value]) => value !== null && value > 0);
  if (!valid.length) return { category: null, value: null, percent: null };
  const [category, value] = valid.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  const percent = totalKW && totalKW > 0 ? ((value ?? 0) / totalKW) * 100 : null;
  return { category, value, percent };
}

export function buildColdProProjectRecommendation(input: ProjectRecommendationBuilderInput): ProjectRecommendation {
  const warnings: string[] = [];
  const energy = input?.energySimulation ?? {};
  const optimization = input?.equipmentOptimization ?? {};
  const bestEquipment = optimization?.bestEquipment ?? null;
  const loadBreakdown = input?.loadBreakdown ?? {};

  const totalKW = positiveNumber(input?.totalCoolingLoadKW, input?.totalKW, input?.requiredCoolingKW);
  const productKW = positiveNumber(loadBreakdown?.productLoadKW, loadBreakdown?.productKW);
  const infiltrationKW = positiveNumber(loadBreakdown?.infiltrationLoadKW, loadBreakdown?.infiltrationKW);
  const transmissionKW = positiveNumber(loadBreakdown?.transmissionLoadKW, loadBreakdown?.transmissionKW);
  const internalKW = positiveNumber(loadBreakdown?.internalLoadKW, loadBreakdown?.internalKW);
  const cop = positiveNumber(input?.cop, energy?.cop);
  const electricalPowerKW = positiveNumber(energy?.electricalPowerKW);
  const kWhMonth = positiveNumber(energy?.kWhMonth);
  const monthlyCost = positiveNumber(energy?.monthlyCost);
  const costPerKg = finiteNumber(energy?.costPerKg);
  const bestName = equipmentName(bestEquipment);
  const marginPercent = finiteNumber(bestEquipment?.capacityMarginPercent);
  const scoreFinal = finiteNumber(bestEquipment?.scores?.final);
  const dominant = dominantLoad({ produto: productKW, infiltração: infiltrationKW, transmissão: transmissionKW, internas: internalKW }, totalKW);

  if (totalKW === null) warnings.push("Carga térmica total ausente; recomendação gerada sem validação quantitativa da carga.");
  if (dominant.category === null) warnings.push("Breakdown de cargas ausente ou incompleto; não foi possível identificar a carga dominante.");
  if (cop === null) warnings.push("COP ausente; recomendação energética gerada sem avaliação de eficiência.");
  if (kWhMonth === null || monthlyCost === null) warnings.push("Simulação energética ausente ou incompleta; custos operacionais podem não estar disponíveis.");
  if (!bestName) warnings.push("Equipamento recomendado ausente; recomendação comercial gerada sem modelo definido.");

  const technicalSummary = uniqueText([
    totalKW !== null ? `Carga térmica total calculada de ${formatNumber(totalKW, 2)} kW, interpretada sem recálculo de carga.` : "Carga térmica total não disponível para resumo técnico.",
    dominant.category && dominant.value !== null ? `A carga dominante é ${dominant.category}, com ${formatNumber(dominant.value, 2)} kW${dominant.percent !== null ? ` (${formatNumber(dominant.percent, 1)}% do total)` : ""}.` : null,
    productKW !== null && infiltrationKW !== null ? `Produto e infiltração representam pontos críticos de dimensionamento: ${formatNumber(productKW, 2)} kW em produto e ${formatNumber(infiltrationKW, 2)} kW em infiltração.` : null,
  ]);

  const recommendedEquipment = uniqueText([
    bestName ? `Equipamento recomendado: ${bestName}.` : "Nenhum equipamento recomendado disponível nos dados recebidos.",
    bestEquipment?.meetsRequiredLoad === true ? "O equipamento recomendado atende à carga térmica requerida." : bestEquipment?.meetsRequiredLoad === false ? "O equipamento recomendado não atende integralmente à carga térmica requerida." : null,
    marginPercent !== null ? `Margem de capacidade informada: ${formatNumber(marginPercent, 2)}%.` : "Margem de capacidade não informada.",
    scoreFinal !== null ? `Score final de otimização: ${formatNumber(scoreFinal, 2)}.` : null,
    typeof optimization?.technicalJustification === "string" ? optimization.technicalJustification : null,
  ]);

  const energySummary = uniqueText([
    cop !== null ? `COP considerado: ${formatNumber(cop, 2)}.` : "COP não disponível nos dados recebidos.",
    electricalPowerKW !== null ? `Potência elétrica estimada já calculada: ${formatNumber(electricalPowerKW, 2)} kW.` : null,
    kWhMonth !== null ? `Consumo mensal estimado: ${formatNumber(kWhMonth, 0)} kWh/mês.` : null,
    monthlyCost !== null ? `Custo operacional mensal estimado: ${formatCurrency(monthlyCost)}.` : null,
    costPerKg !== null ? `Custo energético específico: ${formatCurrency(costPerKg)}/kg.` : null,
    cop !== null && cop < 1.8 ? "COP abaixo do desejável para operação eficiente; avaliar alternativas com melhor rendimento." : cop !== null && cop <= 2.4 ? "COP compatível com aplicação de congelamento, com oportunidade de ganho em equipamentos mais eficientes." : cop !== null ? "COP favorável para reduzir custo operacional, desde que validado pela curva do equipamento." : null,
  ]);

  const risks = uniqueText([
    totalKW !== null && totalKW <= 0 ? "Carga térmica total inválida ou zerada." : null,
    cop !== null && cop <= 0 ? "COP inválido ou zerado." : null,
    bestEquipment?.meetsRequiredLoad === false ? "Risco de subdimensionamento do equipamento recomendado." : null,
    bestEquipment?.isExtremelyOversized === true ? "Risco de superdimensionamento extremo, com maior investimento e possível perda de eficiência operacional." : null,
    marginPercent !== null && marginPercent < 0 ? "Margem negativa indica equipamento abaixo da necessidade térmica." : null,
    marginPercent !== null && marginPercent > 45 ? "Margem acima de 45% indica superdimensionamento relevante." : null,
    infiltrationKW !== null && totalKW !== null && infiltrationKW / totalKW > 0.25 ? "Infiltração representa parcela elevada da carga e pode aumentar consumo e instabilidade térmica." : null,
    ...((Array.isArray(input?.technicalWarnings) ? input.technicalWarnings : []) as string[]),
    ...((Array.isArray(input?.warnings) ? input.warnings : []) as string[]),
    ...((Array.isArray(energy?.warnings) ? energy.warnings : []) as string[]),
    ...((Array.isArray(optimization?.warnings) ? optimization.warnings : []) as string[]),
    ...((Array.isArray(bestEquipment?.warnings) ? bestEquipment.warnings : []) as string[]),
  ]);

  const improvements = uniqueText([
    infiltrationKW !== null && totalKW !== null && infiltrationKW / totalKW > 0.2 ? "Reduzir infiltração com melhor vedação, controle de abertura de portas e cortinas de ar." : "Manter boas práticas de vedação e controle de abertura para preservar a carga calculada.",
    transmissionKW !== null && totalKW !== null && transmissionKW / totalKW > 0.2 ? "Revisar isolamento, pontes térmicas e fechamento construtivo para reduzir carga de transmissão." : null,
    internalKW !== null && totalKW !== null && internalKW / totalKW > 0.15 ? "Revisar cargas internas de motores, iluminação, ventiladores e degelo para reduzir calor dissipado." : null,
    cop !== null && cop < 2.2 ? "Avaliar equipamento com COP superior para reduzir potência elétrica e custo mensal." : null,
    bestEquipment?.isExtremelyOversized === true ? "Otimizar seleção para reduzir superdimensionamento sem comprometer segurança operacional." : null,
    monthlyCost !== null ? "Usar o custo operacional mensal como argumento para comparar alternativas de maior eficiência." : null,
  ]);

  const commercialArgument = uniqueText([
    totalKW !== null ? `A solução parte de uma carga térmica calculada de ${formatNumber(totalKW, 2)} kW, dando base técnica objetiva para a proposta.` : null,
    bestName ? `A recomendação do equipamento ${bestName} facilita a decisão por equilibrar capacidade, eficiência e risco técnico.` : null,
    monthlyCost !== null ? `O custo mensal estimado de ${formatCurrency(monthlyCost)} permite demonstrar impacto operacional e retorno de alternativas mais eficientes.` : null,
    dominant.category ? `Como ${dominant.category} domina a carga, as melhorias propostas atacam diretamente o principal fator de consumo.` : null,
    "A recomendação organiza os riscos e oportunidades de economia sem alterar os cálculos originais do ColdPro.",
  ]);

  return {
    technicalSummary,
    recommendedEquipment,
    energySummary,
    risks,
    improvements,
    commercialArgument,
    warnings: uniqueText(warnings),
  };
}
