import { buildCalculationLog } from "../core/calculationLogger";
import { kwToKcalH, kwToTr } from "../core/units";
import { validateTunnelInput } from "../core/validators";
import { calculateAirflowModel } from "../physics/airflowModel";
import { calculateExposureFactor } from "../physics/arrangementModel";
import { calculatePlankFreezingTimeMin } from "../physics/freezingTime";
import { calculateCharacteristicDimension } from "../physics/geometryModel";
import { calculateConvectiveCoefficient } from "../physics/heatTransfer";
import {
  calculateBatchProductLoadKW,
  calculateContinuousProductLoadKW,
  calculateProductSpecificEnergy,
} from "../physics/productThermal";
import { resolveTunnelMode } from "../physics/tunnelModeModel";

export const COLDPRO_TUNNEL_ENGINE_VERSION = "tunnel-engine-v1.0.0";

export type TunnelPhysicalModel = "continuous_individual" | "continuous_spiral" | "static_cart" | "static_block" | "fluidized_bed" | "blast_freezer";
export type TunnelScenarioStatus = "adequate" | "insufficient" | "missing_data" | "invalid_input";

export type TunnelThermalScenario = {
  airTempC: number | null;
  airVelocityMS: number | null;
  airDeltaTK: number;
  airFlowM3H: number;
  airFlowThermalBalanceM3H: number;
  informedAirFlowM3H: number | null;
  suggestedAirTempC: number;
  hEffectiveWM2K: number | null;
  hSource: string;
  productLoadKW: number;
  packagingLoadKW: number;
  internalLoadKW: number;
  totalKW: number;
  totalKcalH: number;
  totalTR: number;
  estimatedTimeMin: number | null;
  availableTimeMin: number;
  status: TunnelScenarioStatus;
  warnings: string[];
  missingFields: string[];
  invalidFields: string[];
};

const MODEL_META: Record<TunnelPhysicalModel, {
  label: string;
  mode: "continuous" | "static";
  physicalDescription: string;
  geometryAssumption: string;
  convectionAssumption: string;
}> = {
  continuous_individual: {
    label: "Túnel contínuo individual",
    mode: "continuous",
    physicalDescription: "Produto tratado como unidade individual em fluxo contínuo.",
    geometryAssumption: "Espessura do produto como dimensão crítica; núcleo na metade da espessura.",
    convectionAssumption: "Convecção estimada pela velocidade do ar ou coeficiente manual.",
  },
  continuous_spiral: {
    label: "Girofreezer contínuo",
    mode: "continuous",
    physicalDescription: "Produto em girofreezer contínuo com turbulência e alta troca convectiva.",
    geometryAssumption: "Espessura do produto como dimensão crítica; núcleo na metade da espessura.",
    convectionAssumption: "Convecção estimada pela velocidade do ar com fator de turbulência; manual prevalece sem multiplicador.",
  },
  static_cart: {
    label: "Estático em carrinho",
    mode: "static",
    physicalDescription: "Produto em carrinho, rack ou bandejas com circulação de ar entre camadas.",
    geometryAssumption: "Produto tratado como unidades/bandejas expostas; espessura do produto é a dimensão crítica.",
    convectionAssumption: "Convecção estimada pela velocidade do ar ou coeficiente manual.",
  },
  static_block: {
    label: "Estático em pallet/bloco",
    mode: "static",
    physicalDescription: "Produto tratado como bloco térmico equivalente ou pallet compacto.",
    geometryAssumption: "Menor dimensão válida do pallet/bloco como dimensão crítica.",
    convectionAssumption: "Convecção estimada com redução por baixa exposição; manual prevalece sem redução.",
  },
  fluidized_bed: {
    label: "Leito fluidizado / IQF",
    mode: "continuous",
    physicalDescription: "Produto pequeno ou particulado com ar atravessando a camada fluidizada.",
    geometryAssumption: "Diâmetro equivalente da partícula ou menor dimensão do produto.",
    convectionAssumption: "Convecção estimada pela velocidade real na seção livre; manual prevalece.",
  },
  blast_freezer: {
    label: "Câmara/túnel de ar forçado",
    mode: "static",
    physicalDescription: "Carga em caixas, racks ou contentores com ar forçado.",
    geometryAssumption: "Geometria informada da embalagem/carga como dimensão crítica.",
    convectionAssumption: "Convecção estimada pela velocidade real do ar; manual prevalece.",
  },
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isProvided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function positiveNumber(value: unknown): number {
  const parsed = toNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  return isProvided(value) && Number.isFinite(Number(value)) ? Number(value) : null;
}

function continuousMassRequirement(input: any, continuousMassMode: string): string {
  const unitWeightKg = positiveNumber(input?.unitWeightKg);
  if (continuousMassMode === "direct_mass_flow") return positiveNumber(input?.directMassKgH) > 0 ? "" : "massa direta em kg/h";
  if (continuousMassMode === "calculated_by_units_per_hour") return unitWeightKg * positiveNumber(input?.unitsPerHour) > 0 ? "" : "peso unitário e unidades por hora";
  if (continuousMassMode === "calculated_by_belt_loading") return unitWeightKg * positiveNumber(input?.unitsPerRow) * positiveNumber(input?.rowsPerMeter) * positiveNumber(input?.beltSpeedMMin) > 0 ? "" : "peso unitário, unidades por fileira, fileiras por metro e velocidade da esteira";
  if (continuousMassMode === "calculated_by_trays") return (unitWeightKg * positiveNumber(input?.unitsPerTray) + positiveNumber(input?.trayWeightKg)) * positiveNumber(input?.traysPerHour) > 0 ? "" : "unidades por bandeja, bandejas por hora e massa da bandeja";
  if (continuousMassMode === "calculated_by_feed_rate") return positiveNumber(input?.feedRateKgH) > 0 ? "" : "taxa de alimentação em kg/h";
  return unitWeightKg * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour) > 0 ? "" : "peso unitário, unidades por ciclo e ciclos por hora";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getSmallestValidDimension(values: unknown[]): number {
  const dimensions = values.map((value) => positiveNumber(value)).filter((value) => value > 0);
  return dimensions.length > 0 ? Math.min(...dimensions) : 0;
}

function normalizePhysicalModel(input: any): TunnelPhysicalModel {
  const processType = input?.processType ?? input?.process_type;
  const operationMode = input?.operationMode ?? input?.operation_mode;
  const tunnelType = String(input?.tunnelType ?? input?.tunnel_type ?? "").toLowerCase().trim();
  if (tunnelType === "fluidized_bed") return "fluidized_bed";
  if (tunnelType === "blast_freezer") return "blast_freezer";
  if (tunnelType === "spiral_girofreezer") return "continuous_spiral";
  if (tunnelType === "static_cart") return "static_cart";
  if (tunnelType === "static_pallet") return "static_block";
  if (tunnelType === "continuous_belt") return "continuous_individual";
  if (isStaticTunnel(processType, operationMode)) return processType === "static_cart_freezing" ? "static_cart" : "static_block";

  const raw = String(input?.physicalModel ?? input?.tunnelPhysicalModel ?? input?.physical_model ?? input?.processType ?? input?.process_type ?? input?.tunnelMode ?? input?.tunnel_mode ?? "").toLowerCase().trim();
  if (["continuous_spiral", "girofreezer", "continuous_girofreezer", "girofreezer_continuous"].includes(raw)) return "continuous_spiral";
  if (["static_cart", "static_cart_freezing", "cart", "rack", "cart_rack"].includes(raw)) return "static_cart";
  if (["static_block", "static_pallet_freezing", "pallet_block", "bulk_static", "static_pallet"].includes(raw)) return "static_block";
  if (["continuous_individual", "continuous_individual_freezing", "continuous"].includes(raw)) return "continuous_individual";

  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("giro")) return "continuous_spiral";
  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("cart")) return "static_cart";
  if (String(input?.processType ?? input?.process_type ?? "").toLowerCase().includes("static")) return "static_block";
  if (input?.operationMode === "batch" || input?.operation_mode === "batch" || input?.tunnelMode === "static" || input?.tunnel_mode === "static") return "static_block";
  return "continuous_individual";
}

