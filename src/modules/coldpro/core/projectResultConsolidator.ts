import { normalizeColdProEnvironmentResult, type ColdProEnvironmentNormalizedResult } from "./environmentResultNormalizer";

function sum(items: number[]) {
  return items.reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

export type ColdProProjectConsolidatorInput = {
  project?: any | null;
  environments?: any[];
  results?: any[];
  selections?: any[];
  products?: any[];
  advancedProcesses?: any[];
};

export function consolidateColdProProjectResult({
  project,
  environments = [],
  results = [],
  selections = [],
  products = [],
  advancedProcesses = [],
}: ColdProProjectConsolidatorInput) {
  const environmentResults = environments.map((environment: any) => {
    const result = results.find((item: any) => item.environment_id === environment.id);
    const selection = selections.find((item: any) => item.environment_id === environment.id);
    const scopedProducts = products.filter((item: any) => item.environment_id === environment.id);
    const scopedAdvancedProcesses = advancedProcesses.filter((item: any) => item.environment_id === environment.id);
    return normalizeColdProEnvironmentResult({ environment, result, selection, products: scopedProducts, advancedProcesses: scopedAdvancedProcesses });
  });

  const groupedLoads = {
    transmissionKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.transmissionKcalH))),
    productsAndProcessKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.productsAndProcessKcalH))),
    airAndMoistureKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.airAndMoistureKcalH))),
    internalLoadsKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.internalLoadsKcalH))),
    defrostAndIceKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.defrostAndIceKcalH))),
    safetyKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.safetyKcalH))),
    otherKcalH: round(sum(environmentResults.map((item) => item.groupedLoads.otherKcalH))),
  };

  const summary = {
    requiredKcalH: round(sum(environmentResults.map((item) => item.summary.requiredKcalH))),
    requiredKW: round(sum(environmentResults.map((item) => item.summary.requiredKW))),
    requiredTR: round(sum(environmentResults.map((item) => item.summary.requiredTR))),
    subtotalKcalH: round(sum(environmentResults.map((item) => item.summary.subtotalKcalH))),
    safetyKcalH: round(sum(environmentResults.map((item) => item.summary.safetyKcalH))),
    totalSelectedCapacityKcalH: round(sum(environmentResults.map((item) => item.equipment.totalCapacityKcalH))),
    totalEstimatedPowerKW: round(sum(environmentResults.map((item) => item.equipment.estimatedPowerKW))),
  };

  const equipmentSurplusPercent = summary.requiredKcalH > 0 ? round(((summary.totalSelectedCapacityKcalH - summary.requiredKcalH) / summary.requiredKcalH) * 100, 2) : 0;
  const criticalEnvironments = environmentResults.filter((item) => item.consistencyAudit.hasCriticalDivergence);
  const warnings = environmentResults.flatMap((item) => item.consistencyAudit.warnings.map((warning: string) => `${item.environment?.name ?? "Ambiente"}: ${warning}`));
  const methodSummary = {
    methods: Array.from(new Set(environmentResults.flatMap((item) => item.calculationMethodSummary.methods))),
    limitations: Array.from(new Set(environmentResults.flatMap((item) => item.calculationMethodSummary.limitations))),
    warnings: Array.from(new Set(environmentResults.flatMap((item) => item.calculationMethodSummary.warnings))),
    ashraeComparison: environmentResults[0]?.calculationMethodSummary.ashraeComparison ?? [],
  };

  return {
    scope: "project" as const,
    project: { id: project?.id ?? null, name: project?.name ?? "Projeto", applicationType: project?.application_type ?? null },
    summary: { ...summary, equipmentSurplusPercent, environmentCount: environments.length, calculatedEnvironmentCount: environmentResults.filter((item) => item.summary.requiredKcalH > 0).length },
    groupedLoads,
    environmentResults,
    calculationMethodSummary: methodSummary,
    ranking: [...environmentResults].sort((a, b) => b.summary.requiredKcalH - a.summary.requiredKcalH).map((item, index) => ({
      position: index + 1,
      environmentId: item.environment?.id ?? null,
      name: item.environment?.name ?? "Ambiente",
      requiredKcalH: item.summary.requiredKcalH,
      requiredKW: item.summary.requiredKW,
      requiredTR: item.summary.requiredTR,
      selectedCapacityKcalH: item.equipment.totalCapacityKcalH,
      surplusPercent: item.equipment.surplusPercent,
      hasCriticalDivergence: item.consistencyAudit.hasCriticalDivergence,
    })),
    consistencyAudit: {
      hasCriticalDivergence: criticalEnvironments.length > 0,
      criticalEnvironmentCount: criticalEnvironments.length,
      warnings,
    },
  };
}

export type ColdProProjectConsolidatedResult = ReturnType<typeof consolidateColdProProjectResult>;
export type { ColdProEnvironmentNormalizedResult };
