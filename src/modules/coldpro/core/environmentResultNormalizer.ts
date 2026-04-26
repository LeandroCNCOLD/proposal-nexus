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
    ...normalized,
  };
}

export type ColdProEnvironmentNormalizedResult = ReturnType<typeof normalizeColdProEnvironmentResult>;