function isStaticTunnel(processType: unknown, operationMode: unknown) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function resolveStaticMass(input: any) {
  const numberOfPallets = positiveNumber(input?.numberOfPallets ?? input?.number_of_pallets) || 1;
  const numberOfCarts = positiveNumber(input?.numberOfCarts ?? input?.number_of_carts) || 1;
  const staticMassMode = String(input?.staticMassMode ?? input?.static_mass_mode ?? "direct_pallet_mass");
  const unitWeightKg = positiveNumber(input?.unitWeightKg ?? input?.unit_weight_kg ?? input?.product_unit_weight_kg);
  const unitsPerBox = positiveNumber(input?.unitsPerBox ?? input?.units_per_box);
  const boxesPerLayer = positiveNumber(input?.boxesPerLayer ?? input?.boxes_per_layer);
  const numberOfLayers = positiveNumber(input?.numberOfLayers ?? input?.number_of_layers);
  const totalUnitsPerPallet = positiveNumber(input?.totalUnitsPerPallet ?? input?.total_units_per_pallet);
  const unitsPerPallet = staticMassMode === "calculated_pallet_composition" ? (totalUnitsPerPallet > 0 ? totalUnitsPerPallet : unitsPerBox * boxesPerLayer * numberOfLayers) : positiveNumber(input?.unitsPerPallet ?? input?.units_per_pallet);
  const productMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? unitsPerPallet * unitWeightKg : positiveNumber(input?.productMassPerPalletKg ?? input?.product_mass_per_pallet_kg);
  const packagingMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? positiveNumber(input?.boxPackagingWeightKg ?? input?.box_packaging_weight_kg) + positiveNumber(input?.palletBaseWeightKg ?? input?.pallet_base_weight_kg) : positiveNumber(input?.packagingMassPerPalletKg ?? input?.packaging_mass_per_pallet_kg);
  const calculatedPalletMassKg = staticMassMode === "calculated_pallet_composition" ? productMassPerPalletKg + packagingMassPerPalletKg : positiveNumber(input?.calculatedPalletMassKg ?? input?.calculated_pallet_mass_kg);
  const calculatedCartMassKg = positiveNumber(input?.calculatedCartMassKg ?? input?.calculated_cart_mass_kg);
  const calculatedBatchMassKg = positiveNumber(input?.calculatedBatchMassKg ?? input?.calculated_batch_mass_kg);
  const palletMassKg = positiveNumber(input?.palletMassKg ?? input?.pallet_mass_kg) || calculatedPalletMassKg;
  const savedStaticMassKg = positiveNumber(input?.staticMassKg ?? input?.static_mass_kg);
  const directBatchMassKg = positiveNumber(input?.directBatchMassKg ?? input?.direct_batch_mass_kg);
  const resolvedStaticMassKg = staticMassMode === "calculated_cart_composition" ? calculatedCartMassKg * numberOfCarts : staticMassMode === "direct_cart_mass" ? palletMassKg * numberOfCarts : staticMassMode === "calculated_batch_composition" ? calculatedBatchMassKg : staticMassMode === "direct_batch_mass" ? directBatchMassKg : calculatedPalletMassKg * numberOfPallets || palletMassKg * numberOfPallets;
  return {
    numberOfPallets,
    numberOfCarts,
    calculatedPalletMassKg,
    calculatedCartMassKg,
    calculatedBatchMassKg,
    palletMassKg,
    unitsPerPallet,
    productMassPerPalletKg,
    packagingMassPerPalletKg,
    staticMassKg: savedStaticMassKg || resolvedStaticMassKg,
  };
}

