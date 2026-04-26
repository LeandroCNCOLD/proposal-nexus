import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";
import { COLDPRO_CONSTANTS, KCAL_TO_KJ } from "../core/constants";
import type { TunnelCalculationInput } from "../core/calculationTypes";

function firstPositive(...values: unknown[]) {
  for (const value of values) {
    const parsed = safeNumber(value, 0);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function formToTunnelInput(form: Record<string, unknown>, environment?: Record<string, unknown> | null): TunnelCalculationInput {
  const thermal = normalizeThermalProperties(form);
  const airTempSource = String(form.air_temp_source ?? "environment");
  const numberOfPallets = Math.max(1, safeNumber(form.number_of_pallets, 1));
  const packagingCpKJkgK = firstPositive(form.packaging_specific_heat_kj_kg_k) || firstPositive(form.packaging_specific_heat_kcal_kg_c) * KCAL_TO_KJ;
  return {
    processType: String(form.process_type ?? "continuous_individual_freezing"),
    operationMode: String(form.operation_mode ?? "continuous"),
    unitWeightKg: firstPositive(form.unit_weight_kg, form.product_unit_weight_kg),
    unitsPerCycle: safeNumber(form.units_per_cycle, 0),
    cyclesPerHour: safeNumber(form.cycles_per_hour, 0),
    directMassKgH: safeNumber(form.mass_kg_hour, 0),
    staticMassKg: safeNumber(form.pallet_mass_kg, 0) * numberOfPallets,
    batchTimeH: safeNumber(form.batch_time_h, 0),
    retentionTimeMin: safeNumber(form.process_time_min, 0),
    productLengthM: safeNumber(form.product_length_m, 0),
    productWidthM: safeNumber(form.product_width_m, 0),
    productThicknessM: firstPositive(form.product_thickness_m) || safeNumber(form.product_thickness_mm, 0) / 1000,
    palletLengthM: safeNumber(form.pallet_length_m, 0),
    palletWidthM: safeNumber(form.pallet_width_m, 0),
    palletHeightM: safeNumber(form.pallet_height_m, 0),
    airTempSource,
    airTempC: airTempSource === "environment" ? safeNumber(environment?.internal_temp_c, safeNumber(form.air_temp_c, 0)) : safeNumber(form.air_temp_c, 0),
    airVelocityMS: safeNumber(form.air_velocity_m_s, 0),
    manualConvectiveCoefficientWM2K: safeNumber(form.convective_coefficient_manual_w_m2_k, 0),
    airDeltaTK: safeNumber(form.air_delta_t_k, 6) || 6,
    airDensityKgM3: safeNumber(form.air_density_kg_m3, COLDPRO_CONSTANTS.DEFAULT_AIR_DENSITY_KG_M3) || COLDPRO_CONSTANTS.DEFAULT_AIR_DENSITY_KG_M3,
    airExposureFactor: safeNumber(form.air_exposure_factor, 1) || 1,
    thermalPenetrationFactor: safeNumber(form.thermal_penetration_factor, 1) || 1,
    initialTempC: safeNumber(form.inlet_temp_c, 0),
    finalTempC: safeNumber(form.outlet_temp_c, 0),
    freezingPointC: safeNumber(form.freezing_temp_c, -1.5),
    cpAboveKJkgK: thermal.cpAboveKJkgK,
    cpBelowKJkgK: thermal.cpBelowKJkgK,
    latentHeatKJkg: thermal.latentHeatKJkg,
    frozenWaterFraction: firstPositive(form.frozen_water_fraction, safeNumber(form.freezable_water_content_percent, 0) / 100, safeNumber(form.water_content_percent, 0) / 100, 0.9),
    frozenConductivityWMK: firstPositive(form.thermal_conductivity_frozen_w_m_k, form.thermal_conductivity_w_m_k),
    densityKgM3: firstPositive(form.density_kg_m3, form.ashrae_density_kg_m3),
    packagingMassKgH: safeNumber(form.packaging_mass_kg_hour, 0),
    packagingCpKJkgK,
    beltMotorKW: safeNumber(form.belt_motor_kw, 0),
    internalFansKW: safeNumber(form.internal_fans_kw, 0),
    otherInternalKW: safeNumber(form.other_internal_kw, 0),
    allowPhaseChange: true,
    originalInput: { form, environment },
    unitConversions: thermal.sources,
  };
}
