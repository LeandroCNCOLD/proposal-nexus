import { KCAL_TO_KJ } from "./constants";
import { safeNumber, roundColdPro } from "./units";
import type { ThermalUnitSource } from "./calculationTypes";

function normalizeEnergy(kj: unknown, kcal: unknown) {
  const kjValue = safeNumber(kj, 0);
  if (kjValue > 0) return { value: roundColdPro(kjValue, 4), source: "kJ" as ThermalUnitSource };
  const kcalValue = safeNumber(kcal, 0);
  if (kcalValue > 0) return { value: roundColdPro(kcalValue * KCAL_TO_KJ, 4), source: "kcal_converted" as ThermalUnitSource };
  return { value: 0, source: "missing" as ThermalUnitSource };
}

export function normalizeThermalProperties(input: Record<string, unknown>) {
  const cpAbove = normalizeEnergy(input.specific_heat_above_kj_kg_k ?? input.cpAboveKJkgK, input.specific_heat_above_kcal_kg_c ?? input.cpAboveKcalKgC);
  const cpBelow = normalizeEnergy(input.specific_heat_below_kj_kg_k ?? input.cpBelowKJkgK, input.specific_heat_below_kcal_kg_c ?? input.cpBelowKcalKgC);
  const latent = normalizeEnergy(input.latent_heat_kj_kg ?? input.latentHeatKJkg, input.latent_heat_kcal_kg ?? input.latentHeatKcalKg);
  return {
    cpAboveKJkgK: cpAbove.value,
    cpBelowKJkgK: cpBelow.value,
    latentHeatKJkg: latent.value,
    sources: {
      cpAbove: cpAbove.source,
      cpBelow: cpBelow.source,
      latentHeat: latent.source,
    },
  };
}