function requiredPositiveFields(input: any, isStatic: boolean, staticMassKg: number, characteristicDimensionM: number, crossesFreezing: boolean, airVelocityUsedMS: number, continuousMassMode: string): string[] {
  const commonNumericFields = ["initialTempC", "finalTempC", "freezingPointC"];
  const commonPositiveFields = ["cpAboveKJkgK"];
  const freezingPositiveFields = crossesFreezing ? ["cpBelowKJkgK", "latentHeatKJkg", "frozenWaterFraction"] : [];
  const missingNumericFields = commonNumericFields.filter((field) => !isProvided(input?.[field]) || !Number.isFinite(Number(input?.[field])));
  const missingPositiveFields = [...commonPositiveFields, ...freezingPositiveFields].filter((field) => !isProvided(input?.[field]) || toNumber(input?.[field], 0) <= 0);
  const hasHInput = positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0 || airVelocityUsedMS > 0;
  const geometry = String(input?.productGeometry ?? input?.product_geometry ?? "slab");
  const airflowSource = String(input?.airflowSource ?? input?.airflow_source ?? "manual_velocity");

  const continuousFields = [
    continuousMassRequirement(input, continuousMassMode),
    positiveNumber(input?.retentionTimeMin) <= 0 ? "tempo de retenção" : "",
  ];
  const staticFields = [
    staticMassKg <= 0 ? "massa total da batelada" : "",
    positiveNumber(input?.batchTimeH) <= 0 ? "tempo de batelada" : "",
    !input?.productGeometry && !input?.product_geometry ? "geometria do produto" : "",
    characteristicDimensionM <= 0 ? "dimensão crítica para tempo até o núcleo" : "",
  ];

  return [
    ...missingNumericFields,
    ...missingPositiveFields,
    ...(isStatic ? staticFields : continuousFields),
    airflowSource === "airflow_by_fans" && positiveNumber(input?.fanAirflowM3H ?? input?.fan_airflow_m3_h) <= 0 ? "fan_airflow_m3_h" : "",
    airflowSource === "airflow_by_fans" && positiveNumber(input?.tunnelCrossSectionWidthM ?? input?.tunnel_cross_section_width_m) <= 0 ? "tunnel_cross_section_width_m" : "",
    airflowSource === "airflow_by_fans" && positiveNumber(input?.tunnelCrossSectionHeightM ?? input?.tunnel_cross_section_height_m) <= 0 ? "tunnel_cross_section_height_m" : "",
    geometry === "slab" && positiveNumber(input?.productThicknessM ?? input?.product_thickness_m) <= 0 ? "espessura do produto" : "",
    geometry === "rectangular_prism" && positiveNumber(input?.productLengthM ?? input?.product_length_m) <= 0 ? "product_length_m" : "",
    geometry === "rectangular_prism" && positiveNumber(input?.productWidthM ?? input?.product_width_m) <= 0 ? "product_width_m" : "",
    geometry === "rectangular_prism" && positiveNumber(input?.productHeightM ?? input?.product_height_m) <= 0 ? "product_height_m" : "",
    geometry === "cube" && positiveNumber(input?.productSideM ?? input?.product_side_m) <= 0 ? "product_side_m" : "",
    geometry === "cylinder" && positiveNumber(input?.productDiameterM ?? input?.product_diameter_m) <= 0 ? "product_diameter_m" : "",
    geometry === "cylinder" && positiveNumber(input?.productLengthM ?? input?.product_length_m) <= 0 ? "product_length_m" : "",
    geometry === "sphere" && positiveNumber(input?.productDiameterM ?? input?.product_diameter_m) <= 0 ? "product_diameter_m" : "",
    geometry === "packed_box" && positiveNumber(input?.boxLengthM ?? input?.box_length_m) <= 0 ? "box_length_m" : "",
    geometry === "packed_box" && positiveNumber(input?.boxWidthM ?? input?.box_width_m) <= 0 ? "box_width_m" : "",
    geometry === "packed_box" && positiveNumber(input?.boxHeightM ?? input?.box_height_m) <= 0 ? "box_height_m" : "",
    geometry === "irregular" && positiveNumber(input?.characteristicDimensionM ?? input?.characteristic_dimension_m) <= 0 ? "characteristic_dimension_m" : "",
    !hasHInput && (isStatic || positiveNumber(input?.airVelocityMS) <= 0) ? "velocidade do ar ou vazão dos ventiladores" : "",
  ];
}

function canEstimateFreezingTime(input: any, distanceToCoreM: number, hEffectiveWM2K: number | null, kEffectiveWMK: number): boolean {
  return (
    positiveNumber(input?.densityKgM3) > 0 &&
    positiveNumber(input?.latentHeatKJkg) > 0 &&
    positiveNumber(input?.frozenWaterFraction) > 0 &&
    distanceToCoreM > 0 &&
    toNumber(hEffectiveWM2K, 0) > 0 &&
    kEffectiveWMK > 0 &&
    isProvided(input?.airTempC) &&
    isProvided(input?.freezingPointC)
  );
}

function productLoadMissingFields(input: any, isStatic: boolean, staticMassKg: number, usedMassKgH: number, energy: ReturnType<typeof calculateProductSpecificEnergy>): string[] {
  return unique([
    isStatic && staticMassKg <= 0 ? "massa total da batelada" : "",
    isStatic && positiveNumber(input?.batchTimeH) <= 0 ? "tempo de batelada" : "",
    !isStatic && usedMassKgH <= 0 ? "massa processada em kg/h" : "",
    !isProvided(input?.initialTempC) ? "temperatura inicial do produto" : "",
    !isProvided(input?.finalTempC) ? "temperatura final do produto" : "",
    !isProvided(input?.freezingPointC) ? "temperatura de congelamento" : "",
    positiveNumber(input?.cpAboveKJkgK) <= 0 ? "Cp acima do congelamento" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.cpBelowKJkgK) <= 0 ? "Cp abaixo do congelamento" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.latentHeatKJkg) <= 0 ? "calor latente" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.frozenWaterFraction) <= 0 ? "fração congelável" : "",
  ]);
}

