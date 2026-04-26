import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

export function formToTunnelInput(form: any, environment: any) {
  const thermal = normalizeThermalProperties(form);
  const airTempSource = form?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(form?.packaging_specific_heat_kj_kg_k);
  const approved = form?.thermal_condition_approved === true;
  const normalAirTempC = airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(form?.air_temp_c);
  const normalInput = {
    airTempC: normalAirTempC,
    airVelocityMS: approved ? safeNumber(form?.approved_air_velocity_m_s, normalInput.airVelocityMS) : normalInput.airVelocityMS,
    airDeltaTK: approved ? safeNumber(form?.approved_air_delta_t_k, normalInput.airDeltaTK) : normalInput.airDeltaTK,
    manualConvectiveCoefficientWM2K: approved ? safeNumber(form?.approved_convective_coefficient_w_m2_k, normalInput.manualConvectiveCoefficientWM2K) : normalInput.manualConvectiveCoefficientWM2K,
    airExposureFactor: approved ? safeNumber(form?.approved_air_exposure_factor, normalInput.airExposureFactor) : normalInput.airExposureFactor,
    thermalPenetrationFactor: approved ? safeNumber(form?.approved_thermal_penetration_factor, normalInput.thermalPenetrationFactor) : normalInput.thermalPenetrationFactor,
    informedAirFlowM3H: safeNumber(form?.informed_air_flow_m3_h ?? form?.airflow_m3_h),
    packageType: form?.package_type ?? null,
  };

  return {
    physicalModel: form?.physical_model,
    tunnelPhysicalModel: form?.physical_model,
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
    airTempC: approved ? safeNumber(form?.approved_air_temp_c, normalInput.airTempC) : normalInput.airTempC,
    airVelocityMS: approved ? safeNumber(form?.approved_air_velocity_m_s, normalInput.airVelocityMS) : normalInput.airVelocityMS,
    manualConvectiveCoefficientWM2K: approved ? safeNumber(form?.approved_convective_coefficient_w_m2_k, normalInput.manualConvectiveCoefficientWM2K) : normalInput.manualConvectiveCoefficientWM2K,
    airDeltaTK: approved ? safeNumber(form?.approved_air_delta_t_k, normalInput.airDeltaTK) : normalInput.airDeltaTK,
    airDensityKgM3: safeNumber(form?.air_density_kg_m3, 1.2),
    spiralTurbulenceFactor: safeNumber(form?.spiral_turbulence_factor, 1.8),
    blockExposureFactor: safeNumber(form?.block_exposure_factor, 0.7),
    suggestedAirApproachK: safeNumber(form?.suggested_air_approach_k, 8),
    airExposureFactor: approved ? safeNumber(form?.approved_air_exposure_factor, normalInput.airExposureFactor) : normalInput.airExposureFactor,
    thermalPenetrationFactor: approved ? safeNumber(form?.approved_thermal_penetration_factor, normalInput.thermalPenetrationFactor) : normalInput.thermalPenetrationFactor,
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
    packageType: approved ? (form?.approved_packaging_type ?? normalInput.packageType) : normalInput.packageType,
    informedAirFlowM3H: approved ? safeNumber(form?.approved_air_flow_m3_h, normalInput.informedAirFlowM3H) : normalInput.informedAirFlowM3H,
    thermalConditionApproved: approved,
    approvedAirTempC: safeNumber(form?.approved_air_temp_c),
    approvedAirVelocityMS: safeNumber(form?.approved_air_velocity_m_s),
    approvedAirDeltaTK: safeNumber(form?.approved_air_delta_t_k),
    approvedAirFlowM3H: safeNumber(form?.approved_air_flow_m3_h),
    approvedConvectiveCoefficientWM2K: safeNumber(form?.approved_convective_coefficient_w_m2_k),
    approvedProcessStatus: form?.approved_process_status,
    approvedEstimatedTimeMin: safeNumber(form?.approved_estimated_time_min),
    approvedTotalKW: safeNumber(form?.approved_total_kw),
    approvedTotalKcalH: safeNumber(form?.approved_total_kcal_h),
    approvedTotalTR: safeNumber(form?.approved_total_tr),
    initialScenarioInput: {
      ...normalInput,
    },
  };
}
