import { safeNumber } from "./units";

const KCAL_TO_KJ = 4.1868;
type ConversionSource = "kJ" | "kcal_converted" | "missing";

function normalizeEnergy(kjValue: unknown, kcalValue: unknown): { value: number; source: ConversionSource } {
  const kj = safeNumber(kjValue, 0);
  if (kj > 0) return { value: kj, source: "kJ" };

  const kcal = safeNumber(kcalValue, 0);
  if (kcal > 0) return { value: kcal * KCAL_TO_KJ, source: "kcal_converted" };

  return { value: 0, source: "missing" };
}

export function normalizeThermalProperties(input: any) {
  const cpAbove = normalizeEnergy(input?.specific_heat_above_kj_kg_k, input?.specific_heat_above_kcal_kg_c);
  const cpBelow = normalizeEnergy(input?.specific_heat_below_kj_kg_k, input?.specific_heat_below_kcal_kg_c);
  const latentHeat = normalizeEnergy(input?.latent_heat_kj_kg, input?.latent_heat_kcal_kg);

  return {
    cpAboveKJkgK: cpAbove.value,
    cpBelowKJkgK: cpBelow.value,
    latentHeatKJkg: latentHeat.value,
    conversionSources: {
      cpAboveKJkgK: cpAbove.source,
      cpBelowKJkgK: cpBelow.source,
      latentHeatKJkg: latentHeat.source,
    },
  };
}