function calculateModelH(input: any, _physicalModel: TunnelPhysicalModel, airVelocityUsedMS: number, exposureFactor: number) {
  return calculateConvectiveCoefficient({
    airVelocityMS: airVelocityUsedMS,
    manualCoefficientWM2K: input?.manualConvectiveCoefficientWM2K,
    airExposureFactor: input?.airExposureFactor,
    exposureFactor,
  });
}

function calculateTunnelCore(input: any) {
  const processType = input?.processType ?? input?.process_type ?? null;
  const tunnelMode = resolveTunnelMode(input);
  const physicalModel = normalizePhysicalModel(input);
  const modelMeta = MODEL_META[physicalModel];
  const mode = tunnelMode.operationRegime;
  const isStatic = tunnelMode.isStatic;
  const spiralTurbulenceFactor = positiveNumber(input?.spiralTurbulenceFactor) || 1.8;
  const blockExposureFactor = positiveNumber(input?.blockExposureFactor) || 0.7;

  const validationInput = {
    ...input,
    densityKgM3: positiveNumber(input?.densityKgM3) > 0 ? input?.densityKgM3 : undefined,
    frozenConductivityWMK: positiveNumber(input?.frozenConductivityWMK) > 0 ? input?.frozenConductivityWMK : undefined,
    airVelocityMS: positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0 || positiveNumber(input?.airVelocityMS) > 0 ? input?.airVelocityMS : undefined,
  };
  const validation = validateTunnelInput(validationInput);

  const continuousMassMode = String(input?.continuousMassMode ?? input?.continuous_mass_mode ?? input?.massFlowMode ?? input?.mass_flow_mode ?? "direct_mass_flow");
  const unitWeightKg = positiveNumber(input?.unitWeightKg);
  const massByCycleKgH = unitWeightKg * positiveNumber(input?.unitsPerCycle) * positiveNumber(input?.cyclesPerHour);
  const massByTrayKgH = (unitWeightKg * positiveNumber(input?.unitsPerTray) + positiveNumber(input?.trayWeightKg)) * positiveNumber(input?.traysPerHour);
  const massByUnitsHourKgH = unitWeightKg * positiveNumber(input?.unitsPerHour);
  const beltUnitsPerHour = positiveNumber(input?.unitsPerRow) * positiveNumber(input?.rowsPerMeter) * positiveNumber(input?.beltSpeedMMin) * 60;
  const massByBeltKgH = beltUnitsPerHour * unitWeightKg;
  const massByFeedRateKgH = positiveNumber(input?.feedRateKgH);
  const calculatedMassKgH = continuousMassMode === "calculated_by_trays" ? massByTrayKgH : continuousMassMode === "calculated_by_units_per_hour" ? massByUnitsHourKgH : continuousMassMode === "calculated_by_belt_loading" ? massByBeltKgH : continuousMassMode === "calculated_by_feed_rate" ? massByFeedRateKgH : massByCycleKgH;
  const directMassKgH = positiveNumber(input?.directMassKgH);
  const usedMassKgH = tunnelMode.operationRegime === "batch" ? 0 : continuousMassMode === "direct_mass_flow" && directMassKgH > 0 ? directMassKgH : calculatedMassKgH;
  const staticMass = resolveStaticMass(input);
  const palletMassKg = staticMass.palletMassKg;
  const numberOfPallets = staticMass.numberOfPallets;
  const calculatedPalletMassKg = staticMass.calculatedPalletMassKg;
  const staticMassKg = tunnelMode.operationRegime === "batch" ? staticMass.staticMassKg : positiveNumber(input?.staticMassKg ?? input?.static_mass_kg) || palletMassKg * Math.max(1, numberOfPallets || 1);
  const airDeltaTK = positiveNumber(input?.airDeltaTK) || 6;
  const airDensityKgM3 = positiveNumber(input?.airDensityKgM3) || 1.2;
  const suggestedAirApproachK = positiveNumber(input?.suggestedAirApproachK) || 8;
  const airFlowMethod = "thermal_balance_estimate";
  const suggestedAirMethod = "process_temperature_estimate";
  const cpAirKJkgK = 1.005;
  const suggestedAirTempC = toNumber(input?.finalTempC, 0) - suggestedAirApproachK;
  const informedAirTempC = isProvided(input?.airTempC) ? toNumber(input?.airTempC, 0) : null;
  const suggestedAirTempComparisonC = informedAirTempC === null ? null : informedAirTempC - suggestedAirTempC;
  const informedAirFlowM3H = nullableNumber(input?.informedAirFlowM3H ?? input?.airflow_m3_h);

  const geometry = calculateCharacteristicDimension({ ...input, isStatic: tunnelMode.isStatic });
  const fallbackCharacteristicDimensionM = isStatic
    ? getSmallestValidDimension([input?.palletLengthM, input?.palletWidthM, input?.palletHeightM])
    : positiveNumber(input?.productThicknessM);
  const characteristicDimensionM = geometry.characteristicDimensionM || fallbackCharacteristicDimensionM;
  const distanceToCoreM = geometry.distanceToCoreM || (characteristicDimensionM > 0 ? characteristicDimensionM / 2 : 0);
  const airflow = calculateAirflowModel(input);
  const exposure = calculateExposureFactor(input);
  const airVelocityUsedMS = airflow.airVelocityUsedMS ?? 0;
  const h = calculateModelH(input, physicalModel, airVelocityUsedMS, exposure.exposureFactor);

  const frozenConductivityWMK = positiveNumber(input?.frozenConductivityWMK);
  const thermalPenetrationFactor = positiveNumber(input?.thermalPenetrationFactor);
  const kEffectiveWMK = frozenConductivityWMK > 0 && thermalPenetrationFactor > 0 ? frozenConductivityWMK * thermalPenetrationFactor : 0;

  const energy = calculateProductSpecificEnergy({
    initialTempC: input?.initialTempC,
    finalTempC: input?.finalTempC,
    freezingPointC: input?.freezingPointC,
    cpAboveKJkgK: input?.cpAboveKJkgK,
    cpBelowKJkgK: input?.cpBelowKJkgK,
    latentHeatKJkg: input?.latentHeatKJkg,
    frozenWaterFraction: input?.frozenWaterFraction,
    allowPhaseChange: input?.allowPhaseChange,
  });

  const productLoadKW = tunnelMode.operationRegime === "batch"
    ? calculateBatchProductLoadKW({ massKg: staticMassKg, specificEnergyKJkg: energy.totalKJkg, timeH: input?.batchTimeH })
    : calculateContinuousProductLoadKW({ massKgH: usedMassKgH, specificEnergyKJkg: energy.totalKJkg });
  const productLoadMissing = productLoadMissingFields(input, tunnelMode.operationRegime === "batch", staticMassKg, usedMassKgH, energy);

  const productEnergyBreakdown = {
    sensibleAboveKJkg: energy.sensibleAboveKJkg,
    latentKJkg: energy.latentKJkg,
    sensibleBelowKJkg: energy.sensibleBelowKJkg,
    totalKJkg: energy.totalKJkg,
    crossesFreezing: energy.crossesFreezingPoint,
  };

  const packagingMassKgBatch = positiveNumber(input?.packagingMassKgBatch ?? input?.packaging_mass_kg_batch);
  const packagingMassKgH = tunnelMode.operationRegime === "batch" && packagingMassKgBatch > 0 && positiveNumber(input?.batchTimeH) > 0 ? packagingMassKgBatch / positiveNumber(input?.batchTimeH) : positiveNumber(input?.packagingMassKgH);
  const packagingCpKJkgK = positiveNumber(input?.packagingCpKJkgK);
  const packagingLoadKW = packagingMassKgH > 0 && packagingCpKJkgK > 0 ? packagingMassKgH * packagingCpKJkgK * Math.abs(toNumber(input?.initialTempC) - toNumber(input?.finalTempC)) / 3600 : 0;
  const internalLoadKW = toNumber(input?.beltMotorKW, 0) + toNumber(input?.internalFansKW, 0) + toNumber(input?.otherInternalKW, 0);
  const totalKW = productLoadKW + packagingLoadKW + internalLoadKW;
  const totalKcalH = kwToKcalH(totalKW);
  const totalTR = kwToTr(totalKW);
  const airFlowM3H = airDeltaTK > 0 && airDensityKgM3 > 0 ? (totalKW * 3600) / (airDensityKgM3 * cpAirKJkgK * airDeltaTK) : 0;
  const airFlowThermalBalanceM3H = airFlowM3H;

  const estimatedTimeMin = canEstimateFreezingTime(input, distanceToCoreM, h.hEffectiveWM2K, kEffectiveWMK)
    ? calculatePlankFreezingTimeMin({
        densityKgM3: input?.densityKgM3,
        latentHeatKJkg: input?.latentHeatKJkg,
        frozenWaterFraction: input?.frozenWaterFraction,
        freezingPointC: input?.freezingPointC,
        airTempC: input?.airTempC,
        distanceToCoreM,
        hEffectiveWM2K: h.hEffectiveWM2K,
        kEffectiveWMK,
      })
    : null;
  const availableTimeMin = tunnelMode.operationRegime === "batch" ? positiveNumber(input?.batchTimeH) * 60 : positiveNumber(input?.retentionTimeMin);

  const hasManualH = positiveNumber(input?.manualConvectiveCoefficientWM2K) > 0;
  const airVelocityMS = airVelocityUsedMS;
  const airVelocityLimitWarnings = [
    airVelocityMS > 0 && airVelocityMS < positiveNumber(input?.minAirVelocityMS ?? input?.min_air_velocity_m_s) ? "Velocidade do ar abaixo do limite operacional informado." : "",
    positiveNumber(input?.maxAirVelocityMS ?? input?.max_air_velocity_m_s) > 0 && airVelocityMS > positiveNumber(input?.maxAirVelocityMS ?? input?.max_air_velocity_m_s) ? "Velocidade do ar acima do limite operacional informado." : "",
  ];
  const airFlowDeviation = informedAirFlowM3H !== null && airFlowM3H > 0 ? Math.abs(informedAirFlowM3H - airFlowM3H) / airFlowM3H : 0;
  const engineWarnings = [
    !isStatic && directMassKgH > 0 && calculatedMassKgH > 0 && Math.abs(directMassKgH - calculatedMassKgH) / calculatedMassKgH * 100 > 15 ? `Massa direta difere da massa por cadência em ${(Math.abs(directMassKgH - calculatedMassKgH) / calculatedMassKgH * 100).toFixed(1)}%.` : "",
    suggestedAirTempComparisonC !== null && suggestedAirTempComparisonC > 5 ? "Temperatura do ar informada pode ser insuficiente para atingir a temperatura final do produto no tempo desejado." : "",
    airFlowDeviation > 0.2 ? "Vazão de ar informada diverge da vazão necessária pela carga térmica em mais de 20%." : "",
    informedAirFlowM3H !== null && airFlowM3H > 0 && informedAirFlowM3H < airFlowM3H * 0.95 ? "Vazão dos ventiladores informada abaixo da vazão necessária pela carga térmica." : "",
    productLoadKW <= 0 && productLoadMissing.length > 0 ? `Carga térmica do produto não calculada: falta ${productLoadMissing.join(", ")}.` : "",
    hasManualH && positiveNumber(input?.manualConvectiveCoefficientWM2K) < 25 && energy.crossesFreezingPoint ? "h manual muito baixo para congelamento rápido." : "",
    isProvided(input?.thermalPenetrationFactor) && toNumber(input?.thermalPenetrationFactor) <= 0 ? "Fator de penetração térmica deve ser maior que zero." : "",
    isProvided(input?.airExposureFactor) && toNumber(input?.airExposureFactor) <= 0 ? "Fator de exposição ao ar deve ser maior que zero." : "",
    ...airVelocityLimitWarnings,
    physicalModel === "continuous_individual" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 1 ? "Velocidade do ar baixa para túnel contínuo individual (< 1 m/s)." : "",
    physicalModel === "continuous_spiral" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 2 ? "Velocidade do ar baixa para girofreezer contínuo (< 2 m/s)." : "",
    physicalModel === "continuous_spiral" && (spiralTurbulenceFactor < 1.2 || spiralTurbulenceFactor > 3) ? "Fator de turbulência do girofreezer fora da faixa recomendada de 1,2 a 3,0." : "",
    physicalModel === "static_cart" && positiveNumber(input?.productThicknessM) <= 0 ? "Espessura do produto ausente para estático em carrinho." : "",
    physicalModel === "static_cart" && positiveNumber(input?.batchTimeH) <= 0 ? "Tempo de batelada ausente para estático em carrinho." : "",
    physicalModel === "static_cart" && !hasManualH && airVelocityMS > 0 && airVelocityMS < 1 ? "Velocidade do ar baixa para estático em carrinho (< 1 m/s)." : "",
    physicalModel === "static_block" && characteristicDimensionM <= 0 ? "Dimensões do bloco/pallet ausentes para estático em pallet/bloco." : "",
    physicalModel === "static_block" ? "Modelo static_block é conservador para bloco compacto/pallet." : "",
    physicalModel === "static_block" && positiveNumber(input?.batchTimeH) <= 0 ? "Tempo de batelada ausente para estático em pallet/bloco." : "",
  ];

  const freezingTimeMissingFields = [
    positiveNumber(input?.densityKgM3) <= 0 ? "densidade do produto" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.latentHeatKJkg) <= 0 ? "calor latente" : "",
    energy.crossesFreezingPoint && positiveNumber(input?.frozenWaterFraction) <= 0 ? "fração congelável" : "",
    !isProvided(input?.freezingPointC) ? "temperatura de congelamento" : "",
    !isProvided(input?.airTempC) ? "temperatura do ar" : "",
    distanceToCoreM <= 0 ? "dimensão crítica para tempo até o núcleo" : "",
    toNumber(h.hEffectiveWM2K, 0) <= 0 ? "coeficiente convectivo efetivo" : "",
    positiveNumber(input?.frozenConductivityWMK) <= 0 ? "condutividade congelada" : "",
    positiveNumber(input?.thermalPenetrationFactor) <= 0 ? "fator de penetração térmica" : "",
  ];
  const invalidFields = unique([
    ...validation.invalidFields,
    ...airflow.invalidFields,
    isProvided(input?.thermalPenetrationFactor) && toNumber(input?.thermalPenetrationFactor) <= 0 ? "thermalPenetrationFactor" : "",
    isProvided(input?.airExposureFactor) && toNumber(input?.airExposureFactor) <= 0 ? "airExposureFactor" : "",
  ]);
  const missingFields = unique([
    ...validation.missingFields,
    ...tunnelMode.missingFields,
    ...geometry.missingFields,
    ...airflow.missingFields,
    ...requiredPositiveFields(input, isStatic, staticMassKg, characteristicDimensionM, energy.crossesFreezingPoint, airVelocityUsedMS, continuousMassMode),
    ...freezingTimeMissingFields,
  ]);
  const warnings = unique([...validation.warnings, ...tunnelMode.warnings, ...geometry.warnings, ...exposure.warnings, ...airflow.warnings, ...engineWarnings]);

  const status: TunnelScenarioStatus = invalidFields.length > 0
    ? "invalid_input"
    : missingFields.length > 0
      ? "missing_data"
      : estimatedTimeMin !== null && estimatedTimeMin <= availableTimeMin
        ? "adequate"
        : estimatedTimeMin !== null && estimatedTimeMin > availableTimeMin
          ? "insufficient"
          : "missing_data";

  const scenario: TunnelThermalScenario = {
    airTempC: nullableNumber(input?.airTempC),
    airVelocityMS: nullableNumber(airflow.airVelocityUsedMS),
    airDeltaTK,
    airFlowM3H,
    airFlowThermalBalanceM3H,
    informedAirFlowM3H,
    suggestedAirTempC,
    hEffectiveWM2K: nullableNumber(h.hEffectiveWM2K),
    hSource: h.source,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    estimatedTimeMin,
    availableTimeMin,
    status,
    warnings,
    missingFields,
    invalidFields,
  };

  const calculationBreakdown = {
    model: {
      tunnelType: tunnelMode.tunnelType,
      arrangementType: tunnelMode.arrangementType,
      operationRegime: tunnelMode.operationRegime,
      physicalModel,
      physicalModelLabel: modelMeta.label,
      physicalDescription: modelMeta.physicalDescription,
      geometryAssumption: modelMeta.geometryAssumption,
      convectionAssumption: modelMeta.convectionAssumption,
    },
    mass: tunnelMode.operationRegime === "batch"
      ? { mode: "batch", staticMassMode: input?.staticMassMode ?? input?.static_mass_mode ?? "direct_pallet_mass", numberOfPallets, numberOfCarts: staticMass.numberOfCarts, palletMassKg, calculatedPalletMassKg, calculatedCartMassKg: staticMass.calculatedCartMassKg, calculatedBatchMassKg: staticMass.calculatedBatchMassKg, unitsPerPallet: staticMass.unitsPerPallet, productMassPerPalletKg: staticMass.productMassPerPalletKg, packagingMassPerPalletKg: staticMass.packagingMassPerPalletKg, staticMassKg, calculatedMassKgH: null, usedMassKgH: null, batchTimeH: input?.batchTimeH ?? null }
      : { mode: "continuous", continuousMassMode, calculatedMassKgH, directMassKgH, usedMassKgH, beltUnitsPerHour, retentionTimeMin: input?.retentionTimeMin ?? null },
    geometry: { tunnelType: tunnelMode.tunnelType, arrangementType: tunnelMode.arrangementType, productGeometry: input?.productGeometry ?? input?.product_geometry ?? null, surfaceExposureModel: exposure.surfaceExposureModel, thermalModelForPallet: geometry.thermalModelForPallet ?? input?.thermalModelForPallet ?? input?.thermal_model_for_pallet ?? null, characteristicDimensionM, distanceToCoreM, geometrySource: geometry.source },
    productEnergy: productEnergyBreakdown,
    convection: { source: h.source, hBaseWM2K: h.hBaseWM2K, hEffectiveWM2K: h.hEffectiveWM2K, airVelocityMS: airflow.airVelocityUsedMS, airExposureFactor: input?.airExposureFactor ?? null, exposureFactor: exposure.exposureFactor, spiralTurbulenceFactor, blockExposureFactor },
    airflow: { airflowSource: airflow.airflowSource, fanAirflowM3H: airflow.fanAirflowM3H, grossAirAreaM2: airflow.grossAreaM2, freeAirAreaM2: airflow.freeAreaM2, blockageFactor: airflow.blockageFactor, calculatedAirVelocityMS: airflow.calculatedAirVelocityMS, airVelocityUsedMS: airflow.airVelocityUsedMS },
    heatTransfer: { hBaseWM2K: h.hBaseWM2K, exposureFactor: exposure.exposureFactor, airExposureFactor: input?.airExposureFactor ?? null, hEffectiveWM2K: h.hEffectiveWM2K, hSource: h.source },
    air: { airTempC: input?.airTempC ?? null, airDeltaTK, airDensityKgM3, airFlowM3H, informedAirFlowM3H, airFlowMethod, suggestedAirTempC, suggestedAirMethod, suggestedAirApproachK, comparison: suggestedAirTempComparisonC },
    scenarios: { adjustedScenario: scenario },
    loads: { productLoadKW, packagingLoadKW, internalLoadKW, totalKW, totalKcalH, totalTR, packagingMassKgH, packagingMassKgBatch, productLoadMissingFields: productLoadMissing, loadCalculationReady: productLoadMissing.length === 0, massUsedForProductLoad: tunnelMode.operationRegime === "batch" ? staticMassKg : usedMassKgH, massUnitForProductLoad: tunnelMode.operationRegime === "batch" ? "kg/batelada" : "kg/h", airFlowThermalBalanceM3H },
    timing: { estimatedTimeMin, availableTimeMin, status },
    validation: { warnings, missingFields, invalidFields },
  };

  const formulasUsed = {
    physicalModel: "normalized processType/tunnelMode/operationMode",
    calculatedMassKgH: "conforme modo: unidade×ciclo, bandeja×hora, unidade×hora, carregamento da esteira ou taxa de alimentação",
    h: "manualCoefficientWM2K || (10 + 10 × airVelocityUsedMS^0.8) × exposureFactor × airExposureFactor",
    kEffectiveWMK: "frozenConductivityWMK × thermalPenetrationFactor",
    continuousProductLoadKW: "massKgH × specificEnergyKJkg / 3600",
    batchProductLoadKW: "massKg × specificEnergyKJkg / (timeH × 3600)",
    packagingLoadKW: "packagingMassKgH × packagingCpKJkgK × abs(initialTempC - finalTempC) / 3600",
    internalLoadKW: "beltMotorKW + internalFansKW + otherInternalKW",
    totalKW: "productLoadKW + packagingLoadKW + internalLoadKW",
    airFlowM3H: "totalKW × 3600 / (airDensityKgM3 × 1.005 × airDeltaTK)",
    suggestedAirTempC: "finalTempC - suggestedAirApproachK",
    plankFreezingTime: "Plank equation using density, latent heat, core distance, h and effective k",
  };

  const resultSummary = { physicalModel, processType, status, productLoadKW, packagingLoadKW, internalLoadKW, totalKW, estimatedTimeMin, availableTimeMin };
  const calculationLog = buildCalculationLog({ originalInput: input, normalizedInput: { ...input, physicalModel, mode }, unitConversions: input?.unitConversions ?? null, warnings, missingFields, invalidFields, formulasUsed, resultSummary });

  return {
    physicalModel,
    physicalModelLabel: modelMeta.label,
    mode,
    processType,
    tunnelType: tunnelMode.tunnelType,
    arrangementType: tunnelMode.arrangementType,
    operationRegime: tunnelMode.operationRegime,
    productGeometry: input?.productGeometry ?? input?.product_geometry ?? null,
    surfaceExposureModel: exposure.surfaceExposureModel,
    airflowSource: airflow.airflowSource,
    fanAirflowM3H: airflow.fanAirflowM3H,
    grossAirAreaM2: airflow.grossAreaM2,
    freeAirAreaM2: airflow.freeAreaM2,
    blockageFactor: airflow.blockageFactor,
    calculatedAirVelocityMS: airflow.calculatedAirVelocityMS,
    airVelocityUsedMS: airflow.airVelocityUsedMS,
    exposureFactor: exposure.exposureFactor,
    geometrySource: geometry.source,
    thermalModelForPallet: geometry.thermalModelForPallet ?? input?.thermalModelForPallet ?? input?.thermal_model_for_pallet ?? null,
    isStatic,
    calculatedMassKgH,
    usedMassKgH,
    continuousMassMode,
    staticMassKg,
    staticMassMode: input?.staticMassMode ?? input?.static_mass_mode ?? "direct_pallet_mass",
    palletMassKg,
    calculatedPalletMassKg,
    calculatedCartMassKg: staticMass.calculatedCartMassKg,
    calculatedBatchMassKg: staticMass.calculatedBatchMassKg,
    unitsPerPallet: staticMass.unitsPerPallet,
    productMassPerPalletKg: staticMass.productMassPerPalletKg,
    packagingMassPerPalletKg: staticMass.packagingMassPerPalletKg,
    characteristicDimensionM,
    distanceToCoreM,
    energy,
    h,
    kEffectiveWMK,
    estimatedTimeMin,
    availableTimeMin,
    airFlowM3H,
    informedAirFlowM3H,
    airflow,
    airFlowMethod,
    suggestedAirTempC,
    suggestedAirMethod,
    suggestedAirApproachK,
    airDeltaTK,
    productLoadKW,
    packagingLoadKW,
    internalLoadKW,
    totalKW,
    totalKcalH,
    totalTR,
    status,
    warnings,
    missingFields,
    invalidFields,
    scenario,
    calculationBreakdown,
    calculationLog,
  };
}

