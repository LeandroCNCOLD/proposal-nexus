import { safeNumber } from "../core/units";

export type EquipmentTechnicalRisk = "low" | "medium" | "high";

export type ColdProOptimizationEquipment = {
  id?: string | number | null;
  model?: string | null;
  name?: string | null;
  capacityKW?: number | null;
  capacity_kw?: number | null;
  capacityKcalH?: number | null;
  capacity_kcal_h?: number | null;
  cop?: number | null;
  powerKW?: number | null;
  power_kw?: number | null;
  monthlyCost?: number | null;
  monthly_cost?: number | null;
  risk?: EquipmentTechnicalRisk | string | null;
  technicalRisk?: EquipmentTechnicalRisk | string | null;
  [key: string]: unknown;
};

export type EquipmentOptimizerInput = {
  requiredCoolingKW?: number | null;
  equipmentList?: ColdProOptimizationEquipment[] | null;
  copData?: {
    cop?: number | null;
    realCOP?: number | null;
    copReal?: number | null;
    electricalPowerKW?: number | null;
    warnings?: string[];
    [key: string]: unknown;
  } | null;
  energySimulation?: {
    electricalPowerKW?: number | null;
    kWhMonth?: number | null;
    monthlyCost?: number | null;
    warnings?: string[];
    assumptions?: Record<string, unknown>;
    [key: string]: unknown;
  } | null;
};

export type EquipmentRankingItem = {
  equipment: ColdProOptimizationEquipment;
  equipmentId: string | number | null;
  equipmentName: string;
  capacityKW: number;
  requiredCoolingKW: number;
  capacityMarginPercent: number;
  meetsRequiredLoad: boolean;
  isExtremelyOversized: boolean;
  cop: number;
  estimatedElectricalPowerKW: number;
  estimatedKWhMonth: number;
  estimatedMonthlyCost: number;
  technicalRisk: EquipmentTechnicalRisk;
  scores: {
    energyEfficiency: number;
    monthlyCost: number;
    capacityFit: number;
    technicalRisk: number;
    final: number;
  };
  technicalJustification: string;
  warnings: string[];
};

export type EquipmentOptimizerResult = {
  bestEquipment: EquipmentRankingItem | null;
  ranking: EquipmentRankingItem[];
  technicalJustification: string;
  warnings: string[];
  assumptions: Record<string, unknown>;
};

