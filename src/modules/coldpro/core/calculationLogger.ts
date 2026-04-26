export function buildCalculationLog(input: {
  originalInputs: unknown;
  normalizedInputs: unknown;
  unitConversions?: unknown;
  estimatedData?: unknown;
  missingFields: string[];
  warnings: string[];
  formulas: Record<string, string>;
  finalResult: unknown;
}) {
  return {
    originalInputs: input.originalInputs,
    normalizedInputs: input.normalizedInputs,
    unitConversions: input.unitConversions ?? {},
    estimatedData: input.estimatedData ?? {},
    missingFields: input.missingFields,
    warnings: input.warnings,
    formulasApplied: input.formulas,
    finalResult: input.finalResult,
    generatedAt: new Date().toISOString(),
  };
}
