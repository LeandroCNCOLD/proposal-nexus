import { safeNumber } from "./units";

export const KCAL_TO_KJ = 4.1868;
type ConversionSource = "kcal_native" | "kJ_native" | "kJ_to_kcal" | "kcal_to_kJ" | "default_kcal_native" | "default_kcal_to_kJ" | "missing";

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

function normalizeEnergyForKcal(kjValue: unknown, kcalValue: unknown, defaultKcalValue: unknown, units: { kcal: string; kj: string }) {
  const shouldPreferKJ = defaultKcalValue === "prefer_kj";
  const kj = safeNumber(kjValue, 0);
  if (shouldPreferKJ && kj > 0) return { value: kj / KCAL_TO_KJ, source: "kJ_to_kcal" as ConversionSource, originalValue: kj, originalUnit: units.kj, convertedValue: kj / KCAL_TO_KJ, usedUnit: units.kcal, equivalentKJ: kj };

  const kcal = safeNumber(kcalValue, 0);
  if (kcal > 0) return { value: kcal, source: "kcal_native" as ConversionSource, originalValue: kcal, originalUnit: units.kcal, convertedValue: kcal, usedUnit: units.kcal, equivalentKJ: kcal * KCAL_TO_KJ };

  if (kj > 0) return { value: kj / KCAL_TO_KJ, source: "kJ_to_kcal" as ConversionSource, originalValue: kj, originalUnit: units.kj, convertedValue: kj / KCAL_TO_KJ, usedUnit: units.kcal, equivalentKJ: kj };

  const defaultKcal = safeNumber(defaultKcalValue, 0);
  if (defaultKcal > 0) return { value: defaultKcal, source: "default_kcal_native" as ConversionSource, originalValue: defaultKcal, originalUnit: units.kcal, convertedValue: defaultKcal, usedUnit: units.kcal, equivalentKJ: defaultKcal * KCAL_TO_KJ };

  return { value: 0, source: "missing" as ConversionSource, originalValue: 0, originalUnit: "ausente", convertedValue: 0, usedUnit: units.kcal, equivalentKJ: 0 };
}

function normalizeEnergyForKj(kjValue: unknown, kcalValue: unknown, defaultKcalValue: unknown, units: { kcal: string; kj: string }) {
  const kj = safeNumber(kjValue, 0);
  if (kj > 0) return { value: kj, source: "kJ_native" as ConversionSource, originalValue: kj, originalUnit: units.kj, convertedValue: kj, usedUnit: units.kj, equivalentKcal: kj / KCAL_TO_KJ };

  const kcal = safeNumber(kcalValue, 0);
  if (kcal > 0) return { value: kcal * KCAL_TO_KJ, source: "kcal_to_kJ" as ConversionSource, originalValue: kcal, originalUnit: units.kcal, convertedValue: kcal * KCAL_TO_KJ, usedUnit: units.kj, equivalentKcal: kcal };

  const defaultKcal = safeNumber(defaultKcalValue, 0);
  if (defaultKcal > 0) return { value: defaultKcal * KCAL_TO_KJ, source: "default_kcal_to_kJ" as ConversionSource, originalValue: defaultKcal, originalUnit: units.kcal, convertedValue: defaultKcal * KCAL_TO_KJ, usedUnit: units.kj, equivalentKcal: defaultKcal };

  return { value: 0, source: "missing" as ConversionSource, originalValue: 0, originalUnit: "ausente", convertedValue: 0, usedUnit: units.kj, equivalentKcal: 0 };
}

