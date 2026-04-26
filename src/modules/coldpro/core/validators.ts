import { safeNumber } from "./units";

function isProvided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function validateRange(params: {
  field: string;
  value: unknown;
  min: number;
  max: number;
  unit: string;
  warnings: string[];
  invalidFields: string[];
}) {
  if (!isProvided(params.value)) return;
  const value = safeNumber(params.value, Number.NaN);
  if (!Number.isFinite(value)) {
    params.invalidFields.push(params.field);
    params.warnings.push(`${params.field} não é numérico.`);
    return;
  }
  if (value < params.min || value > params.max) {
    params.invalidFields.push(params.field);
    params.warnings.push(`${params.field} fora da faixa técnica ${params.min} a ${params.max} ${params.unit}.`);
  }
}

export function validateTunnelInput(input: any): { missingFields: string[]; warnings: string[]; invalidFields: string[] } {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const invalidFields: string[] = [];

  validateRange({ field: "cpAboveKJkgK", value: input?.cpAboveKJkgK, min: 0.5, max: 5, unit: "kJ/kg.K", warnings, invalidFields });
  validateRange({ field: "cpBelowKJkgK", value: input?.cpBelowKJkgK, min: 0.5, max: 5, unit: "kJ/kg.K", warnings, invalidFields });
  validateRange({ field: "latentHeatKJkg", value: input?.latentHeatKJkg, min: 50, max: 450, unit: "kJ/kg", warnings, invalidFields });
  validateRange({ field: "densityKgM3", value: input?.densityKgM3, min: 100, max: 1800, unit: "kg/m³", warnings, invalidFields });
  validateRange({ field: "frozenWaterFraction", value: input?.frozenWaterFraction, min: 0, max: 1, unit: "", warnings, invalidFields });
  validateRange({ field: "frozenConductivityWMK", value: input?.frozenConductivityWMK, min: 0.02, max: 3, unit: "W/m.K", warnings, invalidFields });

  const manualCoefficient = safeNumber(input?.manualCoefficientWM2K ?? input?.manualConvectiveCoefficientWM2K, 0);
  if (manualCoefficient <= 0) {
    validateRange({ field: "airVelocityMS", value: input?.airVelocityMS, min: 0.1, max: 15, unit: "m/s", warnings, invalidFields });
  }

  return {
    missingFields: Array.from(new Set(missingFields)),
    warnings: Array.from(new Set(warnings)),
    invalidFields: Array.from(new Set(invalidFields)),
  };
}
