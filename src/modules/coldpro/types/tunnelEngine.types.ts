export type TunnelOperationRegime = "continuous" | "batch";

export type TunnelProcessStatus = "adequate" | "insufficient" | "missing_data" | "invalid_input";

export type TunnelType = "continuous_belt" | "spiral_girofreezer" | "static_cart" | "static_pallet" | "fluidized_bed" | "blast_freezer" | string;

export type TunnelArrangementType = string;

export type ProductGeometry = "slab" | "rectangular_prism" | "cube" | "cylinder" | "sphere" | "packed_box" | "bulk" | "irregular" | string;

export type AirflowSource = "manual_velocity" | "airflow_by_fans" | string;

export interface TunnelEngineInput {
  [key: string]: unknown;
  processType?: string | null;
  operationMode?: string | null;
  tunnelType?: TunnelType | null;
  arrangementType?: TunnelArrangementType | null;
  productGeometry?: ProductGeometry | null;
  surfaceExposureModel?: string | null;
  thermalModelForPallet?: string | null;
  unitWeightKg?: number | null;
  massKgH?: number | null;
  directMassKgH?: number | null;
  calculatedMassKgH?: number | null;
  usedMassKgH?: number | null;
  staticMassKg?: number | null;
  palletMassKg?: number | null;
  numberOfPallets?: number | null;
  batchTimeH?: number | null;
  retentionTimeMin?: number | null;
  unitsPerBox?: number | null;
  boxesPerLayer?: number | null;
  numberOfLayers?: number | null;
  totalUnitsPerPallet?: number | null;
  boxPackagingWeightKg?: number | null;
  palletBaseWeightKg?: number | null;
  calculatedPalletMassKg?: number | null;
  productMassPerPalletKg?: number | null;
  packagingMassPerPalletKg?: number | null;
  unitsPerPallet?: number | null;
  productLengthM?: number | null;
  productWidthM?: number | null;
  productHeightM?: number | null;
  productThicknessM?: number | null;
  productDiameterM?: number | null;
  productSideM?: number | null;
  characteristicDimensionM?: number | null;
  boxLengthM?: number | null;
  boxWidthM?: number | null;
  boxHeightM?: number | null;
  palletLengthM?: number | null;
  palletWidthM?: number | null;
  palletHeightM?: number | null;
  bulkLayerHeightM?: number | null;
  equivalentParticleDiameterM?: number | null;
  equivalentDiameterM?: number | null;
  initialTempC?: number | null;
  finalTempC?: number | null;
  airTempC?: number | null;
  freezingPointC?: number | null;
  cpAboveKJkgK?: number | null;
  cpBelowKJkgK?: number | null;
  latentHeatKJkg?: number | null;
  frozenWaterFraction?: number | null;
  densityKgM3?: number | null;
  frozenConductivityWMK?: number | null;
  thermalPenetrationFactor?: number | null;
  airflowSource?: AirflowSource | null;
  airVelocityMS?: number | null;
  manualConvectiveCoefficientWM2K?: number | null;
  airExposureFactor?: number | null;
  airDeltaTK?: number | null;
  airDensityKgM3?: number | null;
  fanAirflowM3H?: number | null;
  tunnelCrossSectionWidthM?: number | null;
  tunnelCrossSectionHeightM?: number | null;
  blockageFactor?: number | null;
  packagingMassKgH?: number | null;
  packagingCpKJkgK?: number | null;
  beltMotorKW?: number | null;
  internalFansKW?: number | null;
  otherInternalKW?: number | null;
  allowPhaseChange?: boolean;
  unitConversions?: unknown;
}

export interface TunnelEnergyBreakdown {
  sensibleAboveKJkg: number;
  latentKJkg: number;
  sensibleBelowKJkg: number;
  totalKJkg: number;
  crossesFreezing?: boolean;
  crossesFreezingPoint?: boolean;
}

export interface TunnelConvectiveResult {
  hBaseWM2K: number | null;
  hEffectiveWM2K: number | null;
  source: string;
  airExposureFactor?: number;
  exposureFactor?: number;
}

export interface TunnelEngineResult {
  [key: string]: unknown;
  processType?: string | null;
  tunnelType?: string | null;
  arrangementType?: string | null;
  operationRegime: TunnelOperationRegime;
  isStatic: boolean;
  calculatedMassKgH: number;
  usedMassKgH: number;
  continuousMassMode?: string;
  staticMassKg: number;
  staticMassMode?: string;
  palletMassKg?: number;
  calculatedPalletMassKg?: number;
  calculatedCartMassKg?: number;
  calculatedBatchMassKg?: number;
  unitsPerPallet?: number;
  productMassPerPalletKg?: number;
  packagingMassPerPalletKg?: number;
  characteristicDimensionM: number;
  distanceToCoreM: number;
  geometrySource?: string | null;
  energy: TunnelEnergyBreakdown;
  h: TunnelConvectiveResult;
  kEffectiveWMK: number;
  estimatedTimeMin: number | null;
  availableTimeMin: number;
  status: TunnelProcessStatus;
  productLoadKW: number;
  packagingLoadKW: number;
  internalLoadKW: number;
  totalKW: number;
  totalKcalH: number;
  totalTR: number;
  airFlowM3H?: number;
  airFlowMethod?: string;
  airFlowThermalBalanceM3H?: number;
  estimatedAirflowM3H?: number;
  informedAirFlowM3H?: number | null;
  suggestedAirTempC?: number;
  suggestedAirMethod?: string;
  fanAirflowM3H?: number | null;
  grossAirAreaM2?: number | null;
  freeAirAreaM2?: number | null;
  calculatedAirVelocityMS?: number | null;
  airVelocityUsedMS?: number | null;
  missingFields: string[];
  invalidFields: string[];
  warnings: string[];
  calculationBreakdown: Record<string, unknown>;
  calculationLog: Record<string, unknown>;
  engineVersion: string;
  calculatedAt: string;
}

export interface TunnelDatabasePayload {
  [key: string]: unknown;
}
