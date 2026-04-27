import { safeNumber } from "./units";

const KCAL_TO_KJ = 4.1868;
type ConversionSource = "kJ" | "kcal_converted" | "default_kcal_converted" | "missing";

const PRODUCT_THERMAL_DEFAULTS = [
  {
    match: /sorvete|ice\s*cream|gelato/i,
    productType: "sorvete",
    cpAboveKcalKgC: 0.7165,
    cpBelowKcalKgC: 0.406,
    latentHeatKcalKg: 75.9905575766,
    frozenWaterFraction: 0.65,
    latentResidualFactor: 1,
  },
];

function productDefaults(input: any) {
  const text = [input?.product_name, input?.productName, input?.product_type, input?.productType, input?.category].filter(Boolean).join(" ");
  return PRODUCT_THERMAL_DEFAULTS.find((preset) => preset.match.test(text)) ?? null;
}

function normalizeFraction(value: unknown, fallback: number) {
  const parsed = safeNumber(value, NaN);
  if (!Number.isFinite(parsed) || parsed < 0) return Math.min(Math.max(fallback, 0), 1);
  return Math.min(parsed > 1 ? parsed / 100 : parsed, 1);
}

function firstProvided(...values: unknown[]) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function normalizeEnergy(kjValue: unknown, kcalValue: unknown, defaultKcalValue?: unknown): { value: number; source: ConversionSource } {
  const kj = safeNumber(kjValue, 0);
  if (kj > 0) return { value: kj, source: "kJ" };

  const kcal = safeNumber(kcalValue, 0);
  if (kcal > 0) return { value: kcal * KCAL_TO_KJ, source: "kcal_converted" };

  const defaultKcal = safeNumber(defaultKcalValue, 0);
  if (defaultKcal > 0) return { value: defaultKcal * KCAL_TO_KJ, source: "default_kcal_converted" };

  return { value: 0, source: "missing" };
}

export function normalizeThermalProperties(input: any) {
  const defaults = productDefaults(input);
  const cpAbove = normalizeEnergy(input?.specific_heat_above_kj_kg_k ?? input?.cpAboveKJkgK, input?.specific_heat_above_kcal_kg_c, defaults?.cpAboveKcalKgC);
  const cpBelow = normalizeEnergy(input?.specific_heat_below_kj_kg_k ?? input?.cpBelowKJkgK, input?.specific_heat_below_kcal_kg_c, defaults?.cpBelowKcalKgC);
  const latentHeat = normalizeEnergy(input?.latent_heat_kj_kg ?? input?.latentHeatKJkg, input?.latent_heat_kcal_kg, defaults?.latentHeatKcalKg);
  const frozenWaterFraction = normalizeFraction(
    firstProvided(input?.frozen_water_fraction, input?.frozenWaterFraction, input?.freezable_water_content_percent, input?.water_content_percent),
    defaults?.frozenWaterFraction ?? 1,
  );
  const latentResidualFactor = normalizeFraction(input?.latent_residual_factor ?? input?.latentResidualFactor, defaults?.latentResidualFactor ?? 1);

  return {
    cpAboveKJkgK: cpAbove.value,
    cpBelowKJkgK: cpBelow.value,
    latentHeatKJkg: latentHeat.value,
    frozenWaterFraction,
    latentResidualFactor,
    defaultsApplied: defaults?.productType ?? null,
    conversionSources: {
      cpAboveKJkgK: cpAbove.source,
      cpBelowKJkgK: cpBelow.source,
      latentHeatKJkg: latentHeat.source,
    },
  };
}
