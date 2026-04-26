import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

export function databaseToTunnelInput(tunnel: any, environment: any) {
  const thermal = normalizeThermalProperties(tunnel);
  const airTempSource = tunnel?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(tunnel?.packaging_specific_heat_kj_kg_k);
  const approved = tunnel?.thermal_condition_approved === true;
  const normalAirTempC = airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(tunnel?.air_temp_c);
  const normalInput = {
    airTempC: normalAirTempC,
    airVelocityMS: approved ? safeNumber(tunnel?.approved_air_velocity_m_s, normalInput.airVelocityMS) : normalInput.airVelocityMS,
    airDeltaTK: approved ? safeNumber(tunnel?.approved_air_delta_t_k, normalInput.airDeltaTK) : normalInput.airDeltaTK,
    manualConvectiveCoefficientWM2K: approved ? safeNumber(tunnel?.approved_convective_coefficient_w_m2_k, normalInput.manualConvectiveCoefficientWM2K) : normalInput.manualConvectiveCoefficientWM2K,
    airExposureFactor: approved ? safeNumber(tunnel?.approved_air_exposure_factor, normalInput.airExposureFactor) : normalInput.airExposureFactor,
    thermalPenetrationFactor: approved ? safeNumber(tunnel?.approved_thermal_penetration_factor, normalInput.thermalPenetrationFactor) : normalInput.thermalPenetrationFactor,
    informedAirFlowM3H: safeNumber(tunnel?.informed_air_flow_m3_h ?? tunnel?.airflow_m3_h),
    packageType: tunnel?.package_type ?? null,
  };

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
    airTempC: approved ? safeNumber(tunnel?.approved_air_temp_c, normalInput.airTempC) : normalInput.airTempC,
    airVelocityMS: approved ? safeNumber(tunnel?.approved_air_velocity_m_s, normalInput.airVelocityMS) : normalInput.airVelocityMS,
    manualConvectiveCoefficientWM2K: approved ? safeNumber(tunnel?.approved_convective_coefficient_w_m2_k, normalInput.manualConvectiveCoefficientWM2K) : normalInput.manualConvectiveCoefficientWM2K,
    airDeltaTK: approved ? safeNumber(tunnel?.approved_air_delta_t_k, normalInput.airDeltaTK) : normalInput.airDeltaTK,
    airDensityKgM3: safeNumber(tunnel?.air_density_kg_m3, 1.2),
    spiralTurbulenceFactor: safeNumber(tunnel?.spiral_turbulence_factor, 1.8),
    blockExposureFactor: safeNumber(tunnel?.block_exposure_factor, 0.7),
    suggestedAirApproachK: safeNumber(tunnel?.suggested_air_approach_k, 8),
    airExposureFactor: approved ? safeNumber(tunnel?.approved_air_exposure_factor, normalInput.airExposureFactor) : normalInput.airExposureFactor,
    thermalPenetrationFactor: approved ? safeNumber(tunnel?.approved_thermal_penetration_factor, normalInput.thermalPenetrationFactor) : normalInput.thermalPenetrationFactor,
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
    packageType: approved ? (tunnel?.approved_packaging_type ?? normalInput.packageType) : normalInput.packageType,
    informedAirFlowM3H: approved ? safeNumber(tunnel?.approved_air_flow_m3_h, normalInput.informedAirFlowM3H) : normalInput.informedAirFlowM3H,
    thermalConditionApproved: approved,
    approvedAirTempC: safeNumber(tunnel?.approved_air_temp_c),
    approvedAirVelocityMS: safeNumber(tunnel?.approved_air_velocity_m_s),
    approvedAirDeltaTK: safeNumber(tunnel?.approved_air_delta_t_k),
    approvedAirFlowM3H: safeNumber(tunnel?.approved_air_flow_m3_h),
    approvedConvectiveCoefficientWM2K: safeNumber(tunnel?.approved_convective_coefficient_w_m2_k),
    approvedProcessStatus: tunnel?.approved_process_status,
    approvedEstimatedTimeMin: safeNumber(tunnel?.approved_estimated_time_min),
    approvedTotalKW: safeNumber(tunnel?.approved_total_kw),
    approvedTotalKcalH: safeNumber(tunnel?.approved_total_kcal_h),
    approvedTotalTR: safeNumber(tunnel?.approved_total_tr),
    initialScenarioInput: {
      ...normalInput,
    },
  };
}
