import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";

const KCAL_TO_KJ = 4.1868;

function isStaticTunnel(processType: unknown, operationMode: unknown) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function calculateStaticMass(source: any, isStatic: boolean) {
  const staticMassMode = source?.static_mass_mode ?? "direct_pallet_mass";
  const numberOfPallets = safeNumber(source?.number_of_pallets, 1) || 1;
  const numberOfCarts = safeNumber(source?.number_of_carts, 1) || 1;
  const unitWeightKg = safeNumber(source?.unit_weight_kg ?? source?.product_unit_weight_kg);
  const unitsPerBox = safeNumber(source?.units_per_box);
  const boxesPerLayer = safeNumber(source?.boxes_per_layer);
  const numberOfLayers = safeNumber(source?.number_of_layers);
  const totalUnitsPerPallet = safeNumber(source?.total_units_per_pallet);
  const unitsPerPallet = staticMassMode === "calculated_pallet_composition"
    ? (totalUnitsPerPallet > 0 ? totalUnitsPerPallet : unitsPerBox * boxesPerLayer * numberOfLayers)
    : safeNumber(source?.units_per_pallet);
  const productMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? unitsPerPallet * unitWeightKg : safeNumber(source?.product_mass_per_pallet_kg);
  const packagingMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? safeNumber(source?.box_packaging_weight_kg) + safeNumber(source?.pallet_base_weight_kg) : safeNumber(source?.packaging_mass_per_pallet_kg);
  const calculatedPalletMassKg = staticMassMode === "calculated_pallet_composition" ? productMassPerPalletKg + packagingMassPerPalletKg : safeNumber(source?.calculated_pallet_mass_kg);
  const palletMassKg = staticMassMode === "calculated_pallet_composition" ? calculatedPalletMassKg : safeNumber(source?.pallet_mass_kg);
  const unitsPerCart = safeNumber(source?.units_per_tray) * safeNumber(source?.trays_per_cart);
  const calculatedCartMassKg = unitsPerCart * unitWeightKg + safeNumber(source?.tray_packaging_weight_kg) + safeNumber(source?.cart_structure_weight_kg);
  const calculatedBatchMassKg = unitWeightKg * (unitsPerBox * safeNumber(source?.boxes_per_batch) || totalUnitsPerPallet || safeNumber(source?.units_per_pallet)) + safeNumber(source?.packaging_weight_kg);
  const savedStaticMassKg = safeNumber(source?.static_mass_kg ?? source?.staticMassKg);
  const resolvedStaticMassKg = staticMassMode === "calculated_cart_composition" ? calculatedCartMassKg * numberOfCarts : staticMassMode === "direct_cart_mass" ? palletMassKg * numberOfCarts : staticMassMode === "calculated_batch_composition" ? calculatedBatchMassKg : staticMassMode === "direct_batch_mass" ? safeNumber(source?.direct_batch_mass_kg ?? source?.static_mass_kg) : staticMassMode === "calculated_pallet_composition" ? calculatedPalletMassKg * numberOfPallets : palletMassKg * numberOfPallets;
  const staticMassKg = isStatic ? (savedStaticMassKg || resolvedStaticMassKg) : savedStaticMassKg || resolvedStaticMassKg;
  return { staticMassMode, numberOfPallets, numberOfCarts, unitWeightKg, unitsPerBox, boxesPerLayer, numberOfLayers, totalUnitsPerPallet, unitsPerPallet, productMassPerPalletKg, packagingMassPerPalletKg, calculatedPalletMassKg, calculatedCartMassKg, calculatedBatchMassKg, palletMassKg, staticMassKg };
}

