import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

export function formToTunnelInput(form: any, environment: any) {
  const thermal = normalizeThermalProperties(form);
  const airTempSource = form?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(form?.packaging_specific_heat_kj_kg_k);

  return {
    processType: form?.process_type,
    operationMode: form?.operation_mode,
    tunnelMode: form?.tunnel_mode ?? (form?.operation_mode === "batch" ? "static" : "continuous"),
    unitWeightKg: safeNumber(form?.unit_weight_kg ?? form?.product_unit_weight_kg),
    unitsPerCycle: safeNumber(form?.units_per_cycle),
    cyclesPerHour: safeNumber(form?.cycles_per_hour),
    directMassKgH: safeNumber(form?.mass_kg_hour),
    palletMassKg: safeNumber(form?.pallet_mass_kg),
    numberOfPallets: safeNumber(form?.number_of_pallets, 1),
    staticMassKg: safeNumber(form?.static_mass_kg) || safeNumber(form?.staticMassKg) || safeNumber(form?.pallet_mass_kg) * Math.max(1, safeNumber(form?.number_of_pallets, 1)),
    batchTimeH: safeNumber(form?.batch_time_h),
    retentionTimeMin: safeNumber(form?.process_time_min),
    productLengthM: safeNumber(form?.product_length_m),
    productWidthM: safeNumber(form?.product_width_m),
    productThicknessM: safeNumber(form?.product_thickness_m),
    palletLengthM: safeNumber(form?.pallet_length_m),
    palletWidthM: safeNumber(form?.pallet_width_m),
    palletHeightM: safeNumber(form?.pallet_height_m),
    airTempSource,
    airTempC: airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(form?.air_temp_c),
    airVelocityMS: safeNumber(form?.air_velocity_m_s),
    manualConvectiveCoefficientWM2K: safeNumber(form?.convective_coefficient_manual_w_m2_k),
    airDeltaTK: safeNumber(form?.air_delta_t_k, 6),
    airDensityKgM3: safeNumber(form?.air_density_kg_m3, 1.2),
    suggestedAirApproachK: safeNumber(form?.suggested_air_approach_k, 8),
    airExposureFactor: safeNumber(form?.air_exposure_factor, 1),
    thermalPenetrationFactor: safeNumber(form?.thermal_penetration_factor, 1),
    initialTempC: safeNumber(form?.inlet_temp_c),
    finalTempC: safeNumber(form?.outlet_temp_c),
    freezingPointC: safeNumber(form?.freezing_temp_c, -1.5),
    cpAboveKJkgK: thermal.cpAboveKJkgK,
    cpBelowKJkgK: thermal.cpBelowKJkgK,
    latentHeatKJkg: thermal.latentHeatKJkg,
    unitConversions: thermal.conversionSources,
    frozenWaterFraction: safeNumber(form?.frozen_water_fraction),
    frozenConductivityWMK: safeNumber(form?.thermal_conductivity_frozen_w_m_k),
    densityKgM3: safeNumber(form?.density_kg_m3),
    packagingMassKgH: safeNumber(form?.packaging_mass_kg_hour),
    packagingCpKJkgK: packagingSpecificHeatKJkgK > 0
      ? packagingSpecificHeatKJkgK
      : safeNumber(form?.packaging_specific_heat_kcal_kg_c) * KCAL_TO_KJ,
    beltMotorKW: safeNumber(form?.belt_motor_kw),
    internalFansKW: safeNumber(form?.internal_fans_kw),
    otherInternalKW: safeNumber(form?.other_internal_kw),
    allowPhaseChange: true,
  };
}
