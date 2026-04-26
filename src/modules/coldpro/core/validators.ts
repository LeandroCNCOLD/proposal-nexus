import { safeNumber } from "./units";
import type { TunnelCalculationInput } from "./calculationTypes";

export function validateTunnelInput(input: TunnelCalculationInput) {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const criticalFields: string[] = [];
  const requirePositive = (field: keyof TunnelCalculationInput, label = String(field)) => {
    if (safeNumber(input[field], 0) <= 0) missingFields.push(label);
  };

  requirePositive("initialTempC");
  requirePositive("finalTempC");
  requirePositive("cpAboveKJkgK");
  requirePositive("densityKgM3");
  requirePositive("frozenConductivityWMK");
  if (input.allowPhaseChange !== false) requirePositive("latentHeatKJkg");
  if (input.allowPhaseChange !== false) requirePositive("cpBelowKJkgK");
  if (safeNumber(input.freezingPointC, Number.NaN) !== safeNumber(input.freezingPointC, Number.NaN)) missingFields.push("freezingPointC");

  const cpValues = [input.cpAboveKJkgK, input.cpBelowKJkgK].map((value) => safeNumber(value, 0)).filter((value) => value > 0);
  for (const cp of cpValues) if (cp < 0.5 || cp > 5) criticalFields.push("Cp fora da faixa técnica 0,5 a 5 kJ/kg.K");
  const latent = safeNumber(input.latentHeatKJkg, 0);
  if (latent > 0 && (latent < 50 || latent > 450)) criticalFields.push("calor latente fora da faixa técnica 50 a 450 kJ/kg");
  const density = safeNumber(input.densityKgM3, 0);
  if (density > 0 && (density < 100 || density > 1800)) criticalFields.push("densidade fora da faixa técnica 100 a 1800 kg/m³");
  const velocity = safeNumber(input.airVelocityMS, 0);
  const manualH = safeNumber(input.manualConvectiveCoefficientWM2K ?? input.convective_coefficient_manual_w_m2_k, 0);
  if (manualH <= 0 && velocity > 0 && (velocity < 0.1 || velocity > 15)) criticalFields.push("velocidade do ar fora da faixa técnica 0,1 a 15 m/s");
  const fraction = safeNumber(input.frozenWaterFraction, 0);
  if (fraction < 0 || fraction > 1) criticalFields.push("fração congelável fora da faixa 0 a 1");
  const conductivity = safeNumber(input.frozenConductivityWMK, 0);
  if (conductivity > 0 && (conductivity < 0.02 || conductivity > 3)) criticalFields.push("condutividade congelada fora da faixa 0,02 a 3 W/m.K");
  if (criticalFields.length) warnings.push(...criticalFields);

  return { missingFields: Array.from(new Set(missingFields)), warnings: Array.from(new Set(warnings)), isInvalid: criticalFields.length > 0 };
}
