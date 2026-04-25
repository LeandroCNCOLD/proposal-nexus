export type ColdProApplicationMode =
  | "cold_room_chilled"
  | "cold_room_frozen"
  | "seed_storage"
  | "climatized_area"
  | "continuous_girofreezer"
  | "continuous_freezing_tunnel"
  | "continuous_cooling_tunnel"
  | "static_freezing"
  | "static_cooling";

export type ColdProSurfaceType = "ceiling" | "floor" | "wall" | "door" | "glass";
export type ColdProGlassType = "none" | "vidro_simples" | "vidro_duplo" | "vidro_triplo" | "low_e_duplo" | "vidro_frigorifico_aquecido";
export type ColdProSolarLevel = "sem_sol" | "moderado" | "forte" | "critico";

export interface ColdProProjectData {
  id?: string;
  name: string;
  customerName?: string;
  applicationMode: ColdProApplicationMode;
  internalTempC: number;
  externalTempC: number;
  altitudeM: number;
  notes?: string;
}

export interface ColdProDimensions {
  lengthM: number;
  widthM: number;
  heightM: number;
  volumeM3: number;
}

export interface ColdProSurface {
  id?: string;
  surfaceType: ColdProSurfaceType;
  label: string;
  areaTotalM2: number;
  areaGlassM2: number;
  areaDoorM2: number;
  uOpaqueWM2K: number;
  uDoorWM2K: number;
  glassType: ColdProGlassType;
  solarLevel: ColdProSolarLevel;
  solarFactor: number;
  externalTempC?: number | null;
  soilTempC?: number | null;
  hasFloorInsulation?: boolean;
}

export interface ColdProProcessParameters {
  operationMode: "batch" | "continuous";
  productName: string;
  productCategory?: string;
  massKg: number;
  productionKgH: number;
  batchMassKg: number;
  batchTimeH: number;
  inletTempC: number;
  outletTempC: number;
  freezingTempC: number;
  cpAboveKjKgK: number;
  cpBelowKjKgK: number;
  latentHeatKjKg: number;
  freezableFraction: number;
  specificLoadKjKg?: number | null;
  retentionTimeMin?: number | null;
  productThicknessM?: number | null;
  productDensityKgM3?: number | null;
  productThermalConductivityWMK?: number | null;
  airVelocityMS?: number | null;
  airTempC?: number | null;
  pullDownKw: number;
}

export interface ColdProInfiltrationInput {
  altitudeM: number;
  airVolumeInfiltratedM3H: number;
  airRenovationM3H: number;
  doorOpeningsPerDay: number;
  doorAreaM2: number;
  openingFactor: number;
  internalTempC: number;
  externalTempC: number;
}

export interface ColdProInternalLoadsInput {
  peopleQuantity: number;
  peopleLoadW: number;
  peopleUseFactor: number;
  lightingAreaM2: number;
  lightingWM2: number;
  lightingUseFactor: number;
  motorsPowerKw: number;
  motorsUseFactor: number;
  packagingMassKg: number;
  packagingCpKjKgK: number;
  packagingDeltaTK: number;
  respirationMassKg: number;
  respirationRateWKg: number;
  applyRespiration: boolean;
  pullDownKw: number;
  safetyFactor: number;
  defrostFactor: number;
  fanFactor: number;
  operationalFactor: number;
}

export interface ColdProState {
  project: ColdProProjectData;
  dimensions: ColdProDimensions;
  surfaces: ColdProSurface[];
  process: ColdProProcessParameters;
  infiltration: ColdProInfiltrationInput;
  internalLoads: ColdProInternalLoadsInput;
}

export interface ColdProResult {
  transmissionKw: number;
  infiltrationKw: number;
  productKw: number;
  packagingKw: number;
  respirationKw: number;
  peopleKw: number;
  lightingKw: number;
  motorsKw: number;
  pullDownKw: number;
  baseTotalKw: number;
  correctedTotalKw: number;
  totalKcalH: number;
  totalTr: number;
  warnings: string[];
  calculationMemory: Record<string, unknown>;
}
