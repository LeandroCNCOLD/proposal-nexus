import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

export function databaseToTunnelInput(tunnel: any, environment: any) {
  const thermal = normalizeThermalProperties(tunnel);
  const airTempSource = tunnel?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(tunnel?.packaging_specific_heat_kj_kg_k);

  return {
    physicalModel: tunnel?.physical_model,
    tunnelPhysicalModel: tunnel?.physical_model,
    processType: tunnel?.process_type,
    operationMode: tunnel?.operation_mode,
    tunnelMode: tunnel?.tunnel_mode ?? (tunnel?.operation_mode === "batch" ? "static" : "continuous"),
    unitWeightKg: safeNumber(tunnel?.unit_weight_kg ?? tunnel?.product_unit_weight_kg),
    unitsPerCycle: safeNumber(tunnel?.units_per_cycle),
    cyclesPerHour: safeNumber(tunnel?.cycles_per_hour),
    directMassKgH: safeNumber(tunnel?.mass_kg_hour),
    palletMassKg: safeNumber(tunnel?.pallet_mass_kg),
    numberOfPallets: safeNumber(tunnel?.number_of_pallets, 1),
    staticMassKg: safeNumber(tunnel?.static_mass_kg) || safeNumber(tunnel?.staticMassKg) || safeNumber(tunnel?.pallet_mass_kg) * Math.max(1, safeNumber(tunnel?.number_of_pallets, 1)),
    batchTimeH: safeNumber(tunnel?.batch_time_h),
    retentionTimeMin: safeNumber(tunnel?.process_time_min),
    productLengthM: safeNumber(tunnel?.product_length_m),
    productWidthM: safeNumber(tunnel?.product_width_m),
    productThicknessM: safeNumber(tunnel?.product_thickness_m),
    palletLengthM: safeNumber(tunnel?.pallet_length_m),
    palletWidthM: safeNumber(tunnel?.pallet_width_m),
    palletHeightM: safeNumber(tunnel?.pallet_height_m),
    airTempSource,
    airTempC: airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(tunnel?.air_temp_c),
    airVelocityMS: safeNumber(tunnel?.air_velocity_m_s),
    manualConvectiveCoefficientWM2K: safeNumber(tunnel?.convective_coefficient_manual_w_m2_k),
    airDeltaTK: safeNumber(tunnel?.air_delta_t_k, 6),
    airDensityKgM3: safeNumber(tunnel?.air_density_kg_m3, 1.2),
    spiralTurbulenceFactor: safeNumber(tunnel?.spiral_turbulence_factor, 1.8),
    blockExposureFactor: safeNumber(tunnel?.block_exposure_factor, 0.7),
    suggestedAirApproachK: safeNumber(tunnel?.suggested_air_approach_k, 8),
    airExposureFactor: safeNumber(tunnel?.air_exposure_factor, 1),
    thermalPenetrationFactor: safeNumber(tunnel?.thermal_penetration_factor, 1),
    initialTempC: safeNumber(tunnel?.inlet_temp_c),
    finalTempC: safeNumber(tunnel?.outlet_temp_c),
    freezingPointC: safeNumber(tunnel?.freezing_temp_c, -1.5),
    cpAboveKJkgK: thermal.cpAboveKJkgK,
    cpBelowKJkgK: thermal.cpBelowKJkgK,
    latentHeatKJkg: thermal.latentHeatKJkg,
    unitConversions: thermal.conversionSources,
    frozenWaterFraction: safeNumber(tunnel?.frozen_water_fraction),
    frozenConductivityWMK: safeNumber(tunnel?.thermal_conductivity_frozen_w_m_k),
    densityKgM3: safeNumber(tunnel?.density_kg_m3),
    packagingMassKgH: safeNumber(tunnel?.packaging_mass_kg_hour),
    packagingCpKJkgK: packagingSpecificHeatKJkgK > 0
      ? packagingSpecificHeatKJkgK
      : safeNumber(tunnel?.packaging_specific_heat_kcal_kg_c) * KCAL_TO_KJ,
    beltMotorKW: safeNumber(tunnel?.belt_motor_kw),
    internalFansKW: safeNumber(tunnel?.internal_fans_kw),
    otherInternalKW: safeNumber(tunnel?.other_internal_kw),
    allowPhaseChange: true,
  };
}