export function formToTunnelInput(form: any, environment: any) {
  const thermal = normalizeThermalProperties(form);
  const airTempSource = form?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(form?.packaging_specific_heat_kj_kg_k);
  const approved = false;
  const thermalConditionApproved = form?.thermal_condition_approved === true;
  const physicalModel = form?.physical_model;
  const processType = form?.process_type;
  const operationMode = form?.operation_mode;
  const isStatic = isStaticTunnel(processType, operationMode);
  const mass = calculateStaticMass(form, isStatic);
  const numberOfPallets = mass.numberOfPallets;
  const palletMassKg = mass.palletMassKg;
  const staticMassKg = mass.staticMassKg;
  const packagingMassKgBatch = safeNumber(form?.packaging_mass_kg_batch);
  const packagingMassKgH = isStatic && safeNumber(form?.batch_time_h) > 0 && packagingMassKgBatch > 0 ? packagingMassKgBatch / safeNumber(form?.batch_time_h) : safeNumber(form?.packaging_mass_kg_hour);
  const normalAirTempC = airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(form?.air_temp_c);
  const airflowSource = form?.airflow_source ?? "manual_velocity";
  const informedAirFlowM3H = airflowSource === "airflow_by_fans"
    ? safeNumber(form?.fan_airflow_m3_h ?? form?.informed_air_flow_m3_h ?? form?.airflow_m3_h)
    : safeNumber(form?.informed_air_flow_m3_h ?? form?.airflow_m3_h);
  const normalInput = {
    airTempC: normalAirTempC,
    airVelocityMS: safeNumber(form?.air_velocity_m_s),
    airDeltaTK: safeNumber(form?.air_delta_t_k, 6),
    manualConvectiveCoefficientWM2K: safeNumber(form?.convective_coefficient_manual_w_m2_k),
    airExposureFactor: safeNumber(form?.air_exposure_factor, 1),
    thermalPenetrationFactor: safeNumber(form?.thermal_penetration_factor, 1),
    informedAirFlowM3H,
    packageType: form?.package_type ?? null,
  };

  return {
    physicalModel,
    tunnelPhysicalModel: physicalModel,
    processType,
    operationMode,
    tunnelMode: form?.tunnel_mode ?? (isStatic ? "static" : "continuous"),
    tunnelType: form?.tunnel_type,
    arrangementType: form?.arrangement_type,
    productGeometry: form?.product_geometry ?? "slab",
    surfaceExposureModel: form?.surface_exposure_model ?? "fully_exposed",
    thermalModelForPallet: form?.thermal_model_for_pallet ?? (form?.tunnel_type === "static_pallet" && form?.arrangement_type === "palletized_boxes" ? "hybrid" : null),
    airflowSource,
    fanAirflowM3H: safeNumber(form?.fan_airflow_m3_h),
    tunnelCrossSectionWidthM: safeNumber(form?.tunnel_cross_section_width_m),
    tunnelCrossSectionHeightM: safeNumber(form?.tunnel_cross_section_height_m),
    blockageFactor: safeNumber(form?.blockage_factor),
    blockageFactorInputMode: form?.blockage_factor_input_mode ?? "decimal",
    unitWeightKg: mass.unitWeightKg,
    staticMassMode: mass.staticMassMode,
    unitsPerBox: mass.unitsPerBox,
    boxesPerLayer: mass.boxesPerLayer,
    numberOfLayers: mass.numberOfLayers,
    totalUnitsPerPallet: mass.totalUnitsPerPallet,
    unitsPerPallet: mass.unitsPerPallet,
    productMassPerPalletKg: mass.productMassPerPalletKg,
    packagingMassPerPalletKg: mass.packagingMassPerPalletKg,
    calculatedPalletMassKg: mass.calculatedPalletMassKg,
    unitsPerCycle: safeNumber(form?.units_per_cycle),
    cyclesPerHour: safeNumber(form?.cycles_per_hour),
    directMassKgH: safeNumber(form?.mass_kg_hour),
    palletMassKg,
    numberOfPallets,
    staticMassKg,
    batchTimeH: safeNumber(form?.batch_time_h),
    retentionTimeMin: safeNumber(form?.process_time_min),
    productLengthM: safeNumber(form?.product_length_m),
    productWidthM: safeNumber(form?.product_width_m),
    productThicknessM: safeNumber(form?.product_thickness_m),
    productHeightM: safeNumber(form?.product_height_m),
    productSideM: safeNumber(form?.product_side_m),
    productDiameterM: safeNumber(form?.product_diameter_m),
    equivalentDiameterM: safeNumber(form?.equivalent_diameter_m),
    characteristicDimensionM: safeNumber(form?.characteristic_dimension_m),
    boxLengthM: safeNumber(form?.box_length_m),
    boxWidthM: safeNumber(form?.box_width_m),
    boxHeightM: safeNumber(form?.box_height_m),
    bulkLayerHeightM: safeNumber(form?.bulk_layer_height_m),
    equivalentParticleDiameterM: safeNumber(form?.equivalent_particle_diameter_m),
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
    packagingMassKgH,
    packagingMassKgBatch,
    packagingCpKJkgK: packagingSpecificHeatKJkgK > 0
      ? packagingSpecificHeatKJkgK
      : safeNumber(form?.packaging_specific_heat_kcal_kg_c) * KCAL_TO_KJ,
    beltMotorKW: safeNumber(form?.belt_motor_kw),
    internalFansKW: safeNumber(form?.internal_fans_kw),
    otherInternalKW: safeNumber(form?.other_internal_kw),
    allowPhaseChange: true,
    packageType: approved ? (form?.approved_packaging_type ?? normalInput.packageType) : normalInput.packageType,
    informedAirFlowM3H: approved ? safeNumber(form?.approved_air_flow_m3_h, normalInput.informedAirFlowM3H) : normalInput.informedAirFlowM3H,
    thermalConditionApproved,
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
