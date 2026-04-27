import { normalizeColdProResult } from "./resultNormalizer";

export type ColdProEnvironmentResultInput = {
  environment?: any | null;
  result?: any | null;
  selection?: any | null;
  products?: any[];
  advancedProcesses?: any[];
};

export function normalizeColdProEnvironmentResult({
  environment,
  result,
  selection,
  products = [],
  advancedProcesses = [],
}: ColdProEnvironmentResultInput) {
  const scopedProducts = (products ?? []).filter((item: any) => !environment?.id || item.environment_id === environment.id);
  const scopedAdvancedProcesses = (advancedProcesses ?? []).filter((item: any) => !environment?.id || item.environment_id === environment.id);
  const normalized = normalizeColdProResult(result, selection, environment, scopedProducts);
  const technicalAlerts = Array.from(new Set([
    ...(Array.isArray(result?.calculation_warnings) ? result.calculation_warnings : []),
    ...(Array.isArray(result?.calculation_breakdown?.validation_alerts) ? result.calculation_breakdown.validation_alerts.map((item: any) => item?.message ?? item) : []),
    ...(Array.isArray(normalized.tunnelValidation.warnings) ? normalized.tunnelValidation.warnings : []),
    ...(Array.isArray(normalized.calculationMethodSummary.warnings) ? normalized.calculationMethodSummary.warnings : []),
  ].filter(Boolean).map(String)));

  return {
    scope: "environment" as const,
    environment: environment
      ? {
          id: environment.id,
          name: environment.name,
          type: environment.environment_type,
          volumeM3: Number(environment.volume_m3 ?? 0),
          internalTempC: Number(environment.internal_temp_c ?? 0),
          externalTempC: Number(environment.external_temp_c ?? 0),
        }
      : null,
    products: scopedProducts,
    advancedProcesses: scopedAdvancedProcesses,
    technicalAlerts,
    equipmentSelectionInput: {
      requiredKcalH: normalized.summary.requiredKcalH,
      requiredKW: normalized.summary.requiredKW,
      requiredTR: normalized.summary.requiredTR,
      source: "environment_total_required_load",
    },
    ...normalized,
  };
}

export type ColdProEnvironmentNormalizedResult = ReturnType<typeof normalizeColdProEnvironmentResult>;
