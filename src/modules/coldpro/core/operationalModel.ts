import { safeNumber } from "./units";

export type ColdProProcessMode = "batch" | "continuous" | "storage";
export type ColdProMassBasis = "direct_batch_mass" | "mass_per_pallet" | "pallet_composition" | "cart_composition" | "conveyor_flow" | "belt_surface_density" | "storage_turnover";

export type ProcessMassResolution = {
  processMode: ColdProProcessMode;
  massBasis: ColdProMassBasis;
  batchMassKg: number;
  massFlowKgH: number;
  processTimeH: number;
  warnings: string[];
  blockers: string[];
  calculatedPalletMassKg: number;
  calculatedCartMassKg: number;
  calculatedBatchMassKg: number;
  unitsPerPallet: number;
  productMassPerPalletKg: number;
  packagingMassPerPalletKg: number;
  numberOfPallets: number;
  numberOfCarts: number;
  beltSurface?: {
    method: "belt_surface_density";
    areaM2: number;
    widthM: number;
    effectiveLengthM: number;
    surfaceDensityKgM2: number;
    massOnBeltKg: number;
    linearLoadKgM: number;
    speedMMin: number;
    retentionTimeMin: number;
    calculatedRetentionMin: number;
    flowByRetentionKgH: number;
    flowBySpeedKgH: number;
    calculatedFlowKgH: number;
    nominalCapacityKgH: number;
    capacityDeviationPercent: number | null;
  } | null;
};