function buildApprovedScenario(input: any): TunnelThermalScenario | null {
  if (!input?.thermalConditionApproved && !input?.thermal_condition_approved) return null;
  return {
    airTempC: nullableNumber(input?.approvedAirTempC ?? input?.approved_air_temp_c),
    airVelocityMS: nullableNumber(input?.approvedAirVelocityMS ?? input?.approved_air_velocity_m_s),
    airDeltaTK: positiveNumber(input?.approvedAirDeltaTK ?? input?.approved_air_delta_t_k) || 0,
    airFlowM3H: positiveNumber(input?.approvedAirFlowM3H ?? input?.approved_air_flow_m3_h),
    airFlowThermalBalanceM3H: positiveNumber(input?.approvedAirFlowM3H ?? input?.approved_air_flow_m3_h),
    informedAirFlowM3H: nullableNumber(input?.approvedAirFlowM3H ?? input?.approved_air_flow_m3_h),
    suggestedAirTempC: nullableNumber(input?.approvedSuggestedAirTempC ?? input?.suggestedAirTempC) ?? 0,
    hEffectiveWM2K: nullableNumber(input?.approvedConvectiveCoefficientWM2K ?? input?.approved_convective_coefficient_w_m2_k),
    hSource: "approved",
    productLoadKW: positiveNumber(input?.productLoadKW),
    packagingLoadKW: positiveNumber(input?.packagingLoadKW),
    internalLoadKW: positiveNumber(input?.internalLoadKW),
    totalKW: positiveNumber(input?.approvedTotalKW ?? input?.approved_total_kw),
    totalKcalH: positiveNumber(input?.approvedTotalKcalH ?? input?.approved_total_kcal_h),
    totalTR: positiveNumber(input?.approvedTotalTR ?? input?.approved_total_tr),
    estimatedTimeMin: nullableNumber(input?.approvedEstimatedTimeMin ?? input?.approved_estimated_time_min),
    availableTimeMin: positiveNumber(input?.approvedAvailableTimeMin ?? input?.availableTimeMin ?? input?.retentionTimeMin) || 0,
    status: String(input?.approvedProcessStatus ?? input?.approved_process_status ?? "adequate") as TunnelScenarioStatus,
    warnings: [],
    missingFields: [],
    invalidFields: [],
  };
}

