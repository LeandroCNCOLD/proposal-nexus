import { normalizeThermalProperties } from "../core/unitNormalizer";
import { safeNumber } from "../core/units";
import type { TunnelEngineInput, TunnelSourceRecord } from "../types/tunnelEngine.types";

const KCAL_TO_KJ = 4.1868;

function isStaticTunnel(processType: unknown, operationMode: unknown) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : value == null ? null : String(value);
}

function resolveFrozenWaterFraction(source: TunnelSourceRecord): number {
  const directFraction = safeNumber(source?.frozen_water_fraction);
  if (source?.frozen_water_fraction !== null && source?.frozen_water_fraction !== undefined && directFraction >= 0) return directFraction;

  const freezablePercent = safeNumber(source?.freezable_water_content_percent);
  if (source?.freezable_water_content_percent !== null && source?.freezable_water_content_percent !== undefined && freezablePercent >= 0) return freezablePercent / 100;

  const waterPercent = safeNumber(source?.water_content_percent);
  if (waterPercent > 0) return waterPercent / 100;

  return 0.9;
}

function calculateStaticMass(source: TunnelSourceRecord, isStatic: boolean) {
  const staticMassMode = source?.static_mass_mode ?? "direct_pallet_mass";
  const numberOfPallets = safeNumber(source?.number_of_pallets, 1) || 1;
  const numberOfCarts = safeNumber(source?.number_of_carts, 1) || 1;
  const unitWeightKg = safeNumber(source?.unit_weight_kg ?? source?.product_unit_weight_kg);
  const unitsPerBox = safeNumber(source?.units_per_box);
  const boxesPerLayer = safeNumber(source?.boxes_per_layer);
  const numberOfLayers = safeNumber(source?.number_of_layers);
  const totalUnitsPerPallet = safeNumber(source?.total_units_per_pallet);
  const unitsPerPallet = staticMassMode === "calculated_pallet_composition" ? (totalUnitsPerPallet > 0 ? totalUnitsPerPallet : unitsPerBox * boxesPerLayer * numberOfLayers) : safeNumber(source?.units_per_pallet);
  const productMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? unitsPerPallet * unitWeightKg : safeNumber(source?.product_mass_per_pallet_kg);
  const packagingMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? safeNumber(source?.box_packaging_weight_kg) + safeNumber(source?.pallet_base_weight_kg) : safeNumber(source?.packaging_mass_per_pallet_kg);
  const calculatedPalletMassKg = staticMassMode === "calculated_pallet_composition" ? productMassPerPalletKg + packagingMassPerPalletKg : safeNumber(source?.calculated_pallet_mass_kg);
  const palletMassKg = staticMassMode === "calculated_pallet_composition" ? calculatedPalletMassKg : safeNumber(source?.pallet_mass_kg);
  const unitsPerCart = safeNumber(source?.units_per_tray) * safeNumber(source?.trays_per_cart);
  const calculatedCartMassKg = unitsPerCart * unitWeightKg + safeNumber(source?.tray_packaging_weight_kg) + safeNumber(source?.cart_structure_weight_kg);
  const calculatedBatchMassKg = unitWeightKg * (unitsPerBox * safeNumber(source?.boxes_per_batch) || totalUnitsPerPallet || safeNumber(source?.units_per_pallet)) + safeNumber(source?.packaging_weight_kg);
  const savedStaticMassKg = safeNumber(source?.static_mass_kg ?? source?.staticMassKg);
  const resolvedStaticMassKg = staticMassMode === "calculated_cart_composition" ? calculatedCartMassKg * numberOfCarts : staticMassMode === "direct_cart_mass" ? palletMassKg * numberOfCarts : staticMassMode === "calculated_batch_composition" ? calculatedBatchMassKg : staticMassMode === "direct_batch_mass" ? safeNumber(source?.direct_batch_mass_kg ?? source?.static_mass_kg) : staticMassMode === "calculated_pallet_composition" ? calculatedPalletMassKg * numberOfPallets : palletMassKg * numberOfPallets;
  const staticMassKg = isStatic ? resolvedStaticMassKg : savedStaticMassKg || resolvedStaticMassKg;
  return { staticMassMode, numberOfPallets, numberOfCarts, unitWeightKg, unitsPerBox, boxesPerLayer, numberOfLayers, totalUnitsPerPallet, unitsPerPallet, productMassPerPalletKg, packagingMassPerPalletKg, calculatedPalletMassKg, calculatedCartMassKg, calculatedBatchMassKg, palletMassKg, staticMassKg };
}