export function normalizeProductForKcalEngine(input: any) {
  const defaults = productDefaults(input);
  const preferKJ = input?.prefer_kj_source === true || input?.product_id || input?.is_ashrae_reference === true || String(input?.source ?? "").toLowerCase().includes("ashrae");
  const cpAbove = normalizeEnergyForKcal(input?.specific_heat_above_kj_kg_k ?? input?.cpAboveKJkgK, input?.specific_heat_above_kcal_kg_c ?? input?.cpAboveKcalKgC, preferKJ ? "prefer_kj" : defaults?.cpAboveKcalKgC, { kcal: "kcal/kg°C", kj: "kJ/kg.K" });
  const cpBelow = normalizeEnergyForKcal(input?.specific_heat_below_kj_kg_k ?? input?.cpBelowKJkgK, input?.specific_heat_below_kcal_kg_c ?? input?.cpBelowKcalKgC, preferKJ ? "prefer_kj" : defaults?.cpBelowKcalKgC, { kcal: "kcal/kg°C", kj: "kJ/kg.K" });
  const latentHeat = normalizeEnergyForKcal(input?.latent_heat_kj_kg ?? input?.latentHeatKJkg, input?.latent_heat_kcal_kg ?? input?.latentHeatKcalKg, preferKJ ? "prefer_kj" : defaults?.latentHeatKcalKg, { kcal: "kcal/kg", kj: "kJ/kg" });
  const frozenWaterFraction = normalizeFraction(
    firstProvided(input?.frozen_water_fraction, input?.frozenWaterFraction, input?.freezable_water_content_percent, input?.water_content_percent),
    defaults?.frozenWaterFraction ?? 1,
  );
  const latentResidualFactor = normalizeFraction(input?.latent_residual_factor ?? input?.latentResidualFactor, defaults?.latentResidualFactor ?? 1);

  return {
    cpAboveKcalKgC: cpAbove.value,
    cpBelowKcalKgC: cpBelow.value,
    latentHeatKcalKg: latentHeat.value,
    frozenWaterFraction,
    latentResidualFactor,
    defaultsApplied: defaults?.productType ?? null,
    conversionSources: {
      cpAboveKcalKgC: cpAbove.source,
      cpBelowKcalKgC: cpBelow.source,
      latentHeatKcalKg: latentHeat.source,
    },
    unitAudit: {
      conversionFactor: KCAL_TO_KJ,
      cpAbove: { ...cpAbove },
      cpBelow: { ...cpBelow },
      latentHeat: { ...latentHeat },
    },
  };
}

export function normalizeProductForKjEngine(input: any) {
  const kcal = normalizeProductForKcalEngine(input);
  const cpAbove = normalizeEnergyForKj(input?.specific_heat_above_kj_kg_k ?? input?.cpAboveKJkgK, input?.specific_heat_above_kcal_kg_c ?? input?.cpAboveKcalKgC, productDefaults(input)?.cpAboveKcalKgC, { kcal: "kcal/kg°C", kj: "kJ/kg.K" });
  const cpBelow = normalizeEnergyForKj(input?.specific_heat_below_kj_kg_k ?? input?.cpBelowKJkgK, input?.specific_heat_below_kcal_kg_c ?? input?.cpBelowKcalKgC, productDefaults(input)?.cpBelowKcalKgC, { kcal: "kcal/kg°C", kj: "kJ/kg.K" });
  const latentHeat = normalizeEnergyForKj(input?.latent_heat_kj_kg ?? input?.latentHeatKJkg, input?.latent_heat_kcal_kg ?? input?.latentHeatKcalKg, productDefaults(input)?.latentHeatKcalKg, { kcal: "kcal/kg", kj: "kJ/kg" });
  return {
    cpAboveKJkgK: cpAbove.value,
    cpBelowKJkgK: cpBelow.value,
    latentHeatKJkg: latentHeat.value,
    frozenWaterFraction: kcal.frozenWaterFraction,
    latentResidualFactor: kcal.latentResidualFactor,
    defaultsApplied: kcal.defaultsApplied,
    conversionSources: { cpAboveKJkgK: cpAbove.source, cpBelowKJkgK: cpBelow.source, latentHeatKJkg: latentHeat.source },
    unitAudit: { conversionFactor: KCAL_TO_KJ, cpAbove: { ...cpAbove }, cpBelow: { ...cpBelow }, latentHeat: { ...latentHeat } },
  };
}

export function normalizeThermalProperties(input: any) {
  const kcal = normalizeProductForKcalEngine(input);
  return {
    ...kcal,
    cpAboveKJkgK: kcal.cpAboveKcalKgC * KCAL_TO_KJ,
    cpBelowKJkgK: kcal.cpBelowKcalKgC * KCAL_TO_KJ,
    latentHeatKJkg: kcal.latentHeatKcalKg * KCAL_TO_KJ,
  };
}
