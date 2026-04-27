export function buildCalculationLog(params: any) {
  return {
    originalInput: params?.originalInput ?? null,
    normalizedInput: params?.normalizedInput ?? null,
    unitConversions: params?.unitConversions ?? {},
    warnings: params?.warnings ?? [],
    missingFields: params?.missingFields ?? [],
    invalidFields: params?.invalidFields ?? [],
    formulasUsed: params?.formulasUsed ?? {},
    resultSummary: params?.resultSummary ?? {},
    methodRegistryVersion: params?.methodRegistryVersion ?? null,
    methodsUsed: params?.methodsUsed ?? [],
  };
}