export function calculateTunnelEngine(input: any) {
  const adjusted = calculateTunnelCore(input);
  const initialInput = input?.initialScenarioInput ?? input?.initial_scenario_input ?? input;
  const initial = initialInput === input ? adjusted : calculateTunnelCore({ ...input, ...initialInput, initialScenarioInput: undefined, initial_scenario_input: undefined, thermalConditionApproved: false, thermal_condition_approved: false });
  const approvedScenario = buildApprovedScenario(input);

  const calculationBreakdown = {
    ...adjusted.calculationBreakdown,
    engine: {
      version: COLDPRO_TUNNEL_ENGINE_VERSION,
      calculatedAt: new Date().toISOString(),
      source: "calculateTunnelEngine",
    },
    scenarios: {
      initialScenario: initial.scenario,
      adjustedScenario: adjusted.scenario,
      approvedScenario,
    },
  };
  const calculationLog = buildCalculationLog({
    ...(adjusted.calculationLog ?? {}),
    resultSummary: {
      ...(adjusted.calculationLog?.resultSummary ?? {}),
      initialStatus: initial.scenario.status,
      adjustedStatus: adjusted.scenario.status,
      approvedStatus: approvedScenario?.status ?? null,
    },
  });

  return {
    ...adjusted,
    engineVersion: COLDPRO_TUNNEL_ENGINE_VERSION,
    calculatedAt: calculationBreakdown.engine.calculatedAt,
    estimatedAirflowM3H: adjusted.airFlowM3H,
    airFlowThermalBalanceM3H: adjusted.airFlowM3H,
    initialScenario: initial.scenario,
    adjustedScenario: adjusted.scenario,
    approvedScenario,
    calculationBreakdown,
    calculationLog,
  };
}