function positive(value: unknown): number {
  const parsed = safeNumber(value, 0);
  return parsed > 0 ? parsed : 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function tunnelType(input: any) {
  return String(input?.tunnelType ?? input?.tunnel_type ?? "").toLowerCase();
}

function pctDiff(actual: number, reference: number): number | null {
  if (actual <= 0 || reference <= 0) return null;
  return Math.abs(actual - reference) / reference * 100;
}

function isContinuous(input: any) {
  const type = tunnelType(input);
  const operation = String(input?.operationMode ?? input?.operation_mode ?? "").toLowerCase();
  return operation === "continuous" || ["continuous_belt", "spiral_girofreezer", "fluidized_bed"].includes(type);
}

function isStorage(input: any) {
  const type = String(input?.applicationType ?? input?.application_type ?? input?.environmentType ?? input?.environment_type ?? "").toLowerCase();
  return ["cold_room", "chilled_room", "freezer_room", "frozen_room", "climatized_room", "storage"].includes(type);
}

function validateDirectMassAgainstVolume(input: any, batchMassKg: number, warnings: string[]) {
  const density = positive(input?.densityKgM3 ?? input?.density_kg_m3);
  const dimensions = [
    positive(input?.palletLengthM ?? input?.pallet_length_m),
    positive(input?.palletWidthM ?? input?.pallet_width_m),
    positive(input?.palletHeightM ?? input?.pallet_height_m),
  ];
  const pallets = positive(input?.numberOfPallets ?? input?.number_of_pallets) || 1;
  const volume = dimensions.every((value) => value > 0) ? dimensions[0] * dimensions[1] * dimensions[2] * pallets : 0;
  const expected = volume > 0 && density > 0 ? volume * density : 0;
  if (expected > 0 && batchMassKg > 0) {
    const deviation = Math.abs(batchMassKg - expected) / expected;
    if (deviation > 0.35) warnings.push("Massa direta da batelada difere mais de 35% da estimativa por volume e densidade; validar ocupação, embalagem e densidade aparente.");
  }
}

export function resolveProcessMass(input: any): ProcessMassResolution {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const type = tunnelType(input);
  const processMode: ColdProProcessMode = isContinuous(input) ? "continuous" : isStorage(input) ? "storage" : "batch";
  const staticMassMode = String(input?.staticMassMode ?? input?.static_mass_mode ?? "direct_pallet_mass");
  const continuousMassMode = String(input?.continuousMassMode ?? input?.continuous_mass_mode ?? input?.massFlowMode ?? input?.mass_flow_mode ?? "direct_mass_flow");
  const numberOfPallets = positive(input?.numberOfPallets ?? input?.number_of_pallets) || 1;
  const numberOfCarts = positive(input?.numberOfCarts ?? input?.number_of_carts) || 1;
  const unitWeightKg = positive(input?.unitWeightKg ?? input?.unit_weight_kg ?? input?.product_unit_weight_kg);
  const unitsPerBox = positive(input?.unitsPerBox ?? input?.units_per_box);
  const boxesPerLayer = positive(input?.boxesPerLayer ?? input?.boxes_per_layer);
  const numberOfLayers = positive(input?.numberOfLayers ?? input?.number_of_layers);
  const totalUnitsPerPallet = positive(input?.totalUnitsPerPallet ?? input?.total_units_per_pallet);
  const unitsPerPallet = totalUnitsPerPallet || unitsPerBox * boxesPerLayer * numberOfLayers || positive(input?.unitsPerPallet ?? input?.units_per_pallet);
  const productMassPerPalletKg = unitsPerPallet * unitWeightKg || positive(input?.productMassPerPalletKg ?? input?.product_mass_per_pallet_kg);
  const packagingMassPerPalletKg = positive(input?.packagingMassPerPalletKg ?? input?.packaging_mass_per_pallet_kg) || positive(input?.boxPackagingWeightKg ?? input?.box_packaging_weight_kg) + positive(input?.palletBaseWeightKg ?? input?.pallet_base_weight_kg);
  const calculatedPalletMassKg = productMassPerPalletKg + packagingMassPerPalletKg || positive(input?.calculatedPalletMassKg ?? input?.calculated_pallet_mass_kg);
  const palletMassKg = positive(input?.palletMassKg ?? input?.pallet_mass_kg) || calculatedPalletMassKg;
  const cartCompositionMassKg = (positive(input?.unitsPerTray ?? input?.units_per_tray) * positive(input?.traysPerCart ?? input?.trays_per_cart) * unitWeightKg) + positive(input?.trayPackagingWeightKg ?? input?.tray_packaging_weight_kg) + positive(input?.cartStructureWeightKg ?? input?.cart_structure_weight_kg);
  const calculatedCartMassKg = positive(input?.calculatedCartMassKg ?? input?.calculated_cart_mass_kg) || cartCompositionMassKg;
  const calculatedBatchMassKg = positive(input?.calculatedBatchMassKg ?? input?.calculated_batch_mass_kg) || unitWeightKg * (unitsPerBox * positive(input?.boxesPerBatch ?? input?.boxes_per_batch) || unitsPerPallet) + positive(input?.packagingWeightKg ?? input?.packaging_weight_kg);
  const directBatchMassKg = positive(input?.directBatchMassKg ?? input?.direct_batch_mass_kg ?? input?.staticMassKg ?? input?.static_mass_kg);
  const directCartMassKg = positive(input?.directCartMassKg ?? input?.direct_cart_mass_kg ?? input?.massPerCartKg ?? input?.mass_per_cart_kg);

  let batchMassKg = 0;
  let massBasis: ColdProMassBasis = "direct_batch_mass";
  if (processMode === "batch") {
    if (staticMassMode === "calculated_pallet_composition" && calculatedPalletMassKg > 0) {
      batchMassKg = calculatedPalletMassKg * numberOfPallets;
      massBasis = "pallet_composition";
    } else if (staticMassMode === "calculated_cart_composition" && calculatedCartMassKg > 0) {
      batchMassKg = calculatedCartMassKg * numberOfCarts;
      massBasis = "cart_composition";
    } else if (staticMassMode === "direct_cart_mass" && directCartMassKg > 0) {
      batchMassKg = directCartMassKg * numberOfCarts;
      massBasis = "cart_composition";
    } else if (staticMassMode === "calculated_batch_composition" && calculatedBatchMassKg > 0) {
      batchMassKg = calculatedBatchMassKg;
      massBasis = "pallet_composition";
    } else if (directBatchMassKg > 0) {
      batchMassKg = directBatchMassKg;
      massBasis = "direct_batch_mass";
      validateDirectMassAgainstVolume(input, batchMassKg, warnings);
    } else if (palletMassKg > 0) {
      batchMassKg = palletMassKg * numberOfPallets;
      massBasis = "mass_per_pallet";
    }
  }

  const directMassKgH = positive(input?.directMassKgH ?? input?.massKgH ?? input?.mass_kg_hour);
  const massByTraysKgH = (unitWeightKg * positive(input?.unitsPerTray ?? input?.units_per_tray) + positive(input?.trayWeightKg ?? input?.tray_weight_kg)) * positive(input?.traysPerHour ?? input?.trays_per_hour);
  const massByUnitsHourKgH = unitWeightKg * positive(input?.unitsPerHour ?? input?.units_per_hour);
  const beltUnitsPerHour = positive(input?.unitsPerRow ?? input?.units_per_row) * positive(input?.rowsPerMeter ?? input?.rows_per_meter) * positive(input?.beltSpeedMMin ?? input?.belt_speed_m_min) * 60;
  const massByBeltKgH = beltUnitsPerHour * unitWeightKg;
  const beltWidthM = positive(input?.beltWidthM ?? input?.belt_width_m ?? input?.largura_esteira_m);
  const beltEffectiveLengthM = positive(input?.beltEffectiveLengthM ?? input?.belt_effective_length_m ?? input?.comprimento_util_esteira_m);
  const informedBeltAreaM2 = positive(input?.beltAreaM2 ?? input?.belt_area_m2 ?? input?.area_util_esteira_m2);
  const beltAreaM2 = informedBeltAreaM2 || beltWidthM * beltEffectiveLengthM;
  const beltSurfaceDensityKgM2 = positive(input?.beltSurfaceDensityKgM2 ?? input?.belt_surface_density_kg_m2 ?? input?.densidade_superficial_kg_m2);
  const beltSpeedMMin = positive(input?.beltSpeedMMin ?? input?.belt_speed_m_min ?? input?.velocidade_esteira_m_min);
  const retentionTimeMin = positive(input?.retentionTimeMin ?? input?.retention_time_min ?? input?.process_time_min ?? input?.tempo_retencao_min);
  const nominalCapacityKgH = positive(input?.beltNominalCapacityKgH ?? input?.belt_nominal_capacity_kg_h ?? input?.capacidade_nominal_kg_h);
  const informedMassOnBeltKg = positive(input?.beltMassOnBeltKg ?? input?.belt_mass_on_belt_kg ?? input?.massa_sobre_esteira_kg);
  const massOnBeltKg = informedMassOnBeltKg || beltAreaM2 * beltSurfaceDensityKgM2;
  const linearLoadKgM = beltSurfaceDensityKgM2 * beltWidthM;
  const flowByRetentionKgH = massOnBeltKg > 0 && retentionTimeMin > 0 ? massOnBeltKg / retentionTimeMin * 60 : 0;
  const flowBySpeedKgH = linearLoadKgM > 0 && beltSpeedMMin > 0 ? linearLoadKgM * beltSpeedMMin * 60 : 0;
  const massByBeltSurfaceKgH = flowByRetentionKgH || flowBySpeedKgH || nominalCapacityKgH;
  const calculatedRetentionMin = beltEffectiveLengthM > 0 && beltSpeedMMin > 0 ? beltEffectiveLengthM / beltSpeedMMin : 0;
  const beltSurface = continuousMassMode === "calculated_by_belt_surface_density" ? { method: "belt_surface_density" as const, areaM2: beltAreaM2, widthM: beltWidthM, effectiveLengthM: beltEffectiveLengthM, surfaceDensityKgM2: beltSurfaceDensityKgM2, massOnBeltKg, linearLoadKgM, speedMMin: beltSpeedMMin, retentionTimeMin, calculatedRetentionMin, flowByRetentionKgH, flowBySpeedKgH, calculatedFlowKgH: massByBeltSurfaceKgH, nominalCapacityKgH, capacityDeviationPercent: pctDiff(massByBeltSurfaceKgH, nominalCapacityKgH) } : null;
  const massByFeedRateKgH = positive(input?.feedRateKgH ?? input?.feed_rate_kg_h);
  const massByCycleKgH = unitWeightKg * positive(input?.unitsPerCycle ?? input?.units_per_cycle) * positive(input?.cyclesPerHour ?? input?.cycles_per_hour);
  const calculatedFlow = continuousMassMode === "calculated_by_trays" ? massByTraysKgH : continuousMassMode === "calculated_by_units_per_hour" ? massByUnitsHourKgH : continuousMassMode === "calculated_by_belt_loading" ? massByBeltKgH : continuousMassMode === "calculated_by_belt_surface_density" ? massByBeltSurfaceKgH : continuousMassMode === "calculated_by_feed_rate" ? massByFeedRateKgH : massByCycleKgH;
  const massFlowKgH = processMode === "continuous" ? (directMassKgH > 0 ? directMassKgH : calculatedFlow) : 0;
  if (processMode === "continuous") massBasis = "conveyor_flow";
  if (processMode === "continuous" && continuousMassMode === "calculated_by_belt_surface_density") massBasis = "belt_surface_density";
  if (processMode === "storage") massBasis = "storage_turnover";

  const processTimeH = processMode === "continuous" ? positive(input?.retentionTimeMin ?? input?.retention_time_min ?? input?.process_time_min) / 60 : positive(input?.batchTimeH ?? input?.batch_time_h ?? input?.processTimeH ?? input?.process_time_h);
  const isTunnelLike = !isStorage(input);
  if (isTunnelLike && processMode === "batch" && batchMassKg <= 0) blockers.push("massa total da batelada obrigatória para túnel/blast freezer");
  if (isTunnelLike && processMode === "continuous" && massFlowKgH <= 0) blockers.push("fluxo kg/h obrigatório para túnel contínuo/girofreezer/IQF");
  if (isTunnelLike && processTimeH <= 0) blockers.push(processMode === "continuous" ? "tempo de residência obrigatório" : "tempo de processo/batelada obrigatório");
  if (beltSurface) {
    if (beltSurface.surfaceDensityKgM2 <= 0) blockers.push("densidade superficial da esteira obrigatória em kg/m²");
    if (beltSurface.areaM2 <= 0 && (beltSurface.widthM <= 0 || beltSurface.effectiveLengthM <= 0)) blockers.push("área útil ou largura × comprimento útil da esteira obrigatórios");
    const retentionDeviation = pctDiff(beltSurface.calculatedRetentionMin, beltSurface.retentionTimeMin);
    if (retentionDeviation !== null && retentionDeviation > 10) warnings.push("Tempo de retenção informado diverge do comprimento útil e velocidade da esteira.");
    if (beltSurface.capacityDeviationPercent !== null && beltSurface.capacityDeviationPercent > 10) warnings.push("Capacidade calculada pela esteira diverge da capacidade nominal informada.");
    if (beltSurface.flowByRetentionKgH > 0 && beltSurface.flowBySpeedKgH > 0) {
      const flowDeviation = pctDiff(beltSurface.flowByRetentionKgH, beltSurface.flowBySpeedKgH);
      if (flowDeviation !== null && flowDeviation > 10) warnings.push("Fluxo por retenção diverge do fluxo por velocidade da esteira em mais de 10%.");
    }
  }
  if (batchMassKg > 0 && batchMassKg < 200 && processMode === "batch") warnings.push("Massa menor que 200 kg para túnel industrial; validar se não há subdimensionamento por massa informada baixa.");
  if (type === "static_cart") {
    if (positive(input?.traysPerCart ?? input?.trays_per_cart) <= 0) warnings.push("Número de bandejas por carrinho não informado.");
    if (positive(input?.traySpacingM ?? input?.tray_spacing_m) <= 0) warnings.push("Espaçamento entre bandejas não informado para validar passagem de ar.");
  }

  return { processMode, massBasis, batchMassKg, massFlowKgH, processTimeH, warnings: unique(warnings), blockers: unique(blockers), calculatedPalletMassKg, calculatedCartMassKg, calculatedBatchMassKg, unitsPerPallet, productMassPerPalletKg, packagingMassPerPalletKg, numberOfPallets, numberOfCarts, beltSurface };
}

export function calculateProductLoadByProcessMode(input: { processMass: ProcessMassResolution; specificEnergyKcalKg?: number | null }) {
  const energy = positive(input?.specificEnergyKcalKg);
  const mass = input.processMass;
  const blockers: string[] = [];
  if (mass.processMode === "batch") {
    if (mass.batchMassKg <= 0) blockers.push("massa <= 0");
    if (mass.processTimeH <= 0) blockers.push("tempo <= 0");
    if (energy <= 0) blockers.push("energia específica <= 0");
    const productLoadKcalH = mass.batchMassKg > 0 && mass.processTimeH > 0 && energy > 0 ? (mass.batchMassKg * energy) / mass.processTimeH : 0;
    return { productLoadKcalH, productLoadKW: productLoadKcalH / 859.845, blockers };
  }
  if (mass.processMode === "continuous") {
    if (mass.massFlowKgH <= 0) blockers.push("fluxo kg/h <= 0");
    if (mass.processTimeH <= 0) blockers.push("tempo de residência <= 0");
    if (energy <= 0) blockers.push("energia específica <= 0");
    const productLoadKcalH = mass.massFlowKgH > 0 && energy > 0 ? mass.massFlowKgH * energy : 0;
    return { productLoadKcalH, productLoadKW: productLoadKcalH / 859.845, blockers };
  }
  return { productLoadKcalH: 0, productLoadKW: 0, blockers };
}