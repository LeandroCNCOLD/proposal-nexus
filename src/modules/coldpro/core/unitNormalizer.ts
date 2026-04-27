import { safeNumber } from "./units";

const KCAL_TO_KJ = 4.1868;
type ConversionSource = "kJ" | "kcal_converted" | "missing";

const PRODUCT_THERMAL_DEFAULTS = [
  {
    match: /sorvete|ice\s*cream|gelato/i,
    productType: "sorvete",
    cpAboveKcalKgC: 0.7165,
    cpBelowKcalKgC: 0.406,
    latentHeatKcalKg: 43.95,
    frozenWaterFraction: 0.65,
    latentResidualFactor: 0.7,
  },
];

function productDefaults(input: any) {
  const text = [input?.product_name, input?.productName, input?.product_type, input?.productType, input?.category].filter(Boolean).join(" ");
  return PRODUCT_THERMAL_DEFAULTS.find((preset) => preset.match.test(text)) ?? null;
}

function normalizeEnergy(kjValue: unknown, kcalValue: unknown): { value: number; source: ConversionSource } {
  const kj = safeNumber(kjValue, 0);
  if (kj > 0) return { value: kj, source: "kJ" };

  const kcal = safeNumber(kcalValue, 0);
  if (kcal > 0) return { value: kcal * KCAL_TO_KJ, source: "kcal_converted" };

  return { value: 0, source: "missing" };
}

export function normalizeThermalProperties(input: any) {
  const defaults = productDefaults(input);
  const cpAbove = normalizeEnergy(input?.specific_heat_above_kj_kg_k, input?.specific_heat_above_kcal_kg_c ?? defaults?.cpAboveKcalKgC);
  const cpBelow = normalizeEnergy(input?.specific_heat_below_kj_kg_k, input?.specific_heat_below_kcal_kg_c ?? defaults?.cpBelowKcalKgC);
  const latentHeat = normalizeEnergy(input?.latent_heat_kj_kg, input?.latent_heat_kcal_kg ?? defaults?.latentHeatKcalKg);
  const directFraction = safeNumber(input?.frozen_water_fraction, NaN);
  const freezablePercent = safeNumber(input?.freezable_water_content_percent, NaN);
  const waterPercent = safeNumber(input?.water_content_percent, NaN);
  const frozenWaterFraction = Number.isFinite(directFraction) && directFraction >= 0
    ? (directFraction > 1 ? directFraction / 100 : directFraction)
    : Number.isFinite(freezablePercent) && freezablePercent >= 0
      ? freezablePercent / 100
      : Number.isFinite(waterPercent) && waterPercent > 0
        ? Math.min(1, waterPercent / 100)
        : defaults?.frozenWaterFraction ?? 1;
  const latentResidualFactor = safeNumber(input?.latent_residual_factor ?? input?.latentResidualFactor, defaults?.latentResidualFactor ?? 1);

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