const KW_PER_KCAL_H = 1 / 859.845;
const DEFAULT_COP = 1;

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = safeNumber(value, fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown): number {
  const parsed = finiteNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function normalizeRisk(value: unknown, marginPercent: number): EquipmentTechnicalRisk {
  const risk = String(value ?? "").toLowerCase().trim();
  if (risk === "low" || risk === "medium" || risk === "high") return risk;
  if (marginPercent < 0 || marginPercent > 45) return "high";
  if (marginPercent < 5 || marginPercent > 30) return "medium";
  return "low";
}

function riskScore(risk: EquipmentTechnicalRisk): number {
  if (risk === "low") return 100;
  if (risk === "medium") return 60;
  return 20;
}

function riskPenalty(risk: EquipmentTechnicalRisk): number {
  if (risk === "low") return 0;
  if (risk === "medium") return 8;
  return 20;
}

function equipmentCapacityKW(equipment: ColdProOptimizationEquipment): number {
  return positiveNumber(equipment.capacityKW ?? equipment.capacity_kw) || positiveNumber(equipment.capacityKcalH ?? equipment.capacity_kcal_h) * KW_PER_KCAL_H;
}

function equipmentName(equipment: ColdProOptimizationEquipment): string {
  return String(equipment.model ?? equipment.name ?? equipment.id ?? "Equipamento sem identificação");
}

function capacityFitScore(marginPercent: number, meetsRequiredLoad: boolean): number {
  if (!meetsRequiredLoad) return 0;
  if (marginPercent >= 10 && marginPercent <= 20) return 100;
  if (marginPercent >= 5 && marginPercent < 10) return 85;
  if (marginPercent > 20 && marginPercent <= 30) return 80;
  if (marginPercent >= 0 && marginPercent < 5) return 65;
  if (marginPercent > 30 && marginPercent <= 45) return 45;
  return 15;
}

export function optimizeColdProEquipment(input: EquipmentOptimizerInput): EquipmentOptimizerResult {
  const requiredCoolingKW = positiveNumber(input?.requiredCoolingKW);
  const equipmentList = Array.isArray(input?.equipmentList) ? input.equipmentList : [];
  const baseCOP = positiveNumber(input?.copData?.cop ?? input?.copData?.realCOP ?? input?.copData?.copReal) || DEFAULT_COP;
  const baseElectricalPowerKW = positiveNumber(input?.energySimulation?.electricalPowerKW ?? input?.copData?.electricalPowerKW);
  const baseKWhMonth = positiveNumber(input?.energySimulation?.kWhMonth);
  const baseMonthlyCost = positiveNumber(input?.energySimulation?.monthlyCost);
  const hoursMonth = baseElectricalPowerKW > 0 && baseKWhMonth > 0 ? baseKWhMonth / baseElectricalPowerKW : 176;
  const energyTariff = baseKWhMonth > 0 && baseMonthlyCost > 0 ? baseMonthlyCost / baseKWhMonth : positiveNumber(input?.energySimulation?.assumptions?.energyCostPerKWh) || 0.95;
  const warnings = Array.from(new Set([
    ...(Array.isArray(input?.copData?.warnings) ? input.copData.warnings : []),
    ...(Array.isArray(input?.energySimulation?.warnings) ? input.energySimulation.warnings : []),
  ].map(String)));

  if (requiredCoolingKW <= 0) warnings.push("Carga térmica requerida ausente ou inválida; otimização retornará sem recomendação confiável.");
  if (equipmentList.length === 0) warnings.push("Lista de equipamentos vazia; não há opções para otimizar.");
  if (baseCOP <= 0) warnings.push("COP ausente ou inválido; foi aplicada premissa conservadora para ranqueamento.");

  const candidates = equipmentList.map((equipment): EquipmentRankingItem => {
    const capacityKW = equipmentCapacityKW(equipment);
    const marginPercent = requiredCoolingKW > 0 ? ((capacityKW - requiredCoolingKW) / requiredCoolingKW) * 100 : 0;
    const meetsRequiredLoad = requiredCoolingKW > 0 && capacityKW >= requiredCoolingKW;
    const isExtremelyOversized = marginPercent > 45;
    const cop = positiveNumber(equipment.cop) || baseCOP;
    const explicitPowerKW = positiveNumber(equipment.powerKW ?? equipment.power_kw);
    const explicitMonthlyCost = positiveNumber(equipment.monthlyCost ?? equipment.monthly_cost);
    const estimatedElectricalPowerKW = explicitPowerKW || (cop > 0 ? requiredCoolingKW / cop : 0);
    const estimatedKWhMonth = estimatedElectricalPowerKW * hoursMonth;
    const estimatedMonthlyCost = explicitMonthlyCost || estimatedKWhMonth * energyTariff;
    const technicalRisk = normalizeRisk(equipment.technicalRisk ?? equipment.risk, marginPercent);
    const itemWarnings: string[] = [];

    if (capacityKW <= 0) itemWarnings.push("Capacidade do equipamento ausente ou inválida.");
    if (!meetsRequiredLoad) itemWarnings.push("Equipamento não atende à carga térmica requerida.");
    if (isExtremelyOversized) itemWarnings.push("Equipamento extremamente superdimensionado; revisar aplicação.");
    if (cop <= 0) itemWarnings.push("COP do equipamento ausente; custo operacional estimado com premissa conservadora.");

    return {
      equipment,
      equipmentId: equipment.id ?? null,
      equipmentName: equipmentName(equipment),
      capacityKW: round(capacityKW),
      requiredCoolingKW: round(requiredCoolingKW),
      capacityMarginPercent: round(marginPercent, 2),
      meetsRequiredLoad,
      isExtremelyOversized,
      cop: round(cop, 4),
      estimatedElectricalPowerKW: round(estimatedElectricalPowerKW),
      estimatedKWhMonth: round(estimatedKWhMonth),
      estimatedMonthlyCost: round(estimatedMonthlyCost, 2),
      technicalRisk,
      scores: {
        energyEfficiency: 0,
        monthlyCost: 0,
        capacityFit: capacityFitScore(marginPercent, meetsRequiredLoad),
        technicalRisk: riskScore(technicalRisk),
        final: 0,
      },
      technicalJustification: "",
      warnings: itemWarnings,
    };
  });

  const eligible = candidates.filter((item) => item.meetsRequiredLoad && !item.isExtremelyOversized);
  const scoringPool = eligible.length > 0 ? eligible : candidates;
  const maxCOP = Math.max(...scoringPool.map((item) => item.cop), 0);
  const minCost = Math.min(...scoringPool.map((item) => item.estimatedMonthlyCost).filter((value) => value > 0), Number.POSITIVE_INFINITY);

  const ranking = candidates.map((item) => {
    const energyEfficiency = maxCOP > 0 ? clamp((item.cop / maxCOP) * 100) : 0;
    const monthlyCost = Number.isFinite(minCost) && item.estimatedMonthlyCost > 0 ? clamp((minCost / item.estimatedMonthlyCost) * 100) : 0;
    const final = clamp(
      energyEfficiency * 0.4 +
        monthlyCost * 0.3 +
        item.scores.capacityFit * 0.2 +
        item.scores.technicalRisk * 0.1 -
        (!item.meetsRequiredLoad ? 35 : 0) -
        (item.isExtremelyOversized ? 25 : 0) -
        riskPenalty(item.technicalRisk),
    );

    return {
      ...item,
      scores: {
        ...item.scores,
        energyEfficiency: round(energyEfficiency, 2),
        monthlyCost: round(monthlyCost, 2),
        final: round(final, 2),
      },
      technicalJustification: `${item.equipmentName}: capacidade ${item.capacityKW} kW para necessidade ${item.requiredCoolingKW} kW, margem ${item.capacityMarginPercent}%, COP ${item.cop}, custo mensal estimado R$ ${item.estimatedMonthlyCost}. Risco técnico ${item.technicalRisk}.`,
    };
  }).sort((a, b) => b.scores.final - a.scores.final || a.estimatedMonthlyCost - b.estimatedMonthlyCost);

  const bestEquipment = ranking.find((item) => item.meetsRequiredLoad && !item.isExtremelyOversized) ?? ranking[0] ?? null;
  if (!bestEquipment?.meetsRequiredLoad) warnings.push("Nenhum equipamento atende integralmente à carga térmica requerida.");
  if (bestEquipment?.isExtremelyOversized) warnings.push("A melhor opção disponível ainda está extremamente superdimensionada.");

  return {
    bestEquipment,
    ranking,
    technicalJustification: bestEquipment
      ? `Equipamento recomendado: ${bestEquipment.equipmentName}. Atende a carga requerida, evita superdimensionamento extremo e apresenta o melhor equilíbrio entre COP, custo mensal, margem de capacidade e risco técnico.`
      : "Não foi possível recomendar equipamento por ausência de carga válida ou lista de equipamentos.",
    warnings: Array.from(new Set(warnings)),
    assumptions: {
      scoreWeights: {
        energyEfficiency: 0.4,
        monthlyCost: 0.3,
        capacityFit: 0.2,
        technicalRisk: 0.1,
      },
      idealCapacityMarginPercent: "10% a 20%",
      extremeOversizingThresholdPercent: 45,
      hoursMonth: round(hoursMonth),
      energyTariff: round(energyTariff, 4),
      baseCOP: round(baseCOP, 4),
      doesNotRecalculateCoolingLoad: true,
    },
  };
}