export function databaseToTunnelInput(tunnel: TunnelSourceRecord, environment: TunnelSourceRecord | null | undefined): TunnelEngineInput {
  const thermal = normalizeThermalProperties(tunnel);
  const airTempSource = tunnel?.air_temp_source ?? "environment";
  const packagingSpecificHeatKJkgK = safeNumber(tunnel?.packaging_specific_heat_kj_kg_k);
  const approved = tunnel?.thermal_condition_approved === true;
  const physicalModel = optionalString(tunnel?.physical_model);
  const processType = optionalString(tunnel?.process_type);
  const operationMode = optionalString(tunnel?.operation_mode);
  const isStatic = isStaticTunnel(processType, operationMode);
  const mass = calculateStaticMass(tunnel, isStatic);
  const numberOfPallets = mass.numberOfPallets;
  const palletMassKg = mass.palletMassKg;
  const staticMassKg = mass.staticMassKg;
  const packagingMassKgBatch = safeNumber(tunnel?.packaging_mass_kg_batch);
  const packagingMassKgH = isStatic && safeNumber(tunnel?.batch_time_h) > 0 && packagingMassKgBatch > 0 ? packagingMassKgBatch / safeNumber(tunnel?.batch_time_h) : safeNumber(tunnel?.packaging_mass_kg_hour);
  const normalAirTempC = airTempSource === "environment" ? safeNumber(environment?.internal_temp_c) : safeNumber(tunnel?.air_temp_c);
  const normalInput = {
    airTempC: normalAirTempC,
    airVelocityMS: safeNumber(tunnel?.air_velocity_m_s),
    airDeltaTK: safeNumber(tunnel?.air_delta_t_k, 6),
    manualConvectiveCoefficientWM2K: safeNumber(tunnel?.convective_coefficient_manual_w_m2_k),
    airExposureFactor: safeNumber(tunnel?.air_exposure_factor, 1),
    thermalPenetrationFactor: safeNumber(tunnel?.thermal_penetration_factor, 1),
    informedAirFlowM3H: safeNumber(tunnel?.informed_air_flow_m3_h ?? tunnel?.airflow_m3_h),
    packageType: tunnel?.package_type ?? null,
  };

  return {
    physicalModel,
    tunnelPhysicalModel: physicalModel,
    processType,
    operationMode,
    tunnelMode: tunnel?.tunnel_mode ?? (isStatic ? "static" : "continuous"),
    tunnelType: optionalString(tunnel?.tunnel_type),
    arrangementType: optionalString(tunnel?.arrangement_type),
    productGeometry: optionalString(tunnel?.product_geometry) ?? "slab",
    surfaceExposureModel: optionalString(tunnel?.surface_exposure_model) ?? "fully_exposed",
    thermalModelForPallet: optionalString(tunnel?.thermal_model_for_pallet) ?? (tunnel?.tunnel_type === "static_pallet" && tunnel?.arrangement_type === "palletized_boxes" ? "hybrid" : null),
    airflowSource: optionalString(tunnel?.airflow_source) ?? "manual_velocity",
    fanAirflowM3H: safeNumber(tunnel?.fan_airflow_m3_h),
    tunnelCrossSectionWidthM: safeNumber(tunnel?.tunnel_cross_section_width_m),
    tunnelCrossSectionHeightM: safeNumber(tunnel?.tunnel_cross_section_height_m),
    blockageFactor: safeNumber(tunnel?.blockage_factor),
    blockageFactorInputMode: tunnel?.blockage_factor_input_mode ?? "decimal",
    unitWeightKg: mass.unitWeightKg,
    staticMassMode: mass.staticMassMode,
    continuousMassMode: tunnel?.tunnel_type === "fluidized_bed" ? tunnel?.mass_flow_mode : tunnel?.continuous_mass_mode,
    massFlowMode: tunnel?.mass_flow_mode,
    unitsPerBox: mass.unitsPerBox,
    boxesPerLayer: mass.boxesPerLayer,
    numberOfLayers: mass.numberOfLayers,
    totalUnitsPerPallet: mass.totalUnitsPerPallet,
    unitsPerPallet: mass.unitsPerPallet,
    productMassPerPalletKg: mass.productMassPerPalletKg,
    packagingMassPerPalletKg: mass.packagingMassPerPalletKg,
    calculatedPalletMassKg: mass.calculatedPalletMassKg,
    calculatedCartMassKg: mass.calculatedCartMassKg,
    calculatedBatchMassKg: mass.calculatedBatchMassKg,
    directBatchMassKg: safeNumber(tunnel?.direct_batch_mass_kg),
    unitsPerTray: safeNumber(tunnel?.units_per_tray),
    traysPerCart: safeNumber(tunnel?.trays_per_cart),
    numberOfCarts: mass.numberOfCarts,
    traysPerHour: safeNumber(tunnel?.trays_per_hour),
    trayWeightKg: safeNumber(tunnel?.tray_weight_kg),
    unitsPerHour: safeNumber(tunnel?.units_per_hour),
    unitsPerRow: safeNumber(tunnel?.units_per_row),
    rowsPerMeter: safeNumber(tunnel?.rows_per_meter),
    beltSpeedMMin: safeNumber(tunnel?.belt_speed_m_min),
    feedRateKgH: safeNumber(tunnel?.feed_rate_kg_h),
    unitsPerCycle: safeNumber(tunnel?.units_per_cycle),
    cyclesPerHour: safeNumber(tunnel?.cycles_per_hour),
    directMassKgH: safeNumber(tunnel?.mass_kg_hour),
    palletMassKg,
    numberOfPallets,
    staticMassKg,
    batchTimeH: safeNumber(tunnel?.batch_time_h),
    retentionTimeMin: safeNumber(tunnel?.process_time_min),
    productLengthM: safeNumber(tunnel?.product_length_m),
    productWidthM: safeNumber(tunnel?.product_width_m),
    productThicknessM: safeNumber(tunnel?.product_thickness_m),
    productHeightM: safeNumber(tunnel?.product_height_m),
    productSideM: safeNumber(tunnel?.product_side_m),
    productDiameterM: safeNumber(tunnel?.product_diameter_m),
    equivalentDiameterM: safeNumber(tunnel?.equivalent_diameter_m),
    characteristicDimensionM: safeNumber(tunnel?.characteristic_dimension_m),
    boxLengthM: safeNumber(tunnel?.box_length_m),
    boxWidthM: safeNumber(tunnel?.box_width_m),
    boxHeightM: safeNumber(tunnel?.box_height_m),
    bulkLayerHeightM: safeNumber(tunnel?.bulk_layer_height_m),
    equivalentParticleDiameterM: safeNumber(tunnel?.equivalent_particle_diameter_m),
    bedWidthM: safeNumber(tunnel?.bed_width_m),
    bedLengthM: safeNumber(tunnel?.bed_length_m),
    bedAreaM2: safeNumber(tunnel?.bed_area_m2),
    superficialAirVelocityMS: safeNumber(tunnel?.superficial_air_velocity_m_s),
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
    frozenWaterFraction: resolveFrozenWaterFraction(tunnel),
    frozenConductivityWMK: safeNumber(tunnel?.thermal_conductivity_frozen_w_m_k),
    densityKgM3: safeNumber(tunnel?.density_kg_m3),
    packagingMassKgH,
    packagingMassKgBatch,
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
