import * as React from "react";
import { AlertTriangle, Calculator, Fan, Package, Save, Search, Settings, Thermometer, Wind, Warehouse } from "lucide-react";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";
import { formToTunnelInput } from "@/modules/coldpro/adapters/formToTunnelInput";
import { calculateTunnelEngine } from "@/modules/coldpro/engines/tunnelEngine";
import { calculateContinuousGirofreezer } from "@/modules/coldpro/services/continuousGirofreezerService";
import { filterAndRankColdProProducts } from "@/modules/coldpro/core/productSearch";
import { normalizeProductForKcalEngine } from "@/modules/coldpro/core/unitNormalizer";
import { createAirPropertiesContext } from "@/modules/coldpro/physics/airProperties";

const ARRANGEMENT_DEFAULTS: Record<string, { air: number; penetration: number; label: string }> = {
  individual_units: { air: 1, penetration: 1, label: "Produto individual sobre esteira" }, single_layer_blocks: { air: 0.8, penetration: 0.85, label: "Blocos em camada única" }, trays: { air: 0.65, penetration: 0.75, label: "Bandejas" }, stacked_packages: { air: 0.45, penetration: 0.55, label: "Pacotes empilhados" }, packaged_units: { air: 0.55, penetration: 0.65, label: "Produto embalado" }, trays_on_racks: { air: 0.65, penetration: 0.75, label: "Bandejas em racks/carrinhos" }, boxes_on_cart: { air: 0.35, penetration: 0.45, label: "Caixas em carrinho" }, hanging_product: { air: 0.8, penetration: 0.85, label: "Produto suspenso" }, palletized_boxes: { air: 0.35, penetration: 0.45, label: "Caixas paletizadas" }, palletized_blocks: { air: 0.25, penetration: 0.35, label: "Blocos paletizados" }, bulk_on_pallet: { air: 0.2, penetration: 0.3, label: "Produto a granel sobre pallet" }, loose_particles: { air: 0.9, penetration: 0.95, label: "Partículas soltas" }, small_individual_units: { air: 0.9, penetration: 0.95, label: "Unidades pequenas individuais" }, boxes: { air: 0.35, penetration: 0.45, label: "Caixas" }, racks: { air: 0.65, penetration: 0.75, label: "Racks" }, bulk_container: { air: 0.4, penetration: 0.5, label: "Contentores" },
};

const TUNNEL_TYPES = { continuous_belt: "Túnel contínuo de esteira", spiral_girofreezer: "Girofreezer / espiral", static_cart: "Túnel estático com carrinhos", static_pallet: "Túnel estático com pallets", fluidized_bed: "Leito fluidizado / IQF", blast_freezer: "Câmara/túnel de ar forçado" } as const;
const ARRANGEMENTS_BY_TUNNEL: Record<string, string[]> = { continuous_belt: ["individual_units", "single_layer_blocks", "trays", "stacked_packages"], spiral_girofreezer: ["individual_units", "trays", "packaged_units"], static_cart: ["trays_on_racks", "boxes_on_cart", "hanging_product"], static_pallet: ["palletized_boxes", "palletized_blocks", "bulk_on_pallet"], fluidized_bed: ["loose_particles", "small_individual_units"], blast_freezer: ["boxes", "racks", "bulk_container", "palletized_boxes", "trays_on_racks"] };
const STATIC_MASS_MODES = { static_pallet: ["direct_pallet_mass", "calculated_pallet_composition"], static_cart: ["direct_cart_mass", "calculated_cart_composition"], blast_freezer: ["direct_batch_mass", "calculated_batch_composition"] } as const;
const CONTINUOUS_MASS_MODES = { continuous_belt: ["direct_mass_flow", "calculated_by_units_per_hour", "calculated_by_belt_loading", "calculated_by_belt_surface_density"], spiral_girofreezer: ["direct_mass_flow", "calculated_by_units", "calculated_by_trays"], fluidized_bed: ["direct_mass_flow", "calculated_by_feed_rate"] } as const;
const GEOMETRIES = { slab: "Placa / manta / hambúrguer achatado", rectangular_prism: "Bloco retangular", cube: "Cubo", cylinder: "Cilindro", sphere: "Esfera", irregular: "Irregular", packed_box: "Caixa / embalagem fechada", bulk: "Granel" } as const;
const EXPOSURE_MODELS = { fully_exposed: "Produto totalmente exposto ao ar", one_side_contact: "Uma face em contato", tray_contact: "Produto em bandeja", boxed: "Produto dentro de caixa", stacked: "Produto empilhado", bulk_layer: "Camada de produto a granel" } as const;
const PALLET_THERMAL_MODELS = { box_limited: "Limitado pela caixa individual", pallet_block_limited: "Pallet/bloco compacto conservador", hybrid: "Híbrido: caixa + penalização do pallet" } as const;

type DimensionUnit = "m" | "cm" | "mm";
type WeightUnit = "kg" | "g";
type CycleUnit = "h" | "min";
type RetentionUnit = "min" | "h";
type ColdProFormRecord = Record<string, unknown>;
type ColdProProductRecord = Record<string, unknown> & { id?: string | null; name?: string | null; category?: string | null };

type ColdProTunnelFormProps = {
  environmentId: string;
  environment?: Record<string, unknown>;
  product?: Record<string, unknown> | null;
  tunnel?: ColdProFormRecord | null;
  productCatalog?: ColdProProductRecord[];
  onSave: (data: ColdProFormRecord) => void | boolean | Promise<void | boolean>;
};

export type ColdProTunnelFormHandle = {
  save: () => Promise<boolean>;
};

type NumericInputProps = {
  type: "number";
  step: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const coldProTunnelSaveSchema = z.object({
  environment_id: z.string().trim().min(1).max(100),
  product_name: z.string().trim().min(1).max(255),
  tunnel_type: z.string().trim().min(1).max(80),
  arrangement_type: z.string().trim().min(1).max(80).nullish(),
  process_type: z.string().trim().min(1).max(80).nullish(),
  operation_mode: z.string().trim().min(1).max(40).nullish(),
}).passthrough();

const DIMENSION_UNITS: Record<DimensionUnit, { label: string; toMeters: number; step: string }> = {
  m: { label: "m", toMeters: 1, step: "0.001" },
  cm: { label: "cm", toMeters: 0.01, step: "0.1" },
  mm: { label: "mm", toMeters: 0.001, step: "1" },
};

const WEIGHT_UNITS: Record<WeightUnit, { label: string; toKg: number; step: string }> = {
  kg: { label: "kg", toKg: 1, step: "0.001" },
  g: { label: "g", toKg: 0.001, step: "1" },
};

const CYCLE_UNITS: Record<CycleUnit, { label: string; toCyclesPerHour: number; step: string }> = {
  h: { label: "ciclos/h", toCyclesPerHour: 1, step: "0.1" },
  min: { label: "ciclos/min", toCyclesPerHour: 60, step: "0.1" },
};

const RETENTION_UNITS: Record<RetentionUnit, { label: string; toMinutes: number; step: string }> = {
  min: { label: "min", toMinutes: 1, step: "1" },
  h: { label: "h", toMinutes: 60, step: "0.1" },
};

const defaultTunnel = (environmentId: string) => ({
  environment_id: environmentId,
  tunnel_type: "continuous_belt",
  arrangement_type: "individual_units",
  product_geometry: "slab",
  surface_exposure_model: "fully_exposed",
  airflow_source: "manual_velocity",
  fan_airflow_m3_h: 0,
  tunnel_cross_section_width_m: 0,
  tunnel_cross_section_height_m: 0,
  blockage_factor: 0,
  blockage_factor_input_mode: "decimal",
  thermal_model_for_pallet: "hybrid",
  static_mass_mode: "direct_pallet_mass",
  batch_mass_mode: "direct_batch_mass",
  continuous_mass_mode: "direct_mass_flow",
  mass_flow_mode: "direct_mass_flow",
  units_per_box: 0,
  boxes_per_layer: 0,
  number_of_layers: 0,
  boxes_per_batch: 0,
  racks_count: 0,
  containers_count: 0,
  total_units_per_pallet: 0,
  box_packaging_weight_kg: 0,
  pallet_base_weight_kg: 0,
  packaging_weight_kg: 0,
  units_per_pallet: 0,
  product_mass_per_pallet_kg: 0,
  packaging_mass_per_pallet_kg: 0,
  calculated_pallet_mass_kg: 0,
  units_per_tray: 0,
  trays_per_cart: 0,
  number_of_carts: 1,
  tray_packaging_weight_kg: 0,
  cart_structure_weight_kg: 0,
  calculated_cart_mass_kg: 0,
  direct_batch_mass_kg: 0,
  calculated_batch_mass_kg: 0,
  static_mass_kg: 0,
  operation_mode: "continuous",
  process_type: "continuous_individual_freezing",
  physical_model: "continuous_individual",
  product_name: "Produto",
  product_length_m: 0,
  product_width_m: 0,
  product_thickness_m: 0,
  product_height_m: 0,
  product_side_m: 0,
  product_diameter_m: 0,
  equivalent_diameter_m: 0,
  characteristic_dimension_m: 0,
  box_length_m: 0,
  box_width_m: 0,
  box_height_m: 0,
  bulk_layer_height_m: 0,
  equivalent_particle_diameter_m: 0,
  unit_weight_kg: 0,
  product_thickness_mm: 0,
  product_unit_weight_kg: 0,
  units_per_cycle: 0,
  cycles_per_hour: 0,
  trays_per_hour: 0,
  tray_weight_kg: 0,
  units_per_hour: 0,
  units_per_row: 0,
  rows_per_meter: 0,
  belt_speed_m_min: 0,
  belt_width_m: 0,
  belt_effective_length_m: 0,
  belt_area_m2: 0,
  belt_surface_density_kg_m2: 0,
  belt_mass_on_belt_kg: 0,
  belt_nominal_capacity_kg_h: 0,
  feed_rate_kg_h: 0,
  mass_kg_hour: 0,
  pallet_length_m: 0,
  pallet_width_m: 0,
  pallet_height_m: 0,
  pallet_mass_kg: 0,
  number_of_pallets: 1,
  batch_time_h: 0,
  layers_count: 0,
  boxes_count: 0,
  tray_spacing_m: 0,
  package_type: "",
  air_exposure_factor: 1,
  thermal_penetration_factor: 1,
  airflow_m3_h: 0,
  informed_air_flow_m3_h: 0,
  air_flow_m3_h: 0,
  air_delta_t_k: 6,
  air_density_kg_m3: 1.2,
  spiral_turbulence_factor: 1.8,
  block_exposure_factor: 0.7,
  suggested_air_approach_k: 8,
  suggested_air_temp_c: null,
  min_air_temp_c: -40,
  max_air_temp_c: -25,
  min_air_velocity_m_s: 1,
  max_air_velocity_m_s: 6,
  air_temp_step_c: 5,
  air_velocity_step_m_s: 1,
  inlet_temp_c: 5,
  outlet_temp_c: -18,
  freezing_temp_c: -1.5,
  density_kg_m3: 0,
  ashrae_density_kg_m3: 0,
  thermal_conductivity_frozen_w_m_k: 0,
  convective_coefficient_w_m2_k: 0,
  convective_coefficient_manual_w_m2_k: null,
  air_temp_c: -35,
  air_velocity_m_s: 3,
  thermal_condition_approved: false,
  thermal_condition_approved_at: null,
  process_time_min: 60,
  specific_heat_above_kcal_kg_c: 0.8,
  specific_heat_below_kcal_kg_c: 0.4,
  latent_heat_kcal_kg: 60,
  packaging_mass_kg_hour: 0,
  packaging_mass_kg_batch: 0,
  packaging_specific_heat_kcal_kg_c: 0.4,
  bed_width_m: 0,
  bed_length_m: 0,
  bed_area_m2: 0,
  superficial_air_velocity_m_s: 0,
  belt_motor_kw: 0,
  belt_motor_inside_environment: true,
  belt_motor_dissipation_factor: 1,
  internal_fans_kw: 0,
  other_internal_kw: 0,
});

function isStaticProcess(processType: string) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || processType === "static_cart" || processType === "static_pallet" || processType === "blast_freezer";
}

function isStaticTunnel(processType: string, operationMode: unknown) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing" || operationMode === "batch";
}

function physicalModelFromProcess(processType: string) {
  if (processType === "spiral_girofreezer") return "continuous_spiral";
  if (processType === "static_cart") return "static_cart";
  if (processType === "static_pallet") return "static_block";
  if (processType === "fluidized_bed") return "fluidized_bed";
  if (processType === "blast_freezer") return "blast_freezer";
  if (processType === "continuous_girofreezer") return "continuous_spiral";
  if (processType === "static_cart_freezing") return "static_cart";
  if (processType === "static_pallet_freezing") return "static_block";
  return "continuous_individual";
}

function defaultArrangement(processType: string) {
  const byTunnel = ARRANGEMENTS_BY_TUNNEL[processType];
  if (byTunnel?.length) return byTunnel[0];
  if (processType === "static_cart_freezing") return "cart_rack";
  if (processType === "static_pallet_freezing") return "pallet_block";
  if (processType === "continuous_girofreezer") return "tray_layer";
  return "individual_units";
}

function legacyTunnelType(processType: string) {
  if (processType === "continuous_girofreezer") return "spiral_girofreezer";
  if (processType === "static_cart_freezing") return "static_cart";
  if (processType === "static_pallet_freezing") return "static_pallet";
  return processType in TUNNEL_TYPES ? processType : "continuous_belt";
}

function fmtMaybe(value: number | null | undefined, digits = 2, suffix = "") {
  return value === null || value === undefined ? "—" : `${fmtColdPro(value, digits)}${suffix}`;
}

function inputValue(value: unknown): string | number {
  return typeof value === "number" || typeof value === "string" ? value : "";
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function positiveValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function definedNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundPreset(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function recommendedTunnelAirVelocity(tunnelType: string, isStatic: boolean) {
  if (tunnelType === "fluidized_bed") return 4.5;
  if (tunnelType === "spiral_girofreezer") return 3.5;
  if (tunnelType === "static_pallet" || tunnelType === "blast_freezer") return 2;
  if (isStatic) return 2.5;
  return 3;
}

function recommendedBlockageFactor(tunnelType: string, arrangementType: unknown) {
  const arrangement = String(arrangementType ?? "");
  const tunnelLike = ["continuous_belt", "spiral_girofreezer", "static_cart", "static_pallet", "fluidized_bed", "blast_freezer"].includes(tunnelType);
  if (tunnelLike && (arrangement.includes("pallet") || arrangement.includes("block") || arrangement.includes("boxes"))) return 0.5;
  if (tunnelLike || arrangement.includes("tray") || arrangement.includes("rack") || arrangement.includes("cart")) return 0.35;
  return 0.2;
}

function positiveFromPath(source: unknown, ...paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), source);
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function resolveChamberDimensions(environment: unknown, tunnel: unknown) {
  const lengthM = positiveFromPath(environment, "length_m", "comprimento_m", "length", "comprimento") || positiveFromPath(tunnel, "length_m", "comprimento_m", "length", "comprimento");
  const widthM = positiveFromPath(environment, "width_m", "largura_m", "width", "largura") || positiveFromPath(tunnel, "width_m", "largura_m", "width", "largura");
  const heightM = positiveFromPath(environment, "height_m", "altura_m", "height", "altura") || positiveFromPath(tunnel, "height_m", "altura_m", "height", "altura");
  const volumeM3 = positiveFromPath(environment, "volume_m3", "volume") || (lengthM > 0 && widthM > 0 && heightM > 0 ? lengthM * widthM * heightM : 0);
  const internalTempC = definedNumber((environment as Record<string, unknown> | null)?.internal_temp_c, (environment as Record<string, unknown> | null)?.internal_temperature_c, (tunnel as Record<string, unknown> | null)?.air_temp_c, 0);
  return { lengthM, widthM, heightM, volumeM3, internalTempC };
}

function airflowVelocityStatus(velocityMS: number, tunnelLike: boolean) {
  if (velocityMS <= 0) return { status: "pendente", tone: "warning" as const, warning: "Informe carga, vazão e seção livre para validar a velocidade." };
  if (tunnelLike) {
    if (velocityMS < 1.5) return { status: "baixa", tone: "warning" as const, warning: "Velocidade baixa para túnel de congelamento" };
    if (velocityMS > 6) return { status: "alta", tone: "warning" as const, warning: "Velocidade alta; validar arraste, perda de carga e desidratação" };
    return { status: velocityMS >= 2 && velocityMS <= 5 ? "adequada" : "aceitável", tone: "success" as const, warning: "" };
  }
  if (velocityMS > 1.5) return { status: "alta", tone: "warning" as const, warning: "Velocidade alta para câmara fria; validar excesso de ar no produto." };
  if (velocityMS >= 0.2 && velocityMS <= 0.8) return { status: "adequada", tone: "success" as const, warning: "" };
  return { status: "fora da faixa", tone: "warning" as const, warning: "Velocidade fora da faixa usual para câmara fria." };
}

function requiredAirflowForLoadM3H(loadKW: number, airDeltaTK: number, airDensityKgM3: number, cpAirKJkgK = 1.005) {
  if (loadKW <= 0 || airDeltaTK <= 0 || airDensityKgM3 <= 0 || cpAirKJkgK <= 0) return 0;
  return loadKW * 3600 / (airDensityKgM3 * cpAirKJkgK * airDeltaTK);
}

function airflowForVelocityM3H(freeAreaM2: number, velocityMS: number) {
  return freeAreaM2 > 0 && velocityMS > 0 ? freeAreaM2 * velocityMS * 3600 : 0;
}

function freeAirAreaFromControls(source: ColdProFormRecord) {
  const grossAreaM2 = positiveValue(source.tunnel_cross_section_width_m) * positiveValue(source.tunnel_cross_section_height_m);
  const blockageFactor = clamp(definedNumber(source.blockage_factor), 0, 0.95);
  return grossAreaM2 > 0 ? grossAreaM2 * (1 - blockageFactor) : 0;
}

function suggestedConvectiveCoefficientWM2K(velocityMS: number, airExposureFactor = 1, exposureFactor = 1) {
  return velocityMS > 0 ? (10 + 10 * Math.pow(velocityMS, 0.8)) * (airExposureFactor || 1) * (exposureFactor || 1) : 0;
}

function requiredConvectiveCoefficientForTimeWM2K(params: { densityKgM3: number; latentHeatKcalKg: number; frozenWaterFraction: number; freezingPointC: number; airTempC: number; distanceToCoreM: number; kEffectiveWMK: number; targetTimeMin: number }) {
  const deltaT = params.freezingPointC - params.airTempC;
  if (params.densityKgM3 <= 0 || params.latentHeatKcalKg <= 0 || params.frozenWaterFraction <= 0 || deltaT <= 0 || params.distanceToCoreM <= 0 || params.kEffectiveWMK <= 0 || params.targetTimeMin <= 0) return 0;
  const latentHeatJkg = params.latentHeatKcalKg * 4186.8 * params.frozenWaterFraction;
  const targetTerm = (params.targetTimeMin * 60) / (params.densityKgM3 * latentHeatJkg / deltaT);
  const conductiveTerm = Math.pow(params.distanceToCoreM, 2) / (2 * params.kEffectiveWMK);
  const convectiveTerm = targetTerm - conductiveTerm;
  return convectiveTerm > 0 ? params.distanceToCoreM / convectiveTerm : 0;
}

function fmtAirflow(value: unknown, digits = 0) {
  return `${fmtColdPro(value, digits)} m³/h`;
}

function kcalFromThermal(kcal?: unknown, kj?: unknown, preferKjSource = false) {
  const normalized = normalizeProductForKcalEngine({ specific_heat_above_kcal_kg_c: kcal, specific_heat_above_kj_kg_k: kj, prefer_kj_source: preferKjSource });
  return normalized.cpAboveKcalKgC;
}

function geometryFromCatalogShape(shape?: unknown) {
  const text = String(shape ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("retangular") || text.includes("paralelepipedo") || text.includes("bloco")) return "rectangular_prism";
  if (text.includes("cilind")) return "cylinder";
  if (text.includes("esfera")) return "sphere";
  if (text.includes("caixa") || text.includes("garrafa") || text.includes("pote")) return "packed_box";
  if (text.includes("grao") || text.includes("granel") || text.includes("particula")) return "bulk";
  return null;
}

function suggestedStaticArrangementFields(tunnelType: string, arrangementType: string) {
  if (tunnelType === "static_pallet" && arrangementType === "palletized_boxes") return { product_geometry: "packed_box", surface_exposure_model: "stacked", thermal_model_for_pallet: "hybrid" };
  if (tunnelType === "static_pallet" && arrangementType === "palletized_blocks") return { product_geometry: "rectangular_prism", surface_exposure_model: "stacked", thermal_model_for_pallet: "pallet_block_limited" };
  if (tunnelType === "static_pallet" && arrangementType === "bulk_on_pallet") return { product_geometry: "bulk", surface_exposure_model: "bulk_layer", thermal_model_for_pallet: "pallet_block_limited" };
  if (tunnelType === "static_cart" && arrangementType === "trays_on_racks") return { surface_exposure_model: "tray_contact" };
  if (tunnelType === "static_cart" && arrangementType === "boxes_on_cart") return { product_geometry: "packed_box", surface_exposure_model: "boxed", thermal_model_for_pallet: "hybrid" };
  if (tunnelType === "static_cart" && arrangementType === "hanging_product") return { surface_exposure_model: "fully_exposed" };
  return {};
}

function defaultMassModeForTunnel(tunnelType: string) {
  if (tunnelType === "static_cart") return "direct_cart_mass";
  if (tunnelType === "blast_freezer") return "direct_batch_mass";
  if (tunnelType === "fluidized_bed") return "direct_mass_flow";
  return "direct_pallet_mass";
}

function staticModeOptions(tunnelType: string) {
  if (tunnelType === "static_cart") return [{ value: "direct_cart_mass", label: "Informar massa do carrinho/rack diretamente" }, { value: "calculated_cart_composition", label: "Calcular pela formação do carrinho/rack" }];
  if (tunnelType === "blast_freezer") return [{ value: "direct_batch_mass", label: "Informar massa do lote diretamente" }, { value: "calculated_batch_composition", label: "Calcular pela formação da batelada" }];
  return [{ value: "direct_pallet_mass", label: "Informar massa do pallet/lote diretamente" }, { value: "calculated_pallet_composition", label: "Calcular pela formação do pallet/lote" }];
}

function continuousModeOptions(tunnelType: string) {
  if (tunnelType === "spiral_girofreezer") return [{ value: "direct_mass_flow", label: "Informar kg/h diretamente" }, { value: "calculated_by_units", label: "Calcular por unidades/ciclo" }, { value: "calculated_by_trays", label: "Calcular por bandejas/h" }];
  if (tunnelType === "fluidized_bed") return [{ value: "direct_mass_flow", label: "Informar kg/h diretamente" }, { value: "calculated_by_feed_rate", label: "Usar taxa de alimentação" }];
  return [{ value: "direct_mass_flow", label: "Informar kg/h diretamente" }, { value: "calculated_by_units_per_hour", label: "Calcular por unidades/h" }, { value: "calculated_by_belt_loading", label: "Calcular por carregamento da esteira" }, { value: "calculated_by_belt_surface_density", label: "Calcular por densidade superficial da esteira" }];
}

function resolveContinuousMassMode(source: ColdProFormRecord, tunnelType: string) {
  const allowed = new Set(continuousModeOptions(tunnelType).map((option) => option.value));
  const candidates = [source.continuous_mass_mode, source.mass_flow_mode].map((value) => String(value ?? ""));
  const explicit = candidates.find((value) => allowed.has(value));
  if (explicit) return explicit;
  if (tunnelType === "fluidized_bed" && positiveValue(source.feed_rate_kg_h) > 0) return "calculated_by_feed_rate";
  if (tunnelType === "spiral_girofreezer") {
    if (positiveValue(source.trays_per_hour, source.tray_weight_kg) > 0) return "calculated_by_trays";
    if (positiveValue(source.units_per_cycle, source.cycles_per_hour) > 0) return "calculated_by_units";
  }
  if (positiveValue(source.belt_surface_density_kg_m2, source.belt_area_m2, source.belt_width_m, source.belt_effective_length_m, source.belt_nominal_capacity_kg_h) > 0) return "calculated_by_belt_surface_density";
  if (positiveValue(source.units_per_row, source.rows_per_meter, source.belt_speed_m_min) > 0) return "calculated_by_belt_loading";
  if (positiveValue(source.units_per_hour) > 0) return "calculated_by_units_per_hour";
  return "direct_mass_flow";
}

function simulationDraftFromTunnel(source: Partial<ColdProFormRecord>) {
  return {
    air_temp_c: source?.air_temp_c ?? -35,
    airflow_source: source?.airflow_source ?? "manual_velocity",
    air_velocity_m_s: source?.air_velocity_m_s ?? 3,
    fan_airflow_m3_h: source?.fan_airflow_m3_h ?? source?.informed_air_flow_m3_h ?? source?.airflow_m3_h ?? 0,
    tunnel_cross_section_width_m: source?.tunnel_cross_section_width_m ?? 0,
    tunnel_cross_section_height_m: source?.tunnel_cross_section_height_m ?? 0,
    blockage_factor: source?.blockage_factor ?? 0,
    air_delta_t_k: source?.air_delta_t_k ?? 6,
    informed_air_flow_m3_h: source?.informed_air_flow_m3_h ?? source?.airflow_m3_h ?? 0,
    convective_coefficient_manual_w_m2_k: source?.convective_coefficient_manual_w_m2_k ?? null,
    package_type: source?.package_type ?? "",
    air_exposure_factor: source?.air_exposure_factor ?? 1,
    thermal_penetration_factor: source?.thermal_penetration_factor ?? 1,
    suggested_air_approach_k: source?.suggested_air_approach_k ?? 8,
  };
}

const DENSITY_SOURCE_LABEL = {
  manual: "manual",
  calculated_from_geometry: "geometria + peso",
  ashrae: "tabela ASHRAE/produto",
  default_estimated: "padrão estimado",
} as const;

const DENSITY_STATUS_LABEL = {
  valid: "aceitável",
  warning: "alerta",
  critical: "crítico",
  missing: "faltam dados",
} as const;

export const ColdProTunnelForm = React.forwardRef<ColdProTunnelFormHandle, ColdProTunnelFormProps>(function ColdProTunnelForm({ environmentId, environment, product, tunnel, productCatalog = [], onSave }, ref) {
  const [form, setForm] = React.useState<ColdProFormRecord>(defaultTunnel(environmentId));
  const [selectedGroup, setSelectedGroup] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductSuggestions, setShowProductSuggestions] = React.useState(false);
  const [continuousUnit, setContinuousUnit] = React.useState<DimensionUnit>("m");
  const [staticUnit, setStaticUnit] = React.useState<DimensionUnit>("m");
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>("kg");
  const [cycleUnit, setCycleUnit] = React.useState<CycleUnit>("h");
  const [retentionUnit, setRetentionUnit] = React.useState<RetentionUnit>("min");
  const [activeTab, setActiveTab] = React.useState("modelo");
  const [airOperationMode, setAirOperationMode] = React.useState("validate_current");
  const [airTempCalcBase, setAirTempCalcBase] = React.useState("edit_air");
  const [environmentAirTempOverrideC, setEnvironmentAirTempOverrideC] = React.useState<number | null>(null);
  const [simulation, setSimulation] = React.useState<ColdProFormRecord>(() => simulationDraftFromTunnel(defaultTunnel(environmentId)));
  const autoAirPresetKeyRef = React.useRef("");

  React.useEffect(() => {
    const base = { ...defaultTunnel(environmentId), ...(tunnel ?? {}), environment_id: environmentId };
    const nextTunnelType = String(base.tunnel_type ?? legacyTunnelType(String(base.process_type ?? "continuous_belt")));
    const savedContinuousMassMode = resolveContinuousMassMode(base, nextTunnelType);
    const next = {
      ...base,
      continuous_mass_mode: nextTunnelType === "fluidized_bed" ? base.continuous_mass_mode : savedContinuousMassMode,
      mass_flow_mode: nextTunnelType === "fluidized_bed" ? savedContinuousMassMode : base.mass_flow_mode,
    };
    setForm(next);
    setSimulation(simulationDraftFromTunnel(next));
  }, [environmentId, tunnel?.id]);

  const set = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const num = (key: string): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(form?.[key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });
  const airTempNum = (): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(form?.air_temp_c), onChange: (e: React.ChangeEvent<HTMLInputElement>) => { setAirTempCalcBase("edit_air"); setForm((prev) => ({ ...prev, air_temp_source: "manual", air_temp_c: numberOrNull(e.target.value) })); } });
  const setSim = (key: string, value: unknown) => setSimulation((prev) => ({ ...prev, [key]: value }));
  const simNum = (key: string): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(simulation?.[key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSim(key, numberOrNull(e.target.value)) });
  const simAirTempNum = (): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(simulation?.air_temp_c), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSimulation((prev) => ({ ...prev, air_temp_source: "manual", air_temp_c: numberOrNull(e.target.value) })) });
  const setAirflowSource = (value: string) => {
    if (value === "airflow_by_fans") setForm((prev) => ({ ...prev, ...buildAirflowPreset(prev) }));
    else setForm((prev) => ({ ...prev, airflow_source: value, fan_airflow_m3_h: prev.fan_airflow_m3_h ?? prev.informed_air_flow_m3_h ?? prev.airflow_m3_h }));
  };
  const setAirControl = (key: string, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      const freeAreaM2 = freeAirAreaFromControls(next);
      if (key === "air_velocity_m_s") {
        const velocityMS = positiveValue(next.air_velocity_m_s);
        const airflowM3H = airflowForVelocityM3H(freeAreaM2, velocityMS);
        return airflowM3H > 0 ? { ...next, airflow_source: "airflow_by_fans", fan_airflow_m3_h: roundPreset(airflowM3H, 2), informed_air_flow_m3_h: roundPreset(airflowM3H, 2), airflow_m3_h: roundPreset(airflowM3H, 2), airflow_free_area_m2: roundPreset(freeAreaM2, 3) } : next;
      }
      const fanAirflowM3H = positiveValue(next.fan_airflow_m3_h, next.informed_air_flow_m3_h, next.airflow_m3_h);
      if (fanAirflowM3H > 0 && freeAreaM2 > 0) {
        const velocityMS = fanAirflowM3H / 3600 / freeAreaM2;
        return { ...next, airflow_source: "airflow_by_fans", air_velocity_m_s: roundPreset(velocityMS, 3), airflow_free_area_m2: roundPreset(freeAreaM2, 3) };
      }
      const velocityMS = positiveValue(next.air_velocity_m_s);
      const airflowM3H = airflowForVelocityM3H(freeAreaM2, velocityMS);
      return airflowM3H > 0 ? { ...next, airflow_source: "airflow_by_fans", fan_airflow_m3_h: roundPreset(airflowM3H, 2), informed_air_flow_m3_h: roundPreset(airflowM3H, 2), airflow_m3_h: roundPreset(airflowM3H, 2), airflow_free_area_m2: roundPreset(freeAreaM2, 3) } : next;
    });
  };
  const airControlNum = (key: string): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(form?.[key]), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAirControl(key, numberOrNull(e.target.value)) });
  const fanAirflowNum = (): NumericInputProps => ({
    type: "number",
    step: "0.0001",
    value: inputValue(form?.fan_airflow_m3_h),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextAirflow = numberOrNull(e.target.value);
      setForm((prev) => {
        const next = { ...prev, airflow_source: "airflow_by_fans", fan_airflow_m3_h: nextAirflow, informed_air_flow_m3_h: nextAirflow, airflow_m3_h: nextAirflow };
        const freeAreaM2 = freeAirAreaFromControls(next);
        const velocityMS = nextAirflow !== null && nextAirflow > 0 && freeAreaM2 > 0 ? nextAirflow / 3600 / freeAreaM2 : prev.air_velocity_m_s;
        return { ...next, air_velocity_m_s: velocityMS, airflow_free_area_m2: freeAreaM2 > 0 ? roundPreset(freeAreaM2, 3) : prev.airflow_free_area_m2 };
      });
    },
  });
  const airControlBlockagePercentNum = (key: string) => {
    const value = Number(form?.[key] ?? 0);
    return { type: "number" as const, step: "0.0001", value: Number.isFinite(value) && value !== 0 ? value * 100 : form?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const parsed = numberOrNull(e.target.value); setAirControl(key, parsed === null ? null : parsed / 100); } };
  };
  const setSimulationAirflowSource = (value: string) => {
    setSimulation((prev) => ({ ...prev, airflow_source: value, fan_airflow_m3_h: prev.fan_airflow_m3_h ?? prev.informed_air_flow_m3_h ?? prev.airflow_m3_h }));
  };
  const setContinuousMassMode = (value: string) => {
    const resetByMethod = {
      mass_kg_hour: value === "direct_mass_flow" ? form.mass_kg_hour : 0,
      units_per_cycle: value === "calculated_by_units" ? form.units_per_cycle : 0,
      cycles_per_hour: value === "calculated_by_units" ? form.cycles_per_hour : 0,
      units_per_hour: value === "calculated_by_units_per_hour" ? form.units_per_hour : 0,
      units_per_row: value === "calculated_by_belt_loading" ? form.units_per_row : 0,
      rows_per_meter: value === "calculated_by_belt_loading" ? form.rows_per_meter : 0,
      belt_speed_m_min: ["calculated_by_belt_loading", "calculated_by_belt_surface_density"].includes(value) ? form.belt_speed_m_min : 0,
      belt_width_m: value === "calculated_by_belt_surface_density" ? form.belt_width_m : 0,
      belt_effective_length_m: value === "calculated_by_belt_surface_density" ? form.belt_effective_length_m : 0,
      belt_area_m2: value === "calculated_by_belt_surface_density" ? form.belt_area_m2 : 0,
      belt_surface_density_kg_m2: value === "calculated_by_belt_surface_density" ? form.belt_surface_density_kg_m2 : 0,
      belt_mass_on_belt_kg: value === "calculated_by_belt_surface_density" ? form.belt_mass_on_belt_kg : 0,
      belt_nominal_capacity_kg_h: value === "calculated_by_belt_surface_density" ? form.belt_nominal_capacity_kg_h : 0,
      units_per_tray: value === "calculated_by_trays" ? form.units_per_tray : 0,
      trays_per_hour: value === "calculated_by_trays" ? form.trays_per_hour : 0,
      tray_weight_kg: value === "calculated_by_trays" ? form.tray_weight_kg : 0,
      feed_rate_kg_h: value === "calculated_by_feed_rate" ? form.feed_rate_kg_h : 0,
    };
    setForm((prev) => ({ ...prev, ...resetByMethod, [tunnelType === "fluidized_bed" ? "mass_flow_mode" : "continuous_mass_mode"]: value }));
  };
  const dimensionValueM = (key: string) => key === "product_thickness_m" ? (Number(form.product_thickness_m ?? 0) || Number(form.product_thickness_mm ?? 0) / 1000) : Number(form?.[key] ?? 0);
  const dimensionNum = (key: string, unit: DimensionUnit) => {
    const unitConfig = DIMENSION_UNITS[unit];
    const valueM = dimensionValueM(key);
    return {
      type: "number" as const,
      step: unitConfig.step,
      value: Number.isFinite(valueM) && valueM !== 0 ? valueM / unitConfig.toMeters : form?.[key] === 0 ? 0 : "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const value = numberOrNull(e.target.value); set(key, value === null ? null : value * unitConfig.toMeters); },
    };
  };
  const weightNum = (key: string, unit: WeightUnit) => {
    const unitConfig = WEIGHT_UNITS[unit];
    const valueKg = Number(form?.[key] ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valueKg) && valueKg !== 0 ? valueKg / unitConfig.toKg : form?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const value = numberOrNull(e.target.value); set(key, value === null ? null : value * unitConfig.toKg); } };
  };
  const cyclesNum = (unit: CycleUnit) => {
    const unitConfig = CYCLE_UNITS[unit];
    const valuePerHour = Number(form.cycles_per_hour ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valuePerHour) && valuePerHour !== 0 ? valuePerHour / unitConfig.toCyclesPerHour : form.cycles_per_hour === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const value = numberOrNull(e.target.value); set("cycles_per_hour", value === null ? null : value * unitConfig.toCyclesPerHour); } };
  };
  const retentionNum = (unit: RetentionUnit) => {
    const unitConfig = RETENTION_UNITS[unit];
    const valueMin = Number(form.process_time_min ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valueMin) && valueMin !== 0 ? valueMin / unitConfig.toMinutes : form.process_time_min === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const value = numberOrNull(e.target.value); set("process_time_min", value === null ? null : value * unitConfig.toMinutes); } };
  };
  const beltSurfaceRetentionNum = (unit: RetentionUnit) => {
    const unitConfig = RETENTION_UNITS[unit];
    const valueMin = Number(form.process_time_min ?? 0);
    return {
      type: "number" as const,
      step: unitConfig.step,
      value: Number.isFinite(valueMin) && valueMin !== 0 ? valueMin / unitConfig.toMinutes : form.process_time_min === 0 ? 0 : "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = numberOrNull(e.target.value);
        const nextRetentionMin = value === null ? null : value * unitConfig.toMinutes;
        setForm((prev) => {
          const lengthM = positiveValue(prev.belt_effective_length_m);
          const nextSpeed = nextRetentionMin && nextRetentionMin > 0 && lengthM > 0 ? lengthM / nextRetentionMin : prev.belt_speed_m_min;
          return { ...prev, process_time_min: nextRetentionMin, belt_speed_m_min: nextSpeed };
        });
      },
    };
  };
  const beltSpeedNum = (): NumericInputProps => ({
    type: "number",
    step: "0.0001",
    value: inputValue(form?.belt_speed_m_min),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextSpeed = numberOrNull(e.target.value);
      setForm((prev) => {
        const lengthM = positiveValue(prev.belt_effective_length_m);
        const nextRetentionMin = nextSpeed && nextSpeed > 0 && lengthM > 0 ? lengthM / nextSpeed : prev.process_time_min;
        return { ...prev, belt_speed_m_min: nextSpeed, process_time_min: nextRetentionMin };
      });
    },
  });
  const beltLengthNum = (): NumericInputProps => ({
    type: "number",
    step: "0.0001",
    value: inputValue(form?.belt_effective_length_m),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextLength = numberOrNull(e.target.value);
      setForm((prev) => {
        const lengthM = nextLength && nextLength > 0 ? nextLength : 0;
        const retentionMin = positiveValue(prev.process_time_min);
        const speedMMin = positiveValue(prev.belt_speed_m_min);
        if (lengthM > 0 && retentionMin > 0) return { ...prev, belt_effective_length_m: nextLength, belt_speed_m_min: lengthM / retentionMin };
        if (lengthM > 0 && speedMMin > 0) return { ...prev, belt_effective_length_m: nextLength, process_time_min: lengthM / speedMMin };
        return { ...prev, belt_effective_length_m: nextLength };
      });
    },
  });
  const blockagePercentNum = (key: string) => {
    const value = Number(form?.[key] ?? 0);
    return { type: "number" as const, step: "0.0001", value: Number.isFinite(value) && value !== 0 ? value * 100 : form?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const parsed = numberOrNull(e.target.value); set(key, parsed === null ? null : parsed / 100); } };
  };
  const simBlockagePercentNum = (key: string) => {
    const value = Number(simulation?.[key] ?? 0);
    return { type: "number" as const, step: "0.0001", value: Number.isFinite(value) && value !== 0 ? value * 100 : simulation?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const parsed = numberOrNull(e.target.value); setSim(key, parsed === null ? null : parsed / 100); } };
  };
  const processType = String(form.process_type ?? "continuous_individual_freezing");
  const tunnelType = String(form.tunnel_type ?? legacyTunnelType(processType));
  const arrangementOptions = ARRANGEMENTS_BY_TUNNEL[tunnelType] ?? ARRANGEMENTS_BY_TUNNEL.continuous_belt;
  const physicalModel = String(form.physical_model ?? physicalModelFromProcess(processType));
  const isStatic = ["static_cart", "static_pallet", "blast_freezer"].includes(tunnelType) || isStaticTunnel(processType, form.operation_mode);
  const modelTab = isStatic ? "estatico" : "continuo";
  const unitWeight = Number(form.unit_weight_kg ?? 0) || Number(form.product_unit_weight_kg ?? 0);
  const continuousMassMode = resolveContinuousMassMode(form, tunnelType);
  const throughputByUnits = unitWeight * positiveValue(form.units_per_cycle) * positiveValue(form.cycles_per_hour);
  const throughputByTrays = (unitWeight * positiveValue(form.units_per_tray) + positiveValue(form.tray_weight_kg)) * positiveValue(form.trays_per_hour);
  const throughputByUnitsHour = unitWeight * positiveValue(form.units_per_hour);
  const beltUnitsPerHour = positiveValue(form.units_per_row) * positiveValue(form.rows_per_meter) * positiveValue(form.belt_speed_m_min) * 60;
  const throughputByBelt = beltUnitsPerHour * unitWeight;
  const beltSurfaceCalculatedAreaM2 = positiveValue(form.belt_width_m) * positiveValue(form.belt_effective_length_m);
  const beltSurfaceInformedAreaM2 = positiveValue(form.belt_area_m2);
  const beltSurfaceAreaM2 = beltSurfaceCalculatedAreaM2 || beltSurfaceInformedAreaM2;
  const beltSurfaceMassKg = positiveValue(form.belt_mass_on_belt_kg) || beltSurfaceAreaM2 * positiveValue(form.belt_surface_density_kg_m2);
  const beltLinearLoadKgM = positiveValue(form.belt_surface_density_kg_m2) * positiveValue(form.belt_width_m);
  const beltFlowByRetentionKgH = beltSurfaceMassKg > 0 && positiveValue(form.process_time_min) > 0 ? beltSurfaceMassKg / positiveValue(form.process_time_min) * 60 : 0;
  const beltFlowBySpeedKgH = beltLinearLoadKgM * positiveValue(form.belt_speed_m_min) * 60;
  const beltSurfaceFlowKgH = beltFlowBySpeedKgH || positiveValue(form.belt_nominal_capacity_kg_h) || beltFlowByRetentionKgH;
  const beltCalculatedRetentionMin = positiveValue(form.belt_effective_length_m) > 0 && positiveValue(form.belt_speed_m_min) > 0 ? positiveValue(form.belt_effective_length_m) / positiveValue(form.belt_speed_m_min) : 0;
  const beltCapacityDeviationPercent = beltSurfaceFlowKgH > 0 && positiveValue(form.belt_nominal_capacity_kg_h) > 0 ? Math.abs(beltSurfaceFlowKgH - positiveValue(form.belt_nominal_capacity_kg_h)) / positiveValue(form.belt_nominal_capacity_kg_h) * 100 : null;
  const throughputByFeedRate = positiveValue(form.feed_rate_kg_h);
  const calculatedMassHour = continuousMassMode === "calculated_by_trays" ? throughputByTrays : continuousMassMode === "calculated_by_units_per_hour" ? throughputByUnitsHour : continuousMassMode === "calculated_by_belt_loading" ? throughputByBelt : continuousMassMode === "calculated_by_belt_surface_density" ? beltSurfaceFlowKgH : continuousMassMode === "calculated_by_feed_rate" ? throughputByFeedRate : throughputByUnits;
  const massHour = continuousMassMode === "direct_mass_flow" ? positiveValue(form.mass_kg_hour) : calculatedMassHour;
  const staticMassMode = String(form.static_mass_mode ?? defaultMassModeForTunnel(tunnelType));
  const unitsPerPallet = staticMassMode === "calculated_pallet_composition" ? (positiveValue(form.total_units_per_pallet) || positiveValue(form.units_per_box) * positiveValue(form.boxes_per_layer) * positiveValue(form.number_of_layers)) : positiveValue(form.units_per_pallet);
  const productMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? unitsPerPallet * unitWeight : positiveValue(form.product_mass_per_pallet_kg);
  const packagingMassPerPalletKg = staticMassMode === "calculated_pallet_composition" ? positiveValue(form.box_packaging_weight_kg) + positiveValue(form.pallet_base_weight_kg) : positiveValue(form.packaging_mass_per_pallet_kg);
  const calculatedPalletMassKg = staticMassMode === "calculated_pallet_composition" ? productMassPerPalletKg + packagingMassPerPalletKg : positiveValue(form.calculated_pallet_mass_kg);
  const unitsPerCart = positiveValue(form.units_per_tray) * positiveValue(form.trays_per_cart);
  const calculatedCartMassKg = unitsPerCart * unitWeight + positiveValue(form.tray_packaging_weight_kg) + positiveValue(form.cart_structure_weight_kg);
  const calculatedBatchMassKg = unitWeight * (positiveValue(form.units_per_box) * positiveValue(form.boxes_per_batch) || positiveValue(form.total_units_per_pallet) || positiveValue(form.units_per_pallet)) + positiveValue(form.packaging_weight_kg);
  const effectiveBatchUnitMassKg = staticMassMode === "calculated_pallet_composition" ? calculatedPalletMassKg : staticMassMode === "calculated_cart_composition" ? calculatedCartMassKg : staticMassMode === "calculated_batch_composition" ? calculatedBatchMassKg : staticMassMode === "direct_batch_mass" ? positiveValue(form.direct_batch_mass_kg, form.static_mass_kg) : positiveValue(form.pallet_mass_kg);
  const groupingCount = staticMassMode.includes("cart") ? Math.max(1, Number(form.number_of_carts ?? 1)) : staticMassMode.includes("batch") ? 1 : Math.max(1, Number(form.number_of_pallets ?? 1));
  const staticMass = effectiveBatchUnitMassKg * groupingCount;
  const blockDims = [Number(form.pallet_length_m ?? 0), Number(form.pallet_width_m ?? 0), Number(form.pallet_height_m ?? 0)].filter((v) => v > 0);
  const productThicknessM = dimensionValueM("product_thickness_m");
  const characteristic = isStatic ? (blockDims.length ? Math.min(...blockDims) : 0) : productThicknessM;
  const deltaT = Number(form.inlet_temp_c ?? 0) - Number(form.outlet_temp_c ?? 0);
  const processError = isStatic ? Number(form.batch_time_h ?? 0) <= 0 : Number(form.process_time_min ?? 0) <= 0;
  const velocityWarning = Number(form.air_velocity_m_s ?? 0) <= 0 || Number(form.air_velocity_m_s ?? 0) > 10;
  const requiredError = String(form.product_name ?? "").trim().length === 0;
  const staticWarning = isStatic || ["boxed", "stacked_packages", "palletized_boxes", "palletized_blocks", "bulk_on_pallet", "bulk_container"].includes(String(form.arrangement_type));
  const canSave = !processError && !requiredError;
  const ashraeDensityKgM3 = Number(form.ashrae_density_kg_m3 ?? 0);
  const densityFieldKgM3 = Number(form.density_kg_m3 ?? 0);
  const selectedCatalogProduct = productCatalog.find((item) => item.id === form.product_id) ?? null;
  const thermodynamicProduct = selectedCatalogProduct ?? product ?? null;
  const catalogLocked = Boolean(selectedCatalogProduct);
  const lockedNum = (key: string) => ({ ...num(key), readOnly: catalogLocked, readOnlyValue: catalogLocked, title: catalogLocked ? "Propriedade técnica carregada do catálogo; edite no cadastro de produtos." : undefined });
  const productDensityKgM3 = positiveValue(thermodynamicProduct?.density_kg_m3);
  const manualDensityKgM3 = densityFieldKgM3 > 0 && (!ashraeDensityKgM3 || Math.abs(densityFieldKgM3 - ashraeDensityKgM3) > 0.0001) ? densityFieldKgM3 : productDensityKgM3;
  const airTempSource = form.air_temp_source ?? "environment";
  const environmentInternalTempC = environmentAirTempOverrideC ?? Number(environment?.internal_temp_c ?? form.air_temp_c ?? 0);
  const airTemperatureC = airTempSource === "environment"
    ? environmentInternalTempC
    : Number(form.air_temp_c ?? environment?.internal_temp_c ?? 0);
  const freezingPointC = Number(catalogLocked ? selectedCatalogProduct?.initial_freezing_temp_c ?? form.freezing_temp_c ?? -1.5 : form.freezing_temp_c ?? thermodynamicProduct?.initial_freezing_temp_c ?? -1.5);
  const catalogKcalProduct = selectedCatalogProduct ? normalizeProductForKcalEngine(selectedCatalogProduct) : null;
  const preferCatalogKj = Boolean(form.product_id ?? selectedCatalogProduct?.id);
  const cpAboveKcalKgC = catalogKcalProduct?.cpAboveKcalKgC || kcalFromThermal(form.specific_heat_above_kcal_kg_c, form.specific_heat_above_kj_kg_k, preferCatalogKj) || kcalFromThermal(thermodynamicProduct?.specific_heat_above_kcal_kg_c, thermodynamicProduct?.specific_heat_above_kj_kg_k, Boolean(thermodynamicProduct?.id));
  const cpBelowKcalKgC = catalogKcalProduct?.cpBelowKcalKgC || kcalFromThermal(form.specific_heat_below_kcal_kg_c, form.specific_heat_below_kj_kg_k, preferCatalogKj) || kcalFromThermal(thermodynamicProduct?.specific_heat_below_kcal_kg_c, thermodynamicProduct?.specific_heat_below_kj_kg_k, Boolean(thermodynamicProduct?.id));
  const latentHeatKcalKg = catalogKcalProduct?.latentHeatKcalKg || kcalFromThermal(form.latent_heat_kcal_kg, form.latent_heat_kj_kg, preferCatalogKj) || kcalFromThermal(thermodynamicProduct?.latent_heat_kcal_kg, thermodynamicProduct?.latent_heat_kj_kg, Boolean(thermodynamicProduct?.id));
  const frozenConductivityWmK = catalogLocked ? positiveValue(selectedCatalogProduct?.thermal_conductivity_frozen_w_m_k, selectedCatalogProduct?.thermal_conductivity_w_m_k, form.thermal_conductivity_frozen_w_m_k) : positiveValue(form.thermal_conductivity_frozen_w_m_k, thermodynamicProduct?.thermal_conductivity_frozen_w_m_k, thermodynamicProduct?.thermal_conductivity_w_m_k);
  const frozenWaterFraction = catalogKcalProduct?.frozenWaterFraction ?? definedNumber(form.frozen_water_fraction, thermodynamicProduct?.frozen_water_fraction, thermodynamicProduct?.freezable_water_content_percent == null ? null : Number(thermodynamicProduct.freezable_water_content_percent) / 100, thermodynamicProduct?.water_content_percent == null ? null : Number(thermodynamicProduct.water_content_percent) / 100, 0.9);
  const manualAirDensityKgM3 = positiveValue(form.air_density_kg_m3) > 0 && Math.abs(positiveValue(form.air_density_kg_m3) - 1.2) > 0.0001 ? positiveValue(form.air_density_kg_m3) : null;
  const airProperties = createAirPropertiesContext({
    temperatureC: airTemperatureC,
    altitudeM: positiveValue(environment?.altitude_m, form.altitude_m) || null,
    pressureKPa: positiveValue(environment?.atmospheric_pressure_kpa, form.atmospheric_pressure_kpa) || null,
    relativeHumidityPercent: positiveValue(environment?.relative_humidity_percent, form.relative_humidity_percent) || null,
    airDensityKgM3: manualAirDensityKgM3,
    airSpecificHeatKJkgK: positiveValue(form.air_specific_heat_kj_kg_k) || null,
    waterLatentHeatKJkg: positiveValue(form.water_latent_heat_kj_kg) || null,
    mode: "sublimation",
  });
  const effectiveForm = catalogLocked ? { ...form, product_name: selectedCatalogProduct?.name ?? form.product_name, freezing_temp_c: freezingPointC, density_kg_m3: selectedCatalogProduct?.density_kg_m3 ?? form.density_kg_m3, ashrae_density_kg_m3: selectedCatalogProduct?.density_kg_m3 ?? form.ashrae_density_kg_m3, specific_heat_above_kj_kg_k: selectedCatalogProduct?.specific_heat_above_kj_kg_k ?? null, specific_heat_below_kj_kg_k: selectedCatalogProduct?.specific_heat_below_kj_kg_k ?? null, specific_heat_above_kcal_kg_c: cpAboveKcalKgC, specific_heat_below_kcal_kg_c: cpBelowKcalKgC, latent_heat_kj_kg: selectedCatalogProduct?.latent_heat_kj_kg ?? null, latent_heat_kcal_kg: latentHeatKcalKg, thermal_conductivity_frozen_w_m_k: frozenConductivityWmK, frozen_water_fraction: frozenWaterFraction, thermal_conductivity_unfrozen_w_m_k: selectedCatalogProduct?.thermal_conductivity_unfrozen_w_m_k ?? selectedCatalogProduct?.thermal_conductivity_w_m_k ?? null, water_content_percent: selectedCatalogProduct?.water_content_percent ?? null } : form;
  const tunnelInput = formToTunnelInput(effectiveForm, environment ?? {});
  const baseResult = calculateTunnelEngine(tunnelInput);
  const simulationForm = { ...effectiveForm, ...simulation, initial_scenario_input: tunnelInput.initialScenarioInput, thermal_condition_approved: false };
  const simulationInput = formToTunnelInput(simulationForm, environment ?? {});
  const simulationResult = calculateTunnelEngine(simulationInput);
  const tunnelResult = baseResult;
  const initialScenario = baseResult.adjustedScenario;
  const adjustedScenario = simulationResult.adjustedScenario;
  const baseFanAirflowM3H = Number(tunnelResult.fanAirflowM3H ?? tunnelResult.informedAirFlowM3H ?? 0) || tunnelResult.airFlowM3H;
  const simulatedFanAirflowM3H = Number(simulationResult.fanAirflowM3H ?? simulationResult.informedAirFlowM3H ?? 0) || simulationResult.airFlowM3H;
  const deltaFanAirflowM3H = simulatedFanAirflowM3H - baseFanAirflowM3H;
  const airVelocityControl = airControlNum("air_velocity_m_s");
  const simulationAirVelocityControl = simulation.airflow_source === "airflow_by_fans" ? { type: "number" as const, step: "0.0001", value: simulationResult.airVelocityUsedMS ?? "", onChange: () => undefined, readOnly: true } : simNum("air_velocity_m_s");
  const productSourceKcalH = positiveValue(product?.total_load_kcal_h, product?.product_load_kcal_h, product?.total_kcal_h, product?.load_kcal_h);
  const loadDifferenceKcalH = productSourceKcalH > 0 ? tunnelResult.totalKcalH - productSourceKcalH : 0;
  const loadDifferencePercent = productSourceKcalH > 0 ? Math.abs(loadDifferenceKcalH) / productSourceKcalH * 100 : 0;
  const firstThermalLoadReady = tunnelResult.productLoadKW > 0 && (isStatic ? staticMass > 0 && Number(form.batch_time_h ?? 0) > 0 : massHour > 0);
  const loadStableTimeChanged = initialScenario.totalKW > 0 && Math.abs(adjustedScenario.totalKW - initialScenario.totalKW) / initialScenario.totalKW < 0.02 && initialScenario.estimatedTimeMin && adjustedScenario.estimatedTimeMin && Math.abs(adjustedScenario.estimatedTimeMin - initialScenario.estimatedTimeMin) / initialScenario.estimatedTimeMin > 0.05;
  const scenarioDelta = {
    time: adjustedScenario.estimatedTimeMin !== null && initialScenario.estimatedTimeMin !== null ? adjustedScenario.estimatedTimeMin - initialScenario.estimatedTimeMin : null,
    airflow: deltaFanAirflowM3H,
    h: adjustedScenario.hEffectiveWM2K !== null && initialScenario.hEffectiveWM2K !== null ? adjustedScenario.hEffectiveWM2K - initialScenario.hEffectiveWM2K : null,
    statusChanged: adjustedScenario.status !== initialScenario.status,
  };
  const giroResult = calculateContinuousGirofreezer({
    dimensionScale: "m",
    productLength: Number(form.product_length_m ?? 0),
    productWidth: Number(form.product_width_m ?? 0),
    productThickness: productThicknessM,
    weightScale: "kg",
    unitWeight,
    unitsPerCycle: Number(form.units_per_cycle ?? 0),
    cycleScale: "cycles_per_hour",
    cycles: Number(form.cycles_per_hour ?? 0),
    directMassKgH: isStatic ? 0 : massHour,
    timeScale: "min",
    retentionTime: Number(form.process_time_min ?? 0),
    airTemperatureC,
    airVelocityMs: Number(form.air_velocity_m_s ?? 0),
    minAirVelocityMs: Number(form.min_air_velocity_m_s ?? 1),
    maxAirVelocityMs: Number(form.max_air_velocity_m_s ?? 6),
    initialTempC: Number(form.inlet_temp_c ?? 0),
    finalTempC: Number(form.outlet_temp_c ?? 0),
    cpAboveKjKgK: cpAboveKcalKgC * 4.1868,
    cpBelowKjKgK: cpBelowKcalKgC * 4.1868,
    manualDensityKgM3,
    ashraeDensityKgM3,
    frozenConductivityWmK,
    freezingPointC: Number(freezingPointC),
    latentHeatKjKg: latentHeatKcalKg * 4.1868,
    frozenWaterFraction,
    packagingMassKgH: Number(form.packaging_mass_kg_hour ?? 0),
    packagingCpKjKgK: Number(form.packaging_specific_heat_kcal_kg_c ?? 0) * 4.1868,
    deltaTAirK: Number(form.air_delta_t_k ?? 5),
    airDensityKgM3: airProperties.densityKgM3,
    airExposureFactor: Number(form.air_exposure_factor ?? 1),
    thermalPenetrationFactor: Number(form.thermal_penetration_factor ?? 1),
    tunnelType,
    operationRegime: isStatic ? "batch" : "continuous",
    staticMassMode,
  });
  const giroStatusLabel: Record<typeof giroResult.physics.processStatus, string> = {
    adequate: "Adequado",
    insufficient: "Insuficiente",
    missing_data: "Faltam dados",
    invalid_input: "Dados inválidos",
  };
  const giroStatusTone = giroResult.physics.processStatus === "adequate" ? "success" : "warning";
  const thermalResult = giroResult.thermal ?? {
    qSpecificAboveKjKg: 0,
    qSpecificLatentKjKg: 0,
    qSpecificBelowKjKg: 0,
    qSpecificTotalKjKg: 0,
    productLoadKw: 0,
    productLoadKcalH: 0,
    productLoadTr: 0,
    packagingLoadKw: 0,
    totalProcessLoadKw: 0,
    totalProcessLoadKcalH: 0,
    totalProcessLoadTr: 0,
    requiredAirflowM3H: null,
    requiredAirflowM3S: null,
  };
  const groups = React.useMemo(() => Array.from(new Set(productCatalog.map((p) => p.category).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [productCatalog]);
  const filteredProducts = React.useMemo(() => filterAndRankColdProProducts(productCatalog, productSearch, selectedGroup), [productCatalog, productSearch, selectedGroup]);
  const productSuggestions = React.useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);

  const buildAirflowPreset = React.useCallback((source: ColdProFormRecord = form) => {
    const dimensions = resolveChamberDimensions(environment, { ...(tunnel ?? {}), ...source });
    const tunnelLike = ["continuous_belt", "spiral_girofreezer", "static_cart", "static_pallet", "fluidized_bed", "blast_freezer"].includes(tunnelType);
    const loadKW = positiveValue(tunnelResult.totalKW, tunnelResult.productLoadKW, thermalResult.totalProcessLoadKw, thermalResult.productLoadKw);
    const airDeltaTK = positiveValue(source?.air_delta_t_k) || 6;
    const localManualDensity = positiveValue(source?.air_density_kg_m3) > 0 && Math.abs(positiveValue(source?.air_density_kg_m3) - 1.2) > 0.0001 ? positiveValue(source?.air_density_kg_m3) : null;
    const localAirProps = createAirPropertiesContext({ temperatureC: Number(source?.air_temp_c ?? airTemperatureC), altitudeM: positiveValue(environment?.altitude_m, source?.altitude_m) || null, pressureKPa: positiveValue(environment?.atmospheric_pressure_kpa, source?.atmospheric_pressure_kpa) || null, relativeHumidityPercent: positiveValue(environment?.relative_humidity_percent, source?.relative_humidity_percent) || null, airDensityKgM3: localManualDensity, airSpecificHeatKJkgK: positiveValue(source?.air_specific_heat_kj_kg_k) || null, mode: "sublimation" });
    const balanceAirflow = requiredAirflowForLoadM3H(loadKW, airDeltaTK, localAirProps.densityKgM3, localAirProps.specificHeatKJkgK) || positiveValue(thermalResult.requiredAirflowM3H, tunnelResult.airFlowM3H, source?.informed_air_flow_m3_h, source?.airflow_m3_h);
    const blockageFactor = recommendedBlockageFactor(tunnelType, source?.arrangement_type ?? form.arrangement_type);
    const horizontal = [dimensions.lengthM, dimensions.widthM].filter((value) => value > 0).sort((a, b) => a - b);
    const smallerWallM = horizontal[0] || positiveValue(source?.tunnel_cross_section_width_m);
    const largerWallM = horizontal[1] || smallerWallM || positiveValue(source?.tunnel_cross_section_width_m);
    const loadHeightM = positiveValue(source?.pallet_height_m, source?.box_height_m, source?.product_height_m, source?.bulk_layer_height_m);
    const heightByLoadM = loadHeightM > 0 && dimensions.heightM > 0 ? Math.max(dimensions.heightM - loadHeightM, dimensions.heightM * 0.3) : 0;
    const usefulHeightM = heightByLoadM || (dimensions.heightM > 0 ? dimensions.heightM * 0.6 : positiveValue(source?.tunnel_cross_section_height_m));
    const optionFor = (wall: "menor" | "maior", widthM: number, throwM: number) => {
      const grossAreaM2 = widthM * usefulHeightM;
      const freeAreaM2 = grossAreaM2 * Math.max(0.05, 1 - blockageFactor);
      const referenceVelocityMS = recommendedTunnelAirVelocity(tunnelType, isStatic);
      const velocityAirflow = airflowForVelocityM3H(freeAreaM2, referenceVelocityMS);
      const fanAirflowM3H = Math.max(balanceAirflow, tunnelLike ? velocityAirflow : balanceAirflow);
      const velocityMS = fanAirflowM3H > 0 && freeAreaM2 > 0 ? fanAirflowM3H / 3600 / freeAreaM2 : 0;
      const status = airflowVelocityStatus(velocityMS, tunnelLike);
      const idealPenalty = tunnelLike ? Math.abs(velocityMS - 3) : Math.abs(velocityMS - 0.5);
      const score = (status.status === "adequada" ? 100 : status.status === "aceitável" ? 80 : status.status === "baixa" ? 35 : 55) - idealPenalty * 8 + (throwM >= widthM ? 10 : 0);
      return { wall, widthM, throwM, grossAreaM2, freeAreaM2, velocityMS, status, score, fanAirflowM3H, balanceAirflow, velocityAirflow, referenceVelocityMS };
    };
    const wallOptions = [optionFor("menor", smallerWallM, largerWallM), optionFor("maior", largerWallM, smallerWallM)];
    const selected = tunnelLike ? wallOptions[0] : wallOptions.sort((a, b) => b.score - a.score)[0];
    const observation = selected.status.status === "baixa" && tunnelLike
      ? "A vazão calculada atende ao balanço térmico, mas a velocidade no produto está baixa para túnel. Avaliar maior vazão, dutos, plenum, menor seção livre ou alteração da posição do equipamento."
      : selected.status.warning || "Instalação sugerida pela seção livre, alcance de ar e faixa de velocidade recomendada.";
    return {
      airflow_source: "airflow_by_fans",
      fan_airflow_m3_h: roundPreset(selected.fanAirflowM3H, 2),
      informed_air_flow_m3_h: roundPreset(selected.fanAirflowM3H, 2),
      airflow_m3_h: roundPreset(selected.fanAirflowM3H, 2),
      airflow_thermal_balance_m3_h: roundPreset(selected.balanceAirflow, 2),
      airflow_velocity_reference_m3_h: roundPreset(selected.velocityAirflow, 2),
      airflow_reference_velocity_m_s: roundPreset(selected.referenceVelocityMS, 2),
      tunnel_cross_section_width_m: roundPreset(selected.widthM, 3),
      tunnel_cross_section_height_m: roundPreset(usefulHeightM, 3),
      blockage_factor: roundPreset(clamp(blockageFactor, 0, 0.9), 4),
      blockage_factor_input_mode: "decimal",
      air_delta_t_k: airDeltaTK,
      air_temp_c: Number.isFinite(Number(source?.air_temp_c)) ? source?.air_temp_c : airTemperatureC,
      air_velocity_m_s: roundPreset(selected.velocityMS, 2),
      airflow_installation_wall: selected.wall === "menor" ? "Parede menor" : "Parede maior",
      airflow_blow_direction: selected.throwM >= selected.widthM ? "Sopro no sentido do comprimento maior" : "Sopro no sentido do comprimento menor",
      airflow_useful_height_m: roundPreset(usefulHeightM, 3),
      airflow_free_area_m2: roundPreset(selected.freeAreaM2, 3),
      airflow_velocity_status: selected.status.status,
      airflow_technical_note: observation,
    };
  }, [airTemperatureC, environment, form, isStatic, thermalResult.productLoadKw, thermalResult.requiredAirflowM3H, thermalResult.totalProcessLoadKw, tunnel, tunnelResult.airFlowM3H, tunnelResult.productLoadKW, tunnelResult.totalKW, tunnelType]);

  const applyAirflowPreset = React.useCallback(() => {
    setForm((prev) => {
      if (airOperationMode === "design_to_time") {
        const targetH = requiredConvectiveCoefficientForTimeWM2K({ densityKgM3: positiveValue(manualDensityKgM3, ashraeDensityKgM3, productDensityKgM3), latentHeatKcalKg, frozenWaterFraction, freezingPointC, airTempC: airTemperatureC, distanceToCoreM: tunnelResult.distanceToCoreM, kEffectiveWMK: tunnelResult.kEffectiveWMK, targetTimeMin: tunnelResult.availableTimeMin });
        const exposure = Number(tunnelResult.h.airExposureFactor ?? prev.air_exposure_factor ?? 1) * Number(tunnelResult.h.exposureFactor ?? 1);
        const requiredVelocityMS = targetH > 10 * exposure ? Math.pow((targetH / exposure - 10) / 10, 1 / 0.8) : positiveValue(prev.air_velocity_m_s) || recommendedTunnelAirVelocity(tunnelType, isStatic);
        const freeAreaM2 = freeAirAreaFromControls(prev);
        const airflowM3H = airflowForVelocityM3H(freeAreaM2, requiredVelocityMS) || requiredAirflowForLoadM3H(tunnelResult.totalKW, positiveValue(prev.air_delta_t_k) || 6, airProperties.densityKgM3, airProperties.specificHeatKJkgK);
        return { ...prev, airflow_source: "airflow_by_fans", air_temp_source: "manual", air_temp_c: Number(prev.air_temp_c ?? airTemperatureC), fan_airflow_m3_h: roundPreset(airflowM3H, 2), informed_air_flow_m3_h: roundPreset(airflowM3H, 2), airflow_m3_h: roundPreset(airflowM3H, 2), air_velocity_m_s: roundPreset(requiredVelocityMS, 3), airflow_free_area_m2: freeAreaM2 > 0 ? roundPreset(freeAreaM2, 3) : prev.airflow_free_area_m2 };
      }
      return { ...prev, ...buildAirflowPreset(prev) };
    });
  }, [airOperationMode, airProperties.densityKgM3, airProperties.specificHeatKJkgK, airTemperatureC, ashraeDensityKgM3, buildAirflowPreset, freezingPointC, frozenWaterFraction, isStatic, latentHeatKcalKg, manualDensityKgM3, productDensityKgM3, tunnelResult.availableTimeMin, tunnelResult.distanceToCoreM, tunnelResult.h.airExposureFactor, tunnelResult.h.exposureFactor, tunnelResult.kEffectiveWMK, tunnelResult.totalKW, tunnelType]);

  const loadBreakdown = tunnelResult.calculationBreakdown.loads ?? {};
  const modelBreakdown = tunnelResult.calculationBreakdown.model ?? {};
  const airBreakdown = (tunnelResult.calculationBreakdown.air ?? {}) as Record<string, any>;
  const displayedAirProperties = (airBreakdown.airProperties ?? airProperties) as typeof airProperties;
  const productLoadMissingFields = Array.isArray(loadBreakdown.productLoadMissingFields) ? loadBreakdown.productLoadMissingFields : [];
  const requiredAirflowM3H = requiredAirflowForLoadM3H(tunnelResult.totalKW, positiveValue(form.air_delta_t_k) || 6, displayedAirProperties.densityKgM3, displayedAirProperties.specificHeatKJkgK) || tunnelResult.airFlowM3H;
  const informedFanAirflowM3H = positiveValue(form.fan_airflow_m3_h);
  const chamberDimensions = resolveChamberDimensions(environment, { ...(tunnel ?? {}), ...form });
  const displayedAirVelocityMS = positiveValue(form.air_velocity_m_s, tunnelResult.calculatedAirVelocityMS);
  const displayedAirStatus = airflowVelocityStatus(displayedAirVelocityMS, ["continuous_belt", "spiral_girofreezer", "static_cart", "static_pallet", "fluidized_bed", "blast_freezer"].includes(tunnelType));
  const displayedFreeAirAreaM2 = positiveValue(form.airflow_free_area_m2, tunnelResult.freeAirAreaM2);
  const airflowReferenceVelocityMS = positiveValue(form.airflow_reference_velocity_m_s) || recommendedTunnelAirVelocity(tunnelType, isStatic);
  const referenceVelocityAirflowM3H = airflowForVelocityM3H(displayedFreeAirAreaM2, airflowReferenceVelocityMS);
  const designRequiredAirflowM3H = Math.max(requiredAirflowM3H, referenceVelocityAirflowM3H);
  const airflowDeltaM3H = informedFanAirflowM3H - designRequiredAirflowM3H;
  const airflowDeltaPercent = designRequiredAirflowM3H > 0 ? Math.abs(airflowDeltaM3H) / designRequiredAirflowM3H * 100 : 0;
  const showAirflowMismatch = form.airflow_source === "airflow_by_fans" && designRequiredAirflowM3H > 0 && informedFanAirflowM3H > 0 && airflowDeltaPercent > 5;
  const displayedAirWall = textValue(form.airflow_installation_wall, tunnelType === "blast_freezer" ? "Parede menor" : "—");
  const displayedAirDirection = textValue(form.airflow_blow_direction, tunnelType === "blast_freezer" ? "Sopro no sentido do comprimento maior" : "—");
  const displayedAirNote = textValue(form.airflow_technical_note, displayedAirStatus.warning || "Clique em Calcular ar para atualizar a recomendação pela carga térmica e dimensões do ambiente.");
  const airDeltaTK = positiveValue(form.air_delta_t_k) || 6;
  const evaporatorTempC = airTemperatureC - airDeltaTK;
  const manualHWM2K = positiveValue(form.convective_coefficient_manual_w_m2_k);
  const hSuggestedWM2K = suggestedConvectiveCoefficientWM2K(displayedAirVelocityMS, Number(tunnelResult.h.airExposureFactor ?? form.air_exposure_factor ?? 1), Number(tunnelResult.h.exposureFactor ?? 1));
  const hEffectiveWM2K = manualHWM2K > 0 ? manualHWM2K : hSuggestedWM2K;
  const requiredHForRetentionWM2K = requiredConvectiveCoefficientForTimeWM2K({ densityKgM3: positiveValue(manualDensityKgM3, ashraeDensityKgM3, productDensityKgM3), latentHeatKcalKg, frozenWaterFraction, freezingPointC, airTempC: airTemperatureC, distanceToCoreM: tunnelResult.distanceToCoreM, kEffectiveWMK: tunnelResult.kEffectiveWMK, targetTimeMin: tunnelResult.availableTimeMin });
  const maxDesignVelocityMS = positiveValue(form.max_air_velocity_m_s) || 6;
  const maxSuggestedHWM2K = suggestedConvectiveCoefficientWM2K(maxDesignVelocityMS, Number(tunnelResult.h.airExposureFactor ?? form.air_exposure_factor ?? 1), Number(tunnelResult.h.exposureFactor ?? 1));
  const designWithinLimits = requiredHForRetentionWM2K > 0 && maxSuggestedHWM2K > 0 ? requiredHForRetentionWM2K <= maxSuggestedHWM2K : true;
  const processStatusText = manualHWM2K <= 0 ? "Preliminar" : tunnelResult.status === "adequate" ? "Suficiente" : tunnelResult.status === "missing_data" ? "Faltam dados" : "Insuficiente";
  const setAirTemperatureSource = (value: string) => setForm((prev) => ({ ...prev, air_temp_source: value, air_temp_c: value === "environment" ? environmentInternalTempC : prev.air_temp_c }));
  const evapTempNum = (): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(evaporatorTempC), onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const nextEvap = numberOrNull(e.target.value); setAirTempCalcBase("edit_evap"); setForm((prev) => ({ ...prev, air_temp_source: "manual", air_temp_c: nextEvap === null ? null : nextEvap + (positiveValue(prev.air_delta_t_k) || 6) })); } });
  const airDeltaNum = (): NumericInputProps => ({ type: "number", step: "0.0001", value: inputValue(form?.air_delta_t_k), onChange: (e: React.ChangeEvent<HTMLInputElement>) => { const nextDelta = numberOrNull(e.target.value); setForm((prev) => { const delta = nextDelta ?? 0; const nextAir = airTempCalcBase === "edit_evap" ? evaporatorTempC + delta : prev.air_temp_c; return { ...prev, air_delta_t_k: nextDelta, air_temp_c: nextAir }; }); } });
  const useSuggestedH = () => setForm((prev) => ({ ...prev, convective_coefficient_manual_w_m2_k: roundPreset(hSuggestedWM2K, 2) }));
  const applyTunnelTempToEnvironment = () => setEnvironmentAirTempOverrideC(airTemperatureC);
  const airflowValidationIssues = [
    tunnelResult.totalKW <= 0 ? { tone: "error" as const, text: "Carga térmica total zerada ou inválida; revise massa, tempo, propriedades térmicas e cargas internas antes de dimensionar ar." } : null,
    tunnelResult.productLoadKW <= 0 ? { tone: "error" as const, text: "Carga térmica do produto zerada; a vazão pode ficar subestimada." } : null,
    requiredAirflowM3H > 0 && informedFanAirflowM3H > 0 && informedFanAirflowM3H < requiredAirflowM3H * 0.95 ? { tone: "error" as const, text: `Vazão informada abaixo do balanço térmico em ${fmtAirflow(requiredAirflowM3H - informedFanAirflowM3H)}.` } : null,
    designRequiredAirflowM3H > 0 && informedFanAirflowM3H > 0 && informedFanAirflowM3H < designRequiredAirflowM3H * 0.95 ? { tone: "warning" as const, text: `Vazão abaixo da referência de velocidade do túnel em ${fmtAirflow(designRequiredAirflowM3H - informedFanAirflowM3H)}.` } : null,
    displayedFreeAirAreaM2 <= 0 ? { tone: "error" as const, text: "Seção livre de passagem não calculada; informe largura, altura útil e bloqueio." } : null,
    displayedAirStatus.warning ? { tone: "warning" as const, text: displayedAirStatus.warning } : null,
    manualHWM2K <= 0 ? { tone: "warning" as const, text: "Para validação final, informe o coeficiente convectivo manual ou use o h sugerido." } : null,
    airOperationMode === "design_to_time" && !designWithinLimits ? { tone: "error" as const, text: "Mesmo nos limites operacionais, o tempo solicitado não fecha." } : null,
    productLoadMissingFields.length > 0 ? { tone: "warning" as const, text: `Carga do produto pendente: falta ${productLoadMissingFields.join(", ")}.` } : null,
  ].filter(Boolean) as Array<{ tone: "error" | "warning"; text: string }>;
  const productLoadMassDescription = isStatic
    ? `${fmtColdPro(loadBreakdown.massUsedForProductLoad ?? tunnelResult.staticMassKg)} kg ÷ ${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h × energia específica`
    : `${fmtColdPro(loadBreakdown.massUsedForProductLoad ?? tunnelResult.usedMassKgH)} kg/h × energia específica`;

  React.useEffect(() => {
    const presetKey = `${environmentId}:${tunnel?.id ?? "new"}`;
    const hasAirInputs = positiveValue(form.fan_airflow_m3_h, form.tunnel_cross_section_width_m, form.tunnel_cross_section_height_m, form.informed_air_flow_m3_h) > 0;
    if (autoAirPresetKeyRef.current === presetKey || hasAirInputs || tunnelResult.airFlowM3H <= 0) return;
    autoAirPresetKeyRef.current = presetKey;
    setForm((prev) => ({ ...prev, ...buildAirflowPreset(prev) }));
  }, [buildAirflowPreset, environmentId, form.fan_airflow_m3_h, form.informed_air_flow_m3_h, form.tunnel_cross_section_height_m, form.tunnel_cross_section_width_m, tunnel?.id, tunnelResult.airFlowM3H]);

  const setProcessType = (value: string) => {
    const tunnel = legacyTunnelType(value);
    const arrangement = defaultArrangement(tunnel);
    const defaults = ARRANGEMENT_DEFAULTS[arrangement];
    const nextIsStatic = isStaticProcess(tunnel);
    setForm((prev) => ({ ...prev, process_type: value, tunnel_type: tunnel, physical_model: physicalModelFromProcess(tunnel), operation_mode: nextIsStatic ? "batch" : "continuous", tunnel_mode: nextIsStatic ? "static" : "continuous", arrangement_type: arrangement, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
    setActiveTab(nextIsStatic ? "estatico" : "continuo");
  };

  const setTunnelType = (value: string) => {
    const arrangement = defaultArrangement(value);
    const defaults = ARRANGEMENT_DEFAULTS[arrangement];
    const nextIsStatic = isStaticProcess(value);
    setForm((prev) => {
      const nextMode = nextIsStatic ? String(prev.continuous_mass_mode ?? "direct_mass_flow") : resolveContinuousMassMode(prev, value);
      return { ...prev, tunnel_type: value, process_type: value, physical_model: physicalModelFromProcess(value), operation_mode: nextIsStatic ? "batch" : "continuous", tunnel_mode: nextIsStatic ? "static" : "continuous", arrangement_type: arrangement, static_mass_mode: nextIsStatic ? defaultMassModeForTunnel(value) : prev.static_mass_mode, continuous_mass_mode: value !== "fluidized_bed" ? nextMode : prev.continuous_mass_mode, mass_flow_mode: value === "fluidized_bed" ? nextMode : prev.mass_flow_mode, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration, ...suggestedStaticArrangementFields(value, arrangement) };
    });
    setActiveTab(nextIsStatic ? "estatico" : "continuo");
  };

  const setArrangementType = (value: string) => {
    const defaults = ARRANGEMENT_DEFAULTS[value] ?? ARRANGEMENT_DEFAULTS.individual_units;
    setForm((prev) => ({ ...prev, arrangement_type: value, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration, ...suggestedStaticArrangementFields(String(prev.tunnel_type ?? tunnelType), value) }));
  };

  const resetSimulation = () => setSimulation(simulationDraftFromTunnel(form));

  const approveThermalCondition = () => {
    if (adjustedScenario.status !== "adequate") {
      window.alert("Condição térmica ainda não atende o tempo de processo. Ajuste temperatura, velocidade ou tempo de batelada/retenção.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      ...simulation,
      calculated_air_velocity_m_s: simulationResult.calculatedAirVelocityMS ?? null,
      air_velocity_used_m_s: simulationResult.airVelocityUsedMS ?? null,
      gross_air_area_m2: simulationResult.grossAirAreaM2 ?? null,
      free_air_area_m2: simulationResult.freeAirAreaM2 ?? null,
      approved_air_temp_c: adjustedScenario.airTempC,
      approved_air_velocity_m_s: adjustedScenario.airVelocityMS,
      approved_air_delta_t_k: adjustedScenario.airDeltaTK,
      approved_air_flow_m3_h: adjustedScenario.informedAirFlowM3H ?? adjustedScenario.airFlowM3H,
      approved_convective_coefficient_w_m2_k: adjustedScenario.hEffectiveWM2K,
      approved_packaging_type: prev.package_type ?? "",
      approved_air_exposure_factor: Number(simulation.air_exposure_factor ?? 1),
      approved_thermal_penetration_factor: Number(simulation.thermal_penetration_factor ?? 1),
      approved_process_status: adjustedScenario.status,
      approved_estimated_time_min: adjustedScenario.estimatedTimeMin,
      approved_total_kw: adjustedScenario.totalKW,
      approved_total_kcal_h: adjustedScenario.totalKcalH,
      approved_total_tr: adjustedScenario.totalTR,
      thermal_condition_approved: true,
      thermal_condition_approved_at: new Date().toISOString(),
    }));
  };

  const applyProduct = (id: string) => {
    const p = productCatalog.find((item) => item.id === id);
    if (!p) return;
    const kcalProduct = normalizeProductForKcalEngine(p);
    const catalogGeometry = geometryFromCatalogShape(p.geometry_shape);
    const lengthM = Number(p.length_mm ?? 0) > 0 ? Number(p.length_mm) / 1000 : null;
    const widthM = Number(p.width_mm ?? 0) > 0 ? Number(p.width_mm) / 1000 : null;
    const heightM = Number(p.height_or_thickness_mm ?? 0) > 0 ? Number(p.height_or_thickness_mm) / 1000 : null;
    const characteristicM = Number(p.characteristic_thickness_m ?? 0) > 0 ? Number(p.characteristic_thickness_m) : Number(p.characteristic_thickness_mm ?? 0) > 0 ? Number(p.characteristic_thickness_mm) / 1000 : null;
    setForm((prev) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
      catalog_approximate_volume_cm3: p.approximate_volume_cm3 ?? prev.catalog_approximate_volume_cm3 ?? null,
      catalog_geometry_observations: p.observations ?? prev.catalog_geometry_observations ?? null,
      product_geometry: catalogGeometry ?? prev.product_geometry,
      product_length_m: lengthM ?? prev.product_length_m,
      product_width_m: widthM ?? prev.product_width_m,
      product_height_m: heightM ?? prev.product_height_m,
      product_thickness_m: characteristicM ?? heightM ?? prev.product_thickness_m,
      product_thickness_mm: characteristicM ? characteristicM * 1000 : p.characteristic_thickness_mm ?? prev.product_thickness_mm,
      product_diameter_m: catalogGeometry === "cylinder" || catalogGeometry === "sphere" ? (widthM ?? lengthM ?? prev.product_diameter_m) : prev.product_diameter_m,
      equivalent_diameter_m: characteristicM ?? prev.equivalent_diameter_m,
      characteristic_dimension_m: characteristicM ?? prev.characteristic_dimension_m,
      box_length_m: catalogGeometry === "packed_box" ? (lengthM ?? prev.box_length_m) : prev.box_length_m,
      box_width_m: catalogGeometry === "packed_box" ? (widthM ?? prev.box_width_m) : prev.box_width_m,
      box_height_m: catalogGeometry === "packed_box" ? (heightM ?? prev.box_height_m) : prev.box_height_m,
      freezing_temp_c: p.initial_freezing_temp_c ?? prev.freezing_temp_c,
      density_kg_m3: p.density_kg_m3 ?? prev.density_kg_m3,
      ashrae_density_kg_m3: p.density_kg_m3 ?? prev.ashrae_density_kg_m3 ?? 0,
      specific_heat_above_kj_kg_k: p.specific_heat_above_kj_kg_k ?? null,
      specific_heat_below_kj_kg_k: p.specific_heat_below_kj_kg_k ?? null,
      specific_heat_above_kcal_kg_c: kcalProduct.cpAboveKcalKgC || Number(p.specific_heat_above_kcal_kg_c ?? prev.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: kcalProduct.cpBelowKcalKgC || Number(p.specific_heat_below_kcal_kg_c ?? prev.specific_heat_below_kcal_kg_c),
      latent_heat_kj_kg: p.latent_heat_kj_kg ?? null,
      latent_heat_kcal_kg: kcalProduct.latentHeatKcalKg || Number(p.latent_heat_kcal_kg ?? prev.latent_heat_kcal_kg),
      thermal_conductivity_unfrozen_w_m_k: p.thermal_conductivity_unfrozen_w_m_k ?? null,
      thermal_conductivity_frozen_w_m_k: p.thermal_conductivity_frozen_w_m_k ?? prev.thermal_conductivity_frozen_w_m_k,
      water_content_percent: p.water_content_percent ?? null,
      protein_content_percent: p.protein_content_percent ?? null,
      fat_content_percent: p.fat_content_percent ?? null,
      carbohydrate_content_percent: p.carbohydrate_content_percent ?? null,
      fiber_content_percent: p.fiber_content_percent ?? null,
      ash_content_percent: p.ash_content_percent ?? null,
      frozen_water_fraction: p.frozen_water_fraction ?? null,
      freezable_water_content_percent: p.freezable_water_content_percent ?? null,
      respiration_rate_0c_mw_kg: p.respiration_rate_0c_mw_kg ?? null,
      respiration_rate_5c_mw_kg: p.respiration_rate_5c_mw_kg ?? null,
      respiration_rate_10c_mw_kg: p.respiration_rate_10c_mw_kg ?? null,
      respiration_rate_15c_mw_kg: p.respiration_rate_15c_mw_kg ?? null,
      respiration_rate_20c_mw_kg: p.respiration_rate_20c_mw_kg ?? null,
      notes: p.notes ?? null,
    }));
    setSelectedGroup(textValue(p.category));
    setProductSearch(textValue(p.name));
    setShowProductSuggestions(false);
  };

  const save = async () => {
    const selectedCatalogKcal = selectedCatalogProduct ? normalizeProductForKcalEngine(selectedCatalogProduct) : null;
    const payload = {
    ...form,
    ...(selectedCatalogProduct ? {
      product_name: selectedCatalogProduct.name,
      freezing_temp_c: selectedCatalogProduct.initial_freezing_temp_c ?? form.freezing_temp_c,
      density_kg_m3: selectedCatalogProduct.density_kg_m3 ?? form.density_kg_m3,
      ashrae_density_kg_m3: selectedCatalogProduct.density_kg_m3 ?? form.ashrae_density_kg_m3,
      specific_heat_above_kj_kg_k: selectedCatalogProduct.specific_heat_above_kj_kg_k ?? null,
      specific_heat_below_kj_kg_k: selectedCatalogProduct.specific_heat_below_kj_kg_k ?? null,
      specific_heat_above_kcal_kg_c: selectedCatalogKcal?.cpAboveKcalKgC ?? Number(selectedCatalogProduct.specific_heat_above_kcal_kg_c ?? form.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: selectedCatalogKcal?.cpBelowKcalKgC ?? Number(selectedCatalogProduct.specific_heat_below_kcal_kg_c ?? form.specific_heat_below_kcal_kg_c),
      latent_heat_kj_kg: selectedCatalogProduct.latent_heat_kj_kg ?? null,
      latent_heat_kcal_kg: selectedCatalogKcal?.latentHeatKcalKg ?? Number(selectedCatalogProduct.latent_heat_kcal_kg ?? form.latent_heat_kcal_kg),
      thermal_conductivity_frozen_w_m_k: selectedCatalogProduct.thermal_conductivity_frozen_w_m_k ?? form.thermal_conductivity_frozen_w_m_k,
      thermal_conductivity_unfrozen_w_m_k: selectedCatalogProduct.thermal_conductivity_unfrozen_w_m_k ?? selectedCatalogProduct.thermal_conductivity_w_m_k ?? null,
      water_content_percent: selectedCatalogProduct.water_content_percent ?? null,
      protein_content_percent: selectedCatalogProduct.protein_content_percent ?? null,
      fat_content_percent: selectedCatalogProduct.fat_content_percent ?? null,
      carbohydrate_content_percent: selectedCatalogProduct.carbohydrate_content_percent ?? null,
      frozen_water_fraction: selectedCatalogProduct.frozen_water_fraction ?? null,
      freezable_water_content_percent: selectedCatalogProduct.freezable_water_content_percent ?? null,
    } : {}),
    physical_model: tunnelResult.physicalModel,
    tunnel_type: tunnelResult.tunnelType,
    arrangement_type: tunnelResult.arrangementType,
    spiral_turbulence_factor: Number(form.spiral_turbulence_factor ?? 1.8),
    block_exposure_factor: Number(form.block_exposure_factor ?? 0.7),
    static_mass_mode: staticMassMode,
    batch_mass_mode: tunnelType === "blast_freezer" ? staticMassMode : form.batch_mass_mode ?? null,
    continuous_mass_mode: tunnelType !== "fluidized_bed" ? continuousMassMode : form.continuous_mass_mode ?? null,
    mass_flow_mode: tunnelType === "fluidized_bed" ? continuousMassMode : form.mass_flow_mode ?? null,
    units_per_box: Number(form.units_per_box ?? 0) || null,
    boxes_per_layer: Number(form.boxes_per_layer ?? 0) || null,
    number_of_layers: Number(form.number_of_layers ?? 0) || null,
    boxes_per_batch: Number(form.boxes_per_batch ?? 0) || null,
    racks_count: Number(form.racks_count ?? 0) || null,
    containers_count: Number(form.containers_count ?? 0) || null,
    total_units_per_pallet: Number(form.total_units_per_pallet ?? 0) || null,
    box_packaging_weight_kg: Number(form.box_packaging_weight_kg ?? 0) || null,
    pallet_base_weight_kg: Number(form.pallet_base_weight_kg ?? 0) || null,
    packaging_weight_kg: Number(form.packaging_weight_kg ?? 0) || null,
    units_per_tray: Number(form.units_per_tray ?? 0) || null,
    trays_per_cart: Number(form.trays_per_cart ?? 0) || null,
    number_of_carts: Number(form.number_of_carts ?? 0) || null,
    tray_packaging_weight_kg: Number(form.tray_packaging_weight_kg ?? 0) || null,
    cart_structure_weight_kg: Number(form.cart_structure_weight_kg ?? 0) || null,
    calculated_cart_mass_kg: calculatedCartMassKg || null,
    direct_batch_mass_kg: Number(form.direct_batch_mass_kg ?? 0) || null,
    calculated_batch_mass_kg: calculatedBatchMassKg || null,
    trays_per_hour: Number(form.trays_per_hour ?? 0) || null,
    tray_weight_kg: Number(form.tray_weight_kg ?? 0) || null,
    units_per_hour: Number(form.units_per_hour ?? 0) || null,
    units_per_row: Number(form.units_per_row ?? 0) || null,
    rows_per_meter: Number(form.rows_per_meter ?? 0) || null,
    belt_speed_m_min: Number(form.belt_speed_m_min ?? 0) || null,
    belt_width_m: Number(form.belt_width_m ?? 0) || null,
    belt_effective_length_m: Number(form.belt_effective_length_m ?? 0) || null,
    belt_area_m2: beltSurfaceInformedAreaM2 || beltSurfaceAreaM2 || null,
    belt_surface_density_kg_m2: Number(form.belt_surface_density_kg_m2 ?? 0) || null,
    belt_mass_on_belt_kg: beltSurfaceMassKg || null,
    belt_linear_load_kg_m: beltLinearLoadKgM || null,
    belt_flow_by_retention_kg_h: beltFlowByRetentionKgH || null,
    belt_flow_by_speed_kg_h: beltFlowBySpeedKgH || null,
    belt_calculated_flow_kg_h: beltSurfaceFlowKgH || null,
    belt_nominal_capacity_kg_h: Number(form.belt_nominal_capacity_kg_h ?? 0) || null,
    belt_calculated_retention_min: beltCalculatedRetentionMin || null,
    belt_capacity_deviation_percent: beltCapacityDeviationPercent,
    belt_motor_inside_environment: form.belt_motor_inside_environment !== false,
    belt_motor_dissipation_factor: form.belt_motor_inside_environment === false ? Number(form.belt_motor_dissipation_factor ?? 0) : 1,
    feed_rate_kg_h: Number(form.feed_rate_kg_h ?? 0) || null,
    units_per_pallet: (tunnelResult.unitsPerPallet ?? unitsPerPallet) || null,
    product_mass_per_pallet_kg: (tunnelResult.productMassPerPalletKg ?? productMassPerPalletKg) || null,
    packaging_mass_per_pallet_kg: (tunnelResult.packagingMassPerPalletKg ?? packagingMassPerPalletKg) || null,
    calculated_pallet_mass_kg: (tunnelResult.calculatedPalletMassKg ?? calculatedPalletMassKg) || null,
    pallet_mass_kg: staticMassMode === "calculated_pallet_composition" ? (tunnelResult.calculatedPalletMassKg ?? calculatedPalletMassKg) : Number(form.pallet_mass_kg ?? 0),
    staticMassKg: tunnelResult.staticMassKg ?? null,
    static_mass_kg: tunnelResult.staticMassKg ?? null,
    product_name: String((selectedCatalogProduct?.name ?? form.product_name) ?? "").trim(),
    product_thickness_m: productThicknessM,
    product_thickness_mm: productThicknessM * 1000,
    product_unit_weight_kg: Number(form.product_unit_weight_kg ?? 0) || Number(form.unit_weight_kg ?? 0),
    air_temp_c: airTemperatureC,
    density_kg_m3: manualDensityKgM3 || densityFieldKgM3,
    freezing_temp_c: freezingPointC,
    specific_heat_above_kcal_kg_c: cpAboveKcalKgC,
    specific_heat_below_kcal_kg_c: cpBelowKcalKgC,
    latent_heat_kcal_kg: latentHeatKcalKg,
    thermal_conductivity_frozen_w_m_k: frozenConductivityWmK,
    frozen_water_fraction: frozenWaterFraction,
    mass_kg_hour: isStatic ? 0 : massHour,
    air_temp_source: airTempSource,
    thermal_characteristic_dimension_m: tunnelResult.characteristicDimensionM || null,
    distance_to_core_m: tunnelResult.distanceToCoreM || null,
    calculation_warnings: tunnelResult.warnings ?? [],
    missing_fields: tunnelResult.missingFields ?? [],
    calculation_breakdown: tunnelResult.calculationBreakdown ?? {},
    calculation_log: tunnelResult.calculationLog ?? {},
    estimated_freezing_time_min: tunnelResult.estimatedTimeMin ?? null,
    process_status: tunnelResult.status ?? null,
    calculated_mass_kg_h: tunnelResult.calculatedMassKgH ?? null,
    used_mass_kg_h: tunnelResult.usedMassKgH ?? null,
    tunnel_product_load_kw: tunnelResult.productLoadKW ?? null,
    tunnel_packaging_load_kw: tunnelResult.packagingLoadKW ?? null,
    tunnel_internal_load_kw: tunnelResult.internalLoadKW ?? null,
    tunnel_total_load_kw: tunnelResult.totalKW ?? null,
    tunnel_total_load_kcal_h: tunnelResult.totalKcalH ?? null,
    tunnel_total_load_tr: tunnelResult.totalTR ?? null,
    airflow_m3_h: tunnelResult.airFlowM3H ?? null,
    recommended_airflow_m3_h: tunnelResult.airFlowM3H ?? null,
    airflow_source: form.airflow_source ?? "manual_velocity",
    fan_airflow_m3_h: Number(form.fan_airflow_m3_h ?? 0) || null,
    tunnel_cross_section_width_m: Number(form.tunnel_cross_section_width_m ?? 0) || null,
    tunnel_cross_section_height_m: Number(form.tunnel_cross_section_height_m ?? 0) || null,
    blockage_factor: Number(form.blockage_factor ?? 0),
    blockage_factor_input_mode: "decimal",
    calculated_air_velocity_m_s: tunnelResult.calculatedAirVelocityMS ?? null,
    air_velocity_used_m_s: tunnelResult.airVelocityUsedMS ?? null,
    gross_air_area_m2: tunnelResult.grossAirAreaM2 ?? null,
    free_air_area_m2: tunnelResult.freeAirAreaM2 ?? null,
    product_geometry: form.product_geometry ?? null,
    surface_exposure_model: form.surface_exposure_model ?? null,
    thermal_model_for_pallet: form.thermal_model_for_pallet ?? (tunnelType === "static_pallet" && form.arrangement_type === "palletized_boxes" ? "hybrid" : null),
    product_height_m: Number(form.product_height_m ?? 0) || null,
    product_side_m: Number(form.product_side_m ?? 0) || null,
    product_diameter_m: Number(form.product_diameter_m ?? 0) || null,
    equivalent_diameter_m: Number(form.equivalent_diameter_m ?? 0) || null,
    characteristic_dimension_m: Number(form.characteristic_dimension_m ?? 0) || null,
    box_length_m: Number(form.box_length_m ?? 0) || null,
    box_width_m: Number(form.box_width_m ?? 0) || null,
    box_height_m: Number(form.box_height_m ?? 0) || null,
    bulk_layer_height_m: Number(form.bulk_layer_height_m ?? 0) || null,
    equivalent_particle_diameter_m: Number(form.equivalent_particle_diameter_m ?? 0) || null,
    bed_width_m: Number(form.bed_width_m ?? 0) || null,
    bed_length_m: Number(form.bed_length_m ?? 0) || null,
    bed_area_m2: Number(form.bed_area_m2 ?? 0) || null,
    superficial_air_velocity_m_s: Number(form.superficial_air_velocity_m_s ?? 0) || null,
    informed_air_flow_m3_h: Number(form.informed_air_flow_m3_h ?? form.airflow_m3_h ?? 0) || null,
    air_flow_method: tunnelResult.airFlowMethod,
    suggested_air_temp_c: tunnelResult.suggestedAirTempC ?? null,
    suggested_air_method: tunnelResult.suggestedAirMethod,
    suggested_air_approach_k: tunnelResult.suggestedAirApproachK ?? null,
    air_delta_t_k: tunnelResult.airDeltaTK ?? form.air_delta_t_k ?? 6,
    approved_air_temp_c: form.approved_air_temp_c ?? null,
    approved_air_velocity_m_s: form.approved_air_velocity_m_s ?? null,
    approved_air_delta_t_k: form.approved_air_delta_t_k ?? null,
    approved_air_flow_m3_h: form.approved_air_flow_m3_h ?? null,
    approved_convective_coefficient_w_m2_k: form.approved_convective_coefficient_w_m2_k ?? null,
    approved_packaging_type: form.approved_packaging_type ?? null,
    approved_air_exposure_factor: form.approved_air_exposure_factor ?? null,
    approved_thermal_penetration_factor: form.approved_thermal_penetration_factor ?? null,
    approved_process_status: form.approved_process_status ?? null,
    approved_estimated_time_min: form.approved_estimated_time_min ?? null,
    approved_total_kw: form.approved_total_kw ?? null,
    approved_total_kcal_h: form.approved_total_kcal_h ?? null,
    approved_total_tr: form.approved_total_tr ?? null,
    packaging_mass_kg_batch: Number(form.packaging_mass_kg_batch ?? 0) || null,
    thermal_condition_approved: form.thermal_condition_approved === true,
    thermal_condition_approved_at: form.thermal_condition_approved_at ?? null,
  };
    const validatedPayload = coldProTunnelSaveSchema.safeParse(payload);
    if (!validatedPayload.success) {
      window.alert("Revise os campos obrigatórios do túnel antes de salvar.");
      return false;
    }
    const result = await onSave(validatedPayload.data);
    return result !== false;
  };

  React.useImperativeHandle(ref, () => ({ save }));

  const statusLabel: Record<string, string> = {
    adequate: "Adequado",
    insufficient: "Insuficiente",
    missing_data: "Faltam dados",
    invalid_input: "Dados inválidos",
  };
  const productEnergyAudit = (tunnelResult.calculationBreakdown.productEnergy ?? {}) as Record<string, any>;
  const unitAudit = (productEnergyAudit.unitAudit ?? {}) as Record<string, any>;
  const cpAboveAudit = (unitAudit.cpAbove ?? {}) as Record<string, unknown>;
  const cpBelowAudit = (unitAudit.cpBelow ?? {}) as Record<string, unknown>;
  const latentAudit = (unitAudit.latentHeat ?? {}) as Record<string, unknown>;
  const beltSurfaceBreakdown = ((tunnelResult as any).beltSurface ?? (tunnelResult.calculationBreakdown.mass as any)?.beltSurface ?? {}) as Record<string, number | null | undefined>;
  const continuousCapacityKgH = !isStatic ? positiveValue(tunnelResult.usedMassKgH, massHour) : 0;
  const availableTimeForMassMin = positiveValue(tunnelResult.availableTimeMin);
  const estimatedTimeForMassMin = tunnelResult.estimatedTimeMin !== null && tunnelResult.estimatedTimeMin !== undefined ? positiveValue(tunnelResult.estimatedTimeMin) : 0;
  const massInAvailableTimeKg = continuousCapacityKgH > 0 && availableTimeForMassMin > 0 ? continuousCapacityKgH * availableTimeForMassMin / 60 : 0;
  const beltSurfaceAreaForMassM2 = positiveValue(beltSurfaceBreakdown.areaM2);
  const beltSurfaceCalculatedAreaForMassM2 = positiveValue(beltSurfaceBreakdown.calculatedAreaM2) || positiveValue(form.belt_width_m) * positiveValue(form.belt_effective_length_m);
  const beltSurfaceInformedAreaForMassM2 = positiveValue(beltSurfaceBreakdown.informedAreaM2, form.belt_area_m2);
  const beltSurfaceDensityForMassKgM2 = positiveValue(beltSurfaceBreakdown.surfaceDensityKgM2);
  const beltPhysicalMassKg = positiveValue(beltSurfaceBreakdown.massOnBeltKg) || (beltSurfaceAreaForMassM2 > 0 && beltSurfaceDensityForMassKgM2 > 0 ? beltSurfaceAreaForMassM2 * beltSurfaceDensityForMassKgM2 : 0);
  const hasBeltPhysicalMass = continuousMassMode === "calculated_by_belt_surface_density" && beltPhysicalMassKg > 0;
  const instantTunnelMassKg = hasBeltPhysicalMass ? beltPhysicalMassKg : massInAvailableTimeKg;
  const beltAreaDeviationPercent = beltSurfaceInformedAreaForMassM2 > 0 && beltSurfaceCalculatedAreaForMassM2 > 0 ? Math.abs(beltSurfaceInformedAreaForMassM2 - beltSurfaceCalculatedAreaForMassM2) / Math.max(beltSurfaceInformedAreaForMassM2, beltSurfaceCalculatedAreaForMassM2) * 100 : 0;
  const showBeltAreaMismatch = continuousMassMode === "calculated_by_belt_surface_density" && beltSurfaceInformedAreaForMassM2 > 0 && beltSurfaceCalculatedAreaForMassM2 > 0 && beltAreaDeviationPercent > 5;
  const beltFlowMethodDeviationPercent = positiveValue(beltSurfaceBreakdown.flowMethodDeviationPercent) || (positiveValue(beltSurfaceBreakdown.flowBySpeedKgH) > 0 && positiveValue(beltSurfaceBreakdown.flowByRetentionKgH) > 0 ? Math.abs(positiveValue(beltSurfaceBreakdown.flowBySpeedKgH) - positiveValue(beltSurfaceBreakdown.flowByRetentionKgH)) / Math.max(positiveValue(beltSurfaceBreakdown.flowBySpeedKgH), positiveValue(beltSurfaceBreakdown.flowByRetentionKgH)) * 100 : 0);
  const showBeltFlowMismatch = continuousMassMode === "calculated_by_belt_surface_density" && positiveValue(beltSurfaceBreakdown.flowBySpeedKgH) > 0 && positiveValue(beltSurfaceBreakdown.flowByRetentionKgH) > 0 && beltFlowMethodDeviationPercent > 5;
  const nominalCapacityKgH = continuousCapacityKgH;
  const capacityKgMin = nominalCapacityKgH / 60;
  const projectedCycleMassKg = !isStatic && capacityKgMin > 0 && availableTimeForMassMin > 0 ? capacityKgMin * availableTimeForMassMin : instantTunnelMassKg;
  const thermalTimeRequiredMin = estimatedTimeForMassMin;
  const frozenFractionAtRetention = thermalTimeRequiredMin > 0 && availableTimeForMassMin > 0 ? clamp(availableTimeForMassMin / thermalTimeRequiredMin, 0, 1) : 0;
  const frozenMassAtRetentionKg = projectedCycleMassKg > 0 ? projectedCycleMassKg * frozenFractionAtRetention : 0;
  const cycleDeficitKg = Math.max(0, projectedCycleMassKg - frozenMassAtRetentionKg);
  const achievedPercent = projectedCycleMassKg > 0 ? frozenMassAtRetentionKg / projectedCycleMassKg * 100 : null;
  const retentionAdjustmentMin = thermalTimeRequiredMin > 0 && availableTimeForMassMin > 0 ? thermalTimeRequiredMin - availableTimeForMassMin : 0;
  const beltUsefulLengthM = positiveValue(form.belt_effective_length_m, beltSurfaceBreakdown.lengthM, beltSurfaceBreakdown.effectiveLengthM);
  const currentBeltSpeedMMin = beltUsefulLengthM > 0 && availableTimeForMassMin > 0 ? beltUsefulLengthM / availableTimeForMassMin : positiveValue(form.belt_speed_m_min, beltSurfaceBreakdown.speedMMin);
  const requiredBeltSpeedMMin = beltUsefulLengthM > 0 && thermalTimeRequiredMin > 0 ? beltUsefulLengthM / thermalTimeRequiredMin : 0;
  const beltSpeedVariationPercent = currentBeltSpeedMMin > 0 && requiredBeltSpeedMMin > 0 ? (requiredBeltSpeedMMin - currentBeltSpeedMMin) / currentBeltSpeedMMin * 100 : null;
  const adjustedCapacityKgH = projectedCycleMassKg > 0 && thermalTimeRequiredMin > 0 ? projectedCycleMassKg * 60 / thermalTimeRequiredMin : 0;
  const beltMassDifferencePercent = hasBeltPhysicalMass && massInAvailableTimeKg > 0 ? Math.abs(massInAvailableTimeKg - beltPhysicalMassKg) / Math.max(massInAvailableTimeKg, beltPhysicalMassKg) * 100 : 0;
  const showBeltMassMismatch = hasBeltPhysicalMass && massInAvailableTimeKg > 0 && beltMassDifferencePercent > 5;
  const showInsufficientTimeDiagnostic = !isStatic && projectedCycleMassKg > 0 && thermalTimeRequiredMin > availableTimeForMassMin && availableTimeForMassMin > 0;
  const tunnelResultCards = (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ColdProCalculatedInfo label="Modelo físico aplicado" value={tunnelResult.physicalModelLabel} description={modelBreakdown.physicalDescription} tone="info" />
        <ColdProCalculatedInfo label="Tipo de túnel" value={TUNNEL_TYPES[tunnelResult.tunnelType as keyof typeof TUNNEL_TYPES] ?? tunnelResult.tunnelType} description={tunnelResult.operationRegime === "batch" ? "batelada" : "contínuo"} tone="info" />
        <ColdProCalculatedInfo label="Tipo de arranjo" value={ARRANGEMENT_DEFAULTS[String(tunnelResult.arrangementType)]?.label ?? String(tunnelResult.arrangementType ?? "—")} description="arranjo usado no fator de exposição" tone="info" />
        <ColdProCalculatedInfo label="Geometria do produto" value={GEOMETRIES[String(tunnelResult.productGeometry) as keyof typeof GEOMETRIES] ?? String(tunnelResult.productGeometry ?? "—")} description={String(tunnelResult.geometrySource ?? "")} tone="info" />
        {tunnelResult.thermalModelForPallet ? <ColdProCalculatedInfo label="Modelo térmico do pallet" value={PALLET_THERMAL_MODELS[String(tunnelResult.thermalModelForPallet) as keyof typeof PALLET_THERMAL_MODELS] ?? String(tunnelResult.thermalModelForPallet)} description="separa caixa individual e bloco paletizado" tone="info" /> : null}
        <ColdProCalculatedInfo label="Premissa geométrica" value={tunnelResult.physicalModel === "static_block" ? "Bloco/pallet" : "Espessura"} description={modelBreakdown.geometryAssumption} tone="info" />
        <ColdProCalculatedInfo label={isStatic ? "Massa da batelada" : "Massa usada"} value={`${fmtColdPro(isStatic ? tunnelResult.staticMassKg : tunnelResult.usedMassKgH)} ${isStatic ? "kg" : "kg/h"}`} description={isStatic ? "massa usada na carga térmica" : "kg/h usado no motor"} tone={(isStatic ? tunnelResult.staticMassKg : tunnelResult.usedMassKgH) > 0 ? "success" : "warning"} />
        {isStatic ? <ColdProCalculatedInfo label="Massa total da batelada" value={`${fmtColdPro(tunnelResult.staticMassKg)} kg`} description="massa por pallet × número de pallets" tone={tunnelResult.staticMassKg > 0 ? "success" : "warning"} /> : <ColdProCalculatedInfo label="Massa por cadência" value={`${fmtColdPro(tunnelResult.calculatedMassKgH)} kg/h`} description="peso × unidades × ciclos/h" tone={tunnelResult.calculatedMassKgH > 0 ? "info" : "warning"} />}
        {continuousMassMode === "calculated_by_belt_surface_density" ? <><ColdProCalculatedInfo label="Método esteira" value="Densidade superficial da esteira" description="fluxo principal por velocidade" tone="success" /><ColdProCalculatedInfo label="Velocidade da esteira" value={`${fmtColdPro(beltSurfaceBreakdown.speedMMin, 3)} m/min`} description="comprimento útil ÷ tempo, ou valor informado" tone={Number(beltSurfaceBreakdown.speedMMin ?? 0) > 0 ? "success" : "warning"} /><ColdProCalculatedInfo label="Tempo de retenção" value={`${fmtColdPro(beltSurfaceBreakdown.retentionTimeMin, 2)} min`} description="tempo disponível dentro do túnel" tone={Number(beltSurfaceBreakdown.retentionTimeMin ?? 0) > 0 ? "success" : "warning"} /><ColdProCalculatedInfo label="Capacidade calculada" value={`${fmtColdPro(beltSurfaceBreakdown.calculatedFlowKgH, 1)} kg/h`} description="carga linear × velocidade × 60" tone={Number(beltSurfaceBreakdown.calculatedFlowKgH ?? 0) > 0 ? "success" : "warning"} /><ColdProCalculatedInfo label="Capacidade nominal" value={`${fmtColdPro(beltSurfaceBreakdown.nominalCapacityKgH, 1)} kg/h`} description="meta informada para comparação" tone="info" /><ColdProCalculatedInfo label="Diferença nominal" value={beltSurfaceBreakdown.capacityDeviationPercent == null ? "—" : `${fmtColdPro(beltSurfaceBreakdown.capacityDeviationPercent, 1)}%`} description="calculado × nominal" tone={Number(beltSurfaceBreakdown.capacityDeviationPercent ?? 0) > 10 ? "warning" : "success"} /><ColdProCalculatedInfo label="Massa sobre a esteira" value={`${fmtColdPro(beltSurfaceBreakdown.massOnBeltKg, 2)} kg`} description="largura × comprimento útil × densidade" tone="info" /><ColdProCalculatedInfo label="Área útil física" value={`${fmtColdPro(beltSurfaceBreakdown.calculatedAreaM2 ?? beltSurfaceBreakdown.areaM2, 2)} m²`} description="largura × comprimento útil" tone="info" /><ColdProCalculatedInfo label="Área útil manual" value={`${fmtColdPro(beltSurfaceBreakdown.informedAreaM2, 2)} m²`} description="apenas conferência visual" tone={Number(beltSurfaceBreakdown.informedAreaM2 ?? 0) > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Carga linear" value={`${fmtColdPro(beltSurfaceBreakdown.linearLoadKgM, 2)} kg/m`} description="densidade superficial × largura" tone="info" /><ColdProCalculatedInfo label="Fluxo por retenção" value={`${fmtColdPro(beltSurfaceBreakdown.flowByRetentionKgH, 1)} kg/h`} description="auditoria: massa ÷ tempo × 60" tone="info" /><ColdProCalculatedInfo label="Diferença entre métodos" value={`${fmtColdPro(beltFlowMethodDeviationPercent, 1)}%`} description="velocidade × retenção" tone={beltFlowMethodDeviationPercent > 5 ? "warning" : "success"} /><ColdProCalculatedInfo label="Densidade superficial" value={`${fmtColdPro(beltSurfaceBreakdown.surfaceDensityKgM2, 2)} kg/m²`} description="kg/m², não kg" tone="info" /></> : null}
        {!isStatic ? <ColdProCalculatedInfo label="Espessura do produto" value={`${fmtColdPro(productThicknessM, 3)} m`} description="dimensão informada" tone={productThicknessM > 0 ? "info" : "warning"} /> : null}
        {isStatic ? <ColdProCalculatedInfo label="Dimensões pallet/bloco" value={`${fmtColdPro(Number(form.pallet_length_m ?? 0), 2)} × ${fmtColdPro(Number(form.pallet_width_m ?? 0), 2)} × ${fmtColdPro(Number(form.pallet_height_m ?? 0), 2)} m`} description="C × L × A" tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} /> : null}
        <ColdProCalculatedInfo label={isStatic ? "Tempo de batelada" : "Tempo de retenção"} value={`${fmtColdPro(tunnelResult.availableTimeMin, 1)} min`} description={isStatic ? `${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h` : "tempo disponível"} tone={tunnelResult.availableTimeMin > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label={isStatic ? "Menor dimensão da carga" : "Dimensão característica"} value={`${fmtColdPro(tunnelResult.characteristicDimensionM, 3)} m`} description={isStatic ? "menor dimensão do pallet/carga" : "espessura do produto"} tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Distância até o núcleo" value={`${fmtColdPro(tunnelResult.distanceToCoreM * 1000, 1)} mm`} description="dimensão característica ÷ 2" tone={tunnelResult.distanceToCoreM > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Cp acima original" value={`${fmtColdPro(cpAboveAudit.originalValue, 4)} ${cpAboveAudit.originalUnit ?? "—"}`} description={`fonte: ${cpAboveAudit.source ?? "—"}`} tone={Number(cpAboveAudit.originalValue ?? 0) > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Cp acima usado" value={`${fmtColdPro(cpAboveAudit.convertedValue, 4)} ${cpAboveAudit.usedUnit ?? "kcal/kg°C"}`} description="entrada efetiva do motor" tone={Number(cpAboveAudit.convertedValue ?? 0) > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Cp abaixo original" value={`${fmtColdPro(cpBelowAudit.originalValue, 4)} ${cpBelowAudit.originalUnit ?? "—"}`} description={`fonte: ${cpBelowAudit.source ?? "—"}`} tone={Number(cpBelowAudit.originalValue ?? 0) > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Cp abaixo usado" value={`${fmtColdPro(cpBelowAudit.convertedValue, 4)} ${cpBelowAudit.usedUnit ?? "kcal/kg°C"}`} description="unidade usada no cálculo" tone={Number(cpBelowAudit.convertedValue ?? 0) > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Latente original" value={`${fmtColdPro(latentAudit.originalValue, 4)} ${latentAudit.originalUnit ?? "—"}`} description={`fonte: ${latentAudit.source ?? "—"}`} tone={Number(latentAudit.originalValue ?? 0) > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Latente usado" value={`${fmtColdPro(latentAudit.convertedValue, 2)} ${latentAudit.usedUnit ?? "kcal/kg"}`} description="ex.: 134 kJ/kg = 32,01 kcal/kg" tone={Number(latentAudit.convertedValue ?? 0) > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Unidade efetiva" value={String(productEnergyAudit.effectiveCalculationUnit ?? "kcal/kg°C e kcal/kg")} description="cálculo interno normalizado" tone="success" />
        <ColdProCalculatedInfo label="Energia específica total" value={`${fmtColdPro(tunnelResult.energy.totalKcalKg, 2)} kcal/kg`} description={`${fmtColdPro(tunnelResult.energy.totalKJkg, 2)} kJ/kg eq.`} tone={tunnelResult.energy.totalKcalKg > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Sensível acima" value={`${fmtColdPro(tunnelResult.energy.sensibleAboveKcalKg, 2)} kcal/kg`} description="Cp acima × ΔT" tone="info" />
        <ColdProCalculatedInfo label="Latente" value={`${fmtColdPro(tunnelResult.energy.latentKcalKg, 2)} kcal/kg`} description="calor latente × fração" tone="info" />
        <ColdProCalculatedInfo label="Sensível abaixo" value={`${fmtColdPro(tunnelResult.energy.sensibleBelowKcalKg, 2)} kcal/kg`} description="Cp abaixo × ΔT" tone="info" />
        <ColdProCalculatedInfo label="Carga do produto" value={`${fmtColdPro(tunnelResult.productLoadKW, 2)} kW`} description={`${fmtColdPro(tunnelResult.productLoadKW * 859.845, 0)} kcal/h`} tone={tunnelResult.productLoadKW > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Carga embalagem" value={`${fmtColdPro(tunnelResult.packagingLoadKW, 2)} kW`} description="massa embalagem × Cp × ΔT" tone="info" />
        <ColdProCalculatedInfo label="Carga interna" value={`${fmtColdPro(tunnelResult.internalLoadKW, 2)} kW`} description="motores + ventiladores + outras" tone="info" />
        <ColdProCalculatedInfo label="Carga total em kW" value={`${fmtColdPro(tunnelResult.totalKW, 2)} kW`} description="produto + embalagem + interna" tone={tunnelResult.totalKW > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Carga total em kcal/h" value={`${fmtColdPro(tunnelResult.totalKcalH, 0)} kcal/h`} description="carga total convertida" tone="info" />
        <ColdProCalculatedInfo label="Carga total em TR" value={`${fmtColdPro(tunnelResult.totalTR, 2)} TR`} description="carga total convertida" tone="info" />
        <ColdProCalculatedInfo label="Vazão necessária pela carga" value={`${fmtColdPro(tunnelResult.airFlowM3H, 0)} m³/h`} description="calculada após carga térmica do produto" tone={tunnelResult.airFlowM3H > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Vazão de ar informada" value={`${fmtColdPro(tunnelResult.fanAirflowM3H ?? 0, 0)} m³/h`} description="ventiladores" tone="info" />
        <ColdProCalculatedInfo label="Fonte da velocidade" value={tunnelResult.airflowSource === "airflow_by_fans" ? "Vazão / seção livre" : "Manual"} description="origem da velocidade usada" tone="info" />
        <ColdProCalculatedInfo label="Área bruta de passagem" value={`${fmtColdPro(tunnelResult.grossAirAreaM2 ?? 0, 2)} m²`} description="largura × altura" tone="info" />
        <ColdProCalculatedInfo label="Fator de bloqueio" value={`${fmtColdPro((tunnelResult.blockageFactor ?? 0) * 100, 1)}%`} description="produto/esteira/embalagem" tone="info" />
        <ColdProCalculatedInfo label="Área livre estimada" value={`${fmtColdPro(tunnelResult.freeAirAreaM2 ?? 0, 2)} m²`} description="área bruta × livre" tone={(tunnelResult.freeAirAreaM2 ?? 0) > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Velocidade calculada no produto" value={`${fmtColdPro(tunnelResult.calculatedAirVelocityMS ?? 0, 2)} m/s`} description="vazão ÷ área livre" tone="info" />
        <ColdProCalculatedInfo label="Velocidade usada no cálculo" value={`${fmtColdPro(tunnelResult.airVelocityUsedMS ?? 0, 2)} m/s`} description={tunnelResult.airflowSource ?? "manual_velocity"} tone={(tunnelResult.airVelocityUsedMS ?? 0) > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Modelo de exposição" value={EXPOSURE_MODELS[String(tunnelResult.surfaceExposureModel) as keyof typeof EXPOSURE_MODELS] ?? String(tunnelResult.surfaceExposureModel ?? "—")} description="superfície efetivamente exposta" tone="info" />
        <ColdProCalculatedInfo label="Fator de exposição" value={`${fmtColdPro(tunnelResult.exposureFactor ?? 1, 2)}`} description="multiplica h quando h não é manual" tone="info" />
        <ColdProCalculatedInfo label="Temperatura de ar sugerida" value={`${fmtColdPro(tunnelResult.suggestedAirTempC, 1)} °C`} description="temperatura final - approach" tone="info" />
        <ColdProCalculatedInfo label="Temperatura de ar informada" value={`${fmtColdPro(Number(tunnelInput.airTempC ?? 0), 1)} °C`} description="valor real usado no cálculo" tone="info" />
        <ColdProCalculatedInfo label="Diferença do ar" value={fmtMaybe(airBreakdown.comparison, 1, " °C")} description="informada - sugerida" tone={Number(airBreakdown.comparison ?? 0) > 5 ? "warning" : "info"} />
        <ColdProCalculatedInfo label="h base" value={fmtMaybe(tunnelResult.h.hBaseWM2K, 2, " W/m²K")} description="antes dos fatores de exposição" tone={tunnelResult.h.hBaseWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="h efetivo" value={fmtMaybe(tunnelResult.h.hEffectiveWM2K, 2, " W/m²K")} description={`Fonte: ${tunnelResult.h.source}`} tone={tunnelResult.h.hEffectiveWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Fonte do h" value={tunnelResult.h.source} description={modelBreakdown.convectionAssumption} tone="info" />
        <ColdProCalculatedInfo label="k efetivo" value={fmtMaybe(tunnelResult.kEffectiveWMK, 3, " W/mK")} description="condutividade × penetração" tone={tunnelResult.kEffectiveWMK ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Tempo estimado" value={fmtMaybe(tunnelResult.estimatedTimeMin, 1, " min")} description="estimativa até o núcleo" tone={tunnelResult.estimatedTimeMin ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Tempo disponível" value={`${fmtColdPro(tunnelResult.availableTimeMin, 1)} min`} description={isStatic ? "batelada" : "retenção"} tone={tunnelResult.availableTimeMin > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Status" value={statusLabel[tunnelResult.status] ?? tunnelResult.status} description="tempo estimado × disponível" tone={tunnelResult.status === "adequate" ? "success" : "warning"} />
      </div>
      {tunnelResult.warnings.length > 0 ? <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Alertas técnicos:</div><ul className="list-disc space-y-1 pl-5">{tunnelResult.warnings.map((warning: string, index: number) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
      {tunnelResult.missingFields.length > 0 ? <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Dados necessários para cálculo completo:</div><ul className="list-disc space-y-1 pl-5">{tunnelResult.missingFields.map((field: string, index: number) => <li key={`${field}-${index}`}>{field}</li>)}</ul></div> : null}
      {tunnelResult.invalidFields.length > 0 ? <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Dados inválidos:</div><ul className="list-disc space-y-1 pl-5">{tunnelResult.invalidFields.map((field: string, index: number) => <li key={`${field}-${index}`}>{field}</li>)}</ul></div> : null}
    </>
  );

  const thermalSimulationFields = (
    <>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
        <ColdProCalculatedInfo label="Projeto · Carga" value={`${fmtColdPro(initialScenario.totalKW, 2)} kW`} description={`${fmtColdPro(initialScenario.totalKcalH, 0)} kcal/h`} tone="info" />
        <ColdProCalculatedInfo label="Projeto · Tempo" value={fmtMaybe(initialScenario.estimatedTimeMin, 1, " min")} description={`${fmtColdPro(initialScenario.availableTimeMin, 1)} min disponíveis`} tone={initialScenario.status === "adequate" ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Projeto · Vazão" value={`${fmtColdPro(initialScenario.airFlowM3H, 0)} m³/h`} description="estimada pelo motor" tone="info" />
        <ColdProCalculatedInfo label="Projeto · Temp. sugerida" value={`${fmtColdPro(initialScenario.suggestedAirTempC, 1)} °C`} description="final - approach" tone="info" />
        <ColdProCalculatedInfo label="Projeto · Status" value={statusLabel[initialScenario.status] ?? initialScenario.status} description="referência do motor" tone={initialScenario.status === "adequate" ? "success" : "warning"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
        <ColdProField label="Fonte da velocidade" helpKey="airflowSource"><ColdProSelect value={textValue(simulation.airflow_source, "manual_velocity")} onChange={(e) => setSimulationAirflowSource(e.target.value)}><option value="manual_velocity">Velocidade manual</option><option value="airflow_by_fans">Vazão por ventiladores</option></ColdProSelect></ColdProField>
        <ColdProField label="Velocidade do ar" helpKey="simulatedAirVelocity" unit="m/s"><ColdProInput {...simulationAirVelocityControl} /></ColdProField>
        <ColdProField label="Vazão dos ventiladores" helpKey="simulatedAirflow" unit="m³/h"><ColdProInput {...simNum("fan_airflow_m3_h")} /></ColdProField>
        {simulation.airflow_source === "airflow_by_fans" ? <><ColdProField label="Largura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_width_m")} /></ColdProField><ColdProField label="Altura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_height_m")} /></ColdProField><ColdProField label="Fator de bloqueio" helpKey="blockageFactor" unit="%"><ColdProInput {...simBlockagePercentNum("blockage_factor")} /></ColdProField><ColdProCalculatedInfo label="Área livre simulada" value={`${fmtColdPro(simulationResult.freeAirAreaM2 ?? 0, 2)} m²`} description="seção livre calculada" tone={(simulationResult.freeAirAreaM2 ?? 0) > 0 ? "info" : "warning"} /></> : null}
        <ColdProField label="ΔT do ar" helpKey="airDeltaT" unit="K"><ColdProInput {...simNum("air_delta_t_k")} /></ColdProField>
        <ColdProField label="Temperatura do ar" helpKey="simulatedAirTemp" unit="°C"><ColdProInput {...simAirTempNum()} /></ColdProField>
        <ColdProField label="Coef. convecção manual" helpKey="manualConvectiveCoefficient"><ColdProInput {...simNum("convective_coefficient_manual_w_m2_k")} /></ColdProField>
        <ColdProField label="Approach ar sugerido" helpKey="approachAirSuggested" unit="K"><ColdProInput {...simNum("suggested_air_approach_k")} /></ColdProField>
      </div><div>
        <ColdProField label="Tipo de embalagem" helpKey="packagingType"><ColdProInput type="text" value={textValue(simulation.package_type)} onChange={(e) => setSim("package_type", e.target.value)} className="text-left" /></ColdProField>
        <ColdProField label="Fator exposição ao ar" helpKey="airExposureFactor"><ColdProInput {...simNum("air_exposure_factor")} /></ColdProField>
        <ColdProField label="Fator penetração térmica" helpKey="thermalPenetrationFactor"><ColdProInput {...simNum("thermal_penetration_factor")} /></ColdProField>
        <ColdProField label="Limite velocidade mín." helpKey="minVelocityLimit" unit="m/s"><ColdProInput {...num("min_air_velocity_m_s")} /></ColdProField>
        <ColdProField label="Limite velocidade máx." helpKey="maxVelocityLimit" unit="m/s"><ColdProInput {...num("max_air_velocity_m_s")} /></ColdProField>
        <ColdProValidationMessage>{velocityWarning ? "Confira a velocidade do ar. Valores usuais ficam acima de 0 e geralmente abaixo de 10 m/s." : ""}</ColdProValidationMessage>
        <ColdProValidationMessage tone="error">{processError ? (isStatic ? "Tempo de batelada deve ser maior que zero." : "Tempo de retenção deve ser maior que zero.") : ""}</ColdProValidationMessage>
      </div></div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
        <ColdProCalculatedInfo label="Ajustado · Carga" value={`${fmtColdPro(adjustedScenario.totalKW, 2)} kW`} description={`${fmtColdPro(adjustedScenario.totalKcalH, 0)} kcal/h`} tone="info" />
        <ColdProCalculatedInfo label="Ajustado · Tempo" value={fmtMaybe(adjustedScenario.estimatedTimeMin, 1, " min")} description={`${fmtColdPro(adjustedScenario.availableTimeMin, 1)} min disponíveis`} tone={adjustedScenario.status === "adequate" ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Ajustado · Vazão" value={`${fmtColdPro(adjustedScenario.airFlowM3H, 0)} m³/h`} description={adjustedScenario.informedAirFlowM3H ? `informada: ${fmtColdPro(adjustedScenario.informedAirFlowM3H, 0)} m³/h` : "estimada pelo motor"} tone="info" />
        <ColdProCalculatedInfo label="Ajustado · Velocidade" value={`${fmtColdPro(simulationResult.airVelocityUsedMS ?? 0, 2)} m/s`} description={simulationResult.airflowSource === "airflow_by_fans" ? "calculada pela vazão" : "manual"} tone={(simulationResult.airVelocityUsedMS ?? 0) > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Ajustado · h efetivo" value={fmtMaybe(adjustedScenario.hEffectiveWM2K, 2, " W/m²K")} description={adjustedScenario.hSource} tone={adjustedScenario.hEffectiveWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Ajustado · Status" value={statusLabel[adjustedScenario.status] ?? adjustedScenario.status} description="cenário simulado" tone={adjustedScenario.status === "adequate" ? "success" : "warning"} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <ColdProCalculatedInfo label="Diferença tempo" value={fmtMaybe(scenarioDelta.time, 1, " min")} description="ajustado - inicial" tone={scenarioDelta.time !== null && scenarioDelta.time <= 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Diferença vazão" value={`${fmtColdPro(scenarioDelta.airflow, 0)} m³/h`} description={Number(tunnelResult.fanAirflowM3H ?? 0) > 0 ? "simulada - base informada" : "simulada - estimada base"} tone="info" />
        <ColdProCalculatedInfo label="Diferença h" value={fmtMaybe(scenarioDelta.h, 2, " W/m²K")} description="ajustado - inicial" tone="info" />
        <ColdProCalculatedInfo label="Mudança status" value={scenarioDelta.statusChanged ? "Alterou" : "Sem mudança"} description={`${statusLabel[initialScenario.status] ?? initialScenario.status} → ${statusLabel[adjustedScenario.status] ?? adjustedScenario.status}`} tone={adjustedScenario.status === "adequate" ? "success" : "warning"} />
      </div>

      {adjustedScenario.warnings.length > 0 ? <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Alertas do cenário ajustado:</div><ul className="list-disc space-y-1 pl-5">{adjustedScenario.warnings.map((warning: string, index: number) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
      {loadStableTimeChanged ? <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">A carga térmica requerida é determinada principalmente pela massa, energia específica e tempo de processo. Alterações de velocidade do ar afetam principalmente o tempo estimado de congelamento e a viabilidade da troca térmica.</div> : null}
      <div className="mt-5 flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
        <ColdProCalculatedInfo label="Condição térmica" value={form.thermal_condition_approved ? "Aprovada" : "Não aprovada"} description={form.thermal_condition_approved_at ? new Date(textValue(form.thermal_condition_approved_at)).toLocaleString("pt-BR") : "aguardando aprovação"} tone={form.thermal_condition_approved ? "success" : "warning"} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-5 py-2 text-sm font-medium shadow-sm transition hover:bg-muted" onClick={resetSimulation}>Restaurar simulação</button>
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90" onClick={approveThermalCondition}>Aplicar simulação aprovada</button>
        </div>
      </div>
    </>
  );

  const internalLoadFields = (
    <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
      {isStatic ? <ColdProField label="Embalagem da batelada" helpKey="packagingMass" unit="kg/batelada"><ColdProInput {...num("packaging_mass_kg_batch")} /></ColdProField> : <ColdProField label="Embalagem" helpKey="packagingMass" unit="kg/h"><ColdProInput {...num("packaging_mass_kg_hour")} /></ColdProField>}
      <ColdProField label="Cp embalagem" helpKey="packagingCp"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField>
    </div><div>
      <ColdProField label="Motor esteira" helpKey="beltMotorPower" unit="kW"><ColdProInput {...num("belt_motor_kw")} /></ColdProField>
      <ColdProField label="Motor dentro do ambiente"><ColdProSelect value={form.belt_motor_inside_environment === false ? "outside" : "inside"} onChange={(e) => { const inside = e.target.value === "inside"; set("belt_motor_inside_environment", inside); set("belt_motor_dissipation_factor", inside ? 1 : form.belt_motor_dissipation_factor ?? 0); }}><option value="inside">Interno · 100% dissipado</option><option value="outside">Externo · fator manual</option></ColdProSelect></ColdProField>
      {form.belt_motor_inside_environment === false ? <ColdProField label="Fator dissipação motor" unit="0–1"><ColdProInput {...num("belt_motor_dissipation_factor")} /></ColdProField> : null}
      <ColdProField label="Ventiladores internos" helpKey="internalFansPower" unit="kW"><ColdProInput {...num("internal_fans_kw")} /></ColdProField>
      <ColdProField label="Outras cargas" helpKey="otherInternalLoads" unit="kW"><ColdProInput {...num("other_internal_kw")} /></ColdProField>
    </div></div>
  );

  const airflowFields = (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ColdProField label="Modo da Etapa 5">
            <ColdProSelect value={airOperationMode} onChange={(e) => setAirOperationMode(e.target.value)}>
              <option value="validate_current">Validar configuração atual</option>
              <option value="design_to_time">Dimensionar para tempo solicitado</option>
            </ColdProSelect>
          </ColdProField>
          <ColdProField label="Fonte da temperatura do ar">
            <ColdProSelect value={textValue(form.air_temp_source, "environment")} onChange={(e) => setAirTemperatureSource(e.target.value)}>
              <option value="environment">Usar ambiente / psicrométrico</option>
              <option value="manual">Definir túnel manualmente</option>
            </ColdProSelect>
          </ColdProField>
          <ColdProField label="Base de cálculo T/evap">
            <ColdProSelect value={airTempCalcBase} onChange={(e) => setAirTempCalcBase(e.target.value)}>
              <option value="edit_air">Editar T_ar</option>
              <option value="edit_evap">Editar T_evap</option>
            </ColdProSelect>
          </ColdProField>
          <div className="flex items-end">
            <button type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted" onClick={applyAirflowPreset}>
              <Calculator className="h-4 w-4" /> Calcular ar
            </button>
          </div>
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${tunnelResult.status === "adequate" && manualHWM2K > 0 ? "bg-success/10 border-success/20" : "bg-warning/10 border-warning/20"}`}>
        <div className="text-sm font-semibold text-foreground">
          A esteira está configurada para {fmtColdPro(nominalCapacityKgH, 1)} kg/h, equivalente a {fmtColdPro(capacityKgMin, 2)} kg/min.
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Com {fmtColdPro(availableTimeForMassMin, 1)} min de retenção, entram {fmtColdPro(projectedCycleMassKg, 1)} kg no túnel. Nas condições atuais, {fmtColdPro(frozenMassAtRetentionKg, 1)} kg congelam nesse tempo; déficit de {fmtColdPro(cycleDeficitKg, 1)} kg por ciclo ({achievedPercent === null ? "—" : `${fmtColdPro(achievedPercent, 1)}%`} atingido). Para congelar os {fmtColdPro(projectedCycleMassKg, 1)} kg, será necessário {thermalTimeRequiredMin > 0 ? fmtColdPro(thermalTimeRequiredMin, 1) : "—"} min de retenção.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ColdProCalculatedInfo label="Massa projetada por ciclo" value={`${fmtColdPro(projectedCycleMassKg, 1)} kg`} description="kg/min × retenção" tone={projectedCycleMassKg > 0 ? "success" : "warning"} />
          <ColdProCalculatedInfo label="Massa congelada na retenção" value={`${fmtColdPro(frozenMassAtRetentionKg, 1)} kg`} description="quanto congela no tempo disponível" tone={tunnelResult.status === "adequate" ? "success" : "warning"} />
          <ColdProCalculatedInfo label="Retenção necessária" value={thermalTimeRequiredMin > 0 ? `${fmtColdPro(thermalTimeRequiredMin, 1)} min` : "—"} description={retentionAdjustmentMin > 0 ? `aumentar ${fmtColdPro(retentionAdjustmentMin, 1)} min` : "retenção atual suficiente"} tone={retentionAdjustmentMin <= 0 && thermalTimeRequiredMin > 0 ? "success" : "warning"} />
          <ColdProCalculatedInfo label="Status" value={processStatusText} description={manualHWM2K > 0 ? "validação com h manual" : "simulação preliminar sem h manual"} tone={tunnelResult.status === "adequate" && manualHWM2K > 0 ? "success" : "warning"} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2">
        <div>
          {productLoadMissingFields.length > 0 ? <ColdProValidationMessage tone="warning">Carga do produto pendente: falta {productLoadMissingFields.join(", ")}.</ColdProValidationMessage> : null}
          {airOperationMode === "design_to_time" && !designWithinLimits ? <ColdProValidationMessage tone="error">Mesmo nos limites operacionais, o tempo solicitado não fecha.</ColdProValidationMessage> : null}
          <ColdProField label="Vazão dos ventiladores" helpKey="fanAirflow" unit="m³/h"><ColdProInput {...fanAirflowNum()} /></ColdProField>
          {showAirflowMismatch ? <ColdProValidationMessage>A vazão informada está {airflowDeltaM3H > 0 ? "acima" : "abaixo"} da necessária em {fmtColdPro(Math.abs(airflowDeltaM3H), 0)} m³/h ({fmtColdPro(airflowDeltaPercent, 1)}%). Use “Calcular ar” para atualizar o cálculo.</ColdProValidationMessage> : null}
          <ColdProField label="Fonte da velocidade" helpKey="airflowSource"><ColdProSelect value={textValue(form.airflow_source, "manual_velocity")} onChange={(e) => setAirflowSource(e.target.value)}><option value="manual_velocity">Velocidade manual</option><option value="airflow_by_fans">Vazão por ventiladores</option></ColdProSelect></ColdProField>
          <ColdProField label="Velocidade do ar" helpKey="airVelocity" unit="m/s"><ColdProInput {...airVelocityControl} /></ColdProField>
          <ColdProField label="Largura seção de passagem" helpKey="tunnelCrossSectionWidth" unit="m"><ColdProInput {...airControlNum("tunnel_cross_section_width_m")} /></ColdProField>
          <ColdProField label="Altura útil seção de passagem" helpKey="tunnelCrossSectionHeight" unit="m"><ColdProInput {...airControlNum("tunnel_cross_section_height_m")} /></ColdProField>
          <ColdProField label="Fator de bloqueio" helpKey="blockageFactor" unit="%"><ColdProInput {...airControlBlockagePercentNum("blockage_factor")} /></ColdProField>
          <ColdProField label="ΔT evaporador/ar" helpKey="airDeltaT" unit="K"><ColdProInput {...airDeltaNum()} /></ColdProField>
          <ColdProField label="Temperatura do ar" helpKey="airTemp" unit="°C"><ColdProInput {...airTempNum()} /></ColdProField>
          <ColdProField label="Temperatura de evaporação" unit="°C"><ColdProInput {...evapTempNum()} /></ColdProField>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted" onClick={applyTunnelTempToEnvironment}>Aplicar temperatura do túnel ao ambiente</button>
          </div>
          <ColdProField label="Coeficiente convectivo manual" helpKey="manualConvectiveCoefficient" unit="W/m²K"><ColdProInput {...num("convective_coefficient_manual_w_m2_k")} /></ColdProField>
          <button type="button" className="mb-3 inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted" onClick={useSuggestedH}>Usar h sugerido</button>
          {manualHWM2K <= 0 ? <ColdProValidationMessage tone="warning">Para validação final, informe o coeficiente convectivo manual. Sem ele, o h sugerido é apenas simulação preliminar.</ColdProValidationMessage> : null}
          <ColdProField label="Parede sugerida"><ColdProInput readOnly value={displayedAirWall} /></ColdProField>
          <ColdProField label="Sentido de sopro"><ColdProInput readOnly value={displayedAirDirection} /></ColdProField>
        </div>

        <div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <ColdProCalculatedInfo label="1. Capacidade da esteira" value={`${fmtColdPro(nominalCapacityKgH, 1)} kg/h`} description="valor vindo da Etapa 3" tone={nominalCapacityKgH > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="2. Capacidade por minuto" value={`${fmtColdPro(capacityKgMin, 2)} kg/min`} description="kg/h ÷ 60" tone={capacityKgMin > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="3. Tempo de retenção" value={`${fmtColdPro(availableTimeForMassMin, 1)} min`} description={isStatic ? "tempo de batelada" : "tempo disponível"} tone={availableTimeForMassMin > 0 ? "info" : "warning"} />
            <ColdProCalculatedInfo label="4. Massa projetada por ciclo" value={`${fmtColdPro(projectedCycleMassKg, 1)} kg`} description="kg/min × retenção" tone={projectedCycleMassKg > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="5. Massa congelada na retenção" value={`${fmtColdPro(frozenMassAtRetentionKg, 1)} kg`} description="resultado no tempo disponível" tone={tunnelResult.status === "adequate" ? "success" : "warning"} />
            <ColdProCalculatedInfo label="6. Déficit" value={`${fmtColdPro(cycleDeficitKg, 1)} kg`} description="massa projetada - massa congelada" tone={cycleDeficitKg <= 0 && projectedCycleMassKg > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="7. Percentual atingido" value={achievedPercent === null ? "—" : `${fmtColdPro(achievedPercent, 1)}%`} description="massa congelada ÷ massa projetada" tone={achievedPercent !== null && achievedPercent >= 100 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="8. Tempo térmico necessário" value={thermalTimeRequiredMin > 0 ? `${fmtColdPro(thermalTimeRequiredMin, 1)} min` : "—"} description="tempo até o núcleo pelo modelo" tone={thermalTimeRequiredMin > 0 && thermalTimeRequiredMin <= availableTimeForMassMin ? "success" : "warning"} />
            <ColdProCalculatedInfo label="9. Velocidade atual da esteira" value={currentBeltSpeedMMin > 0 ? `${fmtColdPro(currentBeltSpeedMMin, 2)} m/min` : "—"} description="comprimento útil ÷ retenção atual" tone={currentBeltSpeedMMin > 0 ? "info" : "warning"} />
            <ColdProCalculatedInfo label="10. Velocidade ajustada" value={requiredBeltSpeedMMin > 0 ? `${fmtColdPro(requiredBeltSpeedMMin, 2)} m/min` : "—"} description={beltSpeedVariationPercent === null ? "comprimento útil ÷ tempo necessário" : `${fmtColdPro(beltSpeedVariationPercent, 1)}% vs atual`} tone={requiredBeltSpeedMMin > 0 ? "info" : "warning"} />
            <ColdProCalculatedInfo label="11. Nova capacidade" value={adjustedCapacityKgH > 0 ? `${fmtColdPro(adjustedCapacityKgH, 1)} kg/h` : "—"} description="massa projetada × 60 ÷ tempo necessário" tone={adjustedCapacityKgH > 0 && adjustedCapacityKgH >= nominalCapacityKgH ? "success" : "warning"} />
            <ColdProCalculatedInfo label="12. Temperatura do ar" value={`${fmtColdPro(airTemperatureC, 1)} °C`} description={airTempSource === "environment" ? "usando ambiente" : "túnel manual"} tone="info" />
            <ColdProCalculatedInfo label="13. Temperatura evaporação" value={`${fmtColdPro(evaporatorTempC, 1)} °C`} description="T_ar - ΔT" tone="info" />
            <ColdProCalculatedInfo label="14. Vazão necessária" value={fmtAirflow(requiredAirflowM3H)} description="carga kW × 3600 ÷ ρ × Cp × ΔT" tone={requiredAirflowM3H > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="15. Vazão informada" value={fmtAirflow(informedFanAirflowM3H)} description="ventiladores" tone={informedFanAirflowM3H > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="16. Velocidade do ar" value={`${fmtColdPro(tunnelResult.airVelocityUsedMS ?? displayedAirVelocityMS, 2)} m/s`} description="vazão ÷ seção livre" tone={(tunnelResult.airVelocityUsedMS ?? displayedAirVelocityMS) > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="17. h manual" value={manualHWM2K > 0 ? `${fmtColdPro(manualHWM2K, 2)} W/m²K` : "—"} description="obrigatório para validação final" tone={manualHWM2K > 0 ? "success" : "warning"} />
            <ColdProCalculatedInfo label="18. h sugerido" value={`${fmtColdPro(hSuggestedWM2K, 2)} W/m²K`} description="referência; não altera automático" tone={hSuggestedWM2K > 0 ? "info" : "warning"} />
            {airOperationMode === "design_to_time" ? <ColdProCalculatedInfo label="h necessário" value={requiredHForRetentionWM2K > 0 ? `${fmtColdPro(requiredHForRetentionWM2K, 2)} W/m²K` : "—"} description="referência para fechar retenção" tone={designWithinLimits ? "info" : "warning"} /> : null}
            <ColdProCalculatedInfo label="Densidade do ar usada" value={`${fmtColdPro(displayedAirProperties.densityKgM3, 3)} kg/m³`} description={`fonte: ${displayedAirProperties.source}`} tone={displayedAirProperties.source === "fallback" ? "warning" : "info"} />
            <ColdProCalculatedInfo label="Cp do ar usado" value={`${fmtColdPro(displayedAirProperties.specificHeatKJkgK, 4)} kJ/kg.K`} description="propriedade dinâmica do ar" tone="info" />
          </div>

          {showBeltAreaMismatch ? <ColdProValidationMessage tone="warning">Área útil manual diverge de largura × comprimento útil. O cálculo físico principal usa largura × comprimento útil.</ColdProValidationMessage> : null}
          {showBeltFlowMismatch ? <ColdProValidationMessage tone="warning">Inconsistência entre fluxo por velocidade e fluxo por retenção. Verifique velocidade, tempo ou área útil.</ColdProValidationMessage> : null}
          {showBeltMassMismatch ? <ColdProValidationMessage tone="warning">Diferença entre massa calculada por fluxo e massa física na esteira. Verificar velocidade, área útil ou densidade superficial.</ColdProValidationMessage> : null}
          {showInsufficientTimeDiagnostic ? <div className="mb-3 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Com {fmtColdPro(projectedCycleMassKg, 1)} kg projetados por ciclo e {fmtColdPro(availableTimeForMassMin, 1)} min de retenção, quanto congela?</div><p>Nas condições atuais, congelam {fmtColdPro(frozenMassAtRetentionKg, 1)} kg e faltam {fmtColdPro(cycleDeficitKg, 1)} kg por ciclo.</p><p className="mt-1">Para congelar toda a massa projetada, o modelo indica {fmtColdPro(thermalTimeRequiredMin, 1)} min de retenção.</p><p className="mt-1 font-semibold">Isso implica velocidade de esteira de {requiredBeltSpeedMMin > 0 ? fmtColdPro(requiredBeltSpeedMMin, 2) : "—"} m/min e capacidade aproximada de {adjustedCapacityKgH > 0 ? fmtColdPro(adjustedCapacityKgH, 1) : "—"} kg/h.</p></div> : null}
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-3 text-sm font-semibold text-foreground">Recomendação de instalação do equipamento</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ColdProCalculatedInfo label="Parede sugerida" value={displayedAirWall} description={`${fmtColdPro(chamberDimensions.lengthM, 2)} × ${fmtColdPro(chamberDimensions.widthM, 2)} × ${fmtColdPro(chamberDimensions.heightM, 2)} m`} tone="info" />
          <ColdProCalculatedInfo label="Sentido de sopro" value={displayedAirDirection} description="critério: alcance e velocidade" tone="info" />
          <ColdProCalculatedInfo label="Área bruta / seção" value={`${fmtColdPro(tunnelResult.grossAirAreaM2 ?? 0, 2)} m²`} description="largura × altura" tone="info" />
          <ColdProCalculatedInfo label="Status do ar" value={displayedAirStatus.status} description={displayedAirStatus.warning || "faixa recomendada atendida"} tone={displayedAirStatus.tone} />
        </div>
        <div className="mt-3 rounded-md border bg-background/60 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo de validação do ar</div>{airflowValidationIssues.length > 0 ? <ul className="mt-2 space-y-1 text-xs">{airflowValidationIssues.map((issue, index) => <li key={`${issue.text}-${index}`} className={issue.tone === "error" ? "text-destructive" : "text-warning"}>• {issue.text}</li>)}</ul> : <p className="mt-2 text-xs text-success">Vazão, seção útil, velocidade, temperatura e h estão coerentes com as referências aplicadas.</p>}</div>
        <p className="mt-3 text-xs text-muted-foreground">{displayedAirNote}</p>
      </div>
    </div>
  );

  const productGeometryFields = (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
      <ColdProField label="Tipo de arranjo" helpKey="arrangementType">
        <ColdProSelect value={textValue(form.arrangement_type)} onChange={(e) => setArrangementType(e.target.value)}>
          {arrangementOptions.map((key) => <option key={key} value={key}>{ARRANGEMENT_DEFAULTS[key]?.label ?? key}</option>)}
        </ColdProSelect>
      </ColdProField>
      <ColdProField label="Geometria do produto" helpKey="productGeometry"><ColdProSelect value={textValue(form.product_geometry, "slab")} onChange={(e) => set("product_geometry", e.target.value)}>{Object.entries(GEOMETRIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      <ColdProField label="Modelo de exposição" helpKey="surfaceExposureModel"><ColdProSelect value={textValue(form.surface_exposure_model, "fully_exposed")} onChange={(e) => set("surface_exposure_model", e.target.value)}>{Object.entries(EXPOSURE_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      {tunnelType === "static_pallet" && form.arrangement_type === "palletized_boxes" ? <ColdProField label="Modelo térmico do pallet"><ColdProSelect value={textValue(form.thermal_model_for_pallet, "hybrid")} onChange={(e) => set("thermal_model_for_pallet", e.target.value)}>{Object.entries(PALLET_THERMAL_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField> : null}
      <ColdProField label="Escala das medidas do produto" helpKey="measurementScale"><ColdProSelect value={continuousUnit} onChange={(e) => setContinuousUnit(e.target.value as DimensionUnit)}>{Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</ColdProSelect></ColdProField>
      {form.product_geometry === "slab" ? <><ColdProField label="Comprimento produto" helpKey="productLength" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura produto" helpKey="productWidth" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_width_m", continuousUnit)} /></ColdProField><ColdProField label="Espessura produto" helpKey="productThickness" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_thickness_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "rectangular_prism" ? <><ColdProField label="Comprimento produto" helpKey="productLength" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura produto" helpKey="productWidth" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_width_m", continuousUnit)} /></ColdProField><ColdProField label="Altura produto" helpKey="productHeight" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_height_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "cube" ? <ColdProField label="Lado do cubo" helpKey="productSide" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_side_m", continuousUnit)} /></ColdProField> : null}
      {form.product_geometry === "cylinder" ? <><ColdProField label="Diâmetro produto" helpKey="productDiameter" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_diameter_m", continuousUnit)} /></ColdProField><ColdProField label="Comprimento produto" helpKey="productLength" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "sphere" ? <ColdProField label="Diâmetro produto" helpKey="productDiameter" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_diameter_m", continuousUnit)} /></ColdProField> : null}
      {form.product_geometry === "packed_box" ? <><ColdProField label="Comprimento caixa" helpKey="boxLength" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura caixa" helpKey="boxWidth" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_width_m", continuousUnit)} /></ColdProField><ColdProField label="Altura caixa" helpKey="boxHeight" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_height_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "bulk" ? <><ColdProField label="Altura da camada" helpKey="bulkLayerHeight" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("bulk_layer_height_m", continuousUnit)} /></ColdProField><ColdProField label="Diâmetro equivalente partícula" helpKey="equivalentParticleDiameter" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("equivalent_particle_diameter_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "irregular" ? <><ColdProField label="Diâmetro equivalente" helpKey="characteristicDimension" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("equivalent_diameter_m", continuousUnit)} /></ColdProField><ColdProField label="Dimensão característica manual" helpKey="characteristicDimension" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("characteristic_dimension_m", continuousUnit)} /></ColdProField></> : null}
    </div>
  );

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Túnel de congelamento / resfriamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configuração térmica separando produto individual e massa agrupada.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 md:min-w-72">
          <ColdProCalculatedInfo label="Estado do cálculo" value={tunnelResult.status === "missing_data" && tunnelResult.missingFields.length === 0 ? "Aguardando dados" : statusLabel[tunnelResult.status] ?? tunnelResult.status} description={tunnelResult.status === "insufficient" ? "tempo estimado maior que o disponível" : "preencha as etapas em sequência"} tone={tunnelResult.status === "adequate" ? "success" : "warning"} />
        </div>
      </div>

      <div className="space-y-5">
          <ColdProFormSection title="Etapa 1 — Tipo de processo" description="Defina o túnel, o arranjo e o regime antes de informar massa e ar." icon={<Settings className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <ColdProField label="Tipo de túnel" helpKey="tunnelType">
                <ColdProSelect value={tunnelType} onChange={(e) => setTunnelType(e.target.value)}>
                  {Object.entries(TUNNEL_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Tipo de arranjo" helpKey="arrangementType">
                <ColdProSelect value={textValue(form.arrangement_type)} onChange={(e) => setArrangementType(e.target.value)}>
                  {arrangementOptions.map((key) => <option key={key} value={key}>{ARRANGEMENT_DEFAULTS[key]?.label ?? key}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Regime calculado" helpKey="operationRegime"><ColdProInput readOnly value={isStatic ? "Batelada / estático" : "Contínuo"} /></ColdProField>
              <ColdProField label="Modelo físico aplicado" helpKey="physicalModel"><ColdProInput readOnly value={tunnelResult.physicalModelLabel} /></ColdProField>
            </div>
            {staticWarning ? <ColdProValidationMessage tone="warning">Congelamento de caixa, pallet ou bloco depende da embalagem, arranjo, vazão e passagem real de ar. Use como estimativa conservadora.</ColdProValidationMessage> : null}
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 2 — Produto e geometria" description="Separe a dimensão da unidade/caixa da dimensão do pallet, carrinho ou bloco." icon={<Package className="h-4 w-4" />}>
            <div className="space-y-4"><div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4"><div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-4">
              <ColdProField label="Pesquisar produto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <ColdProInput type="search" value={productSearch} onFocus={() => setShowProductSuggestions(true)} onBlur={() => window.setTimeout(() => setShowProductSuggestions(false), 120)} onChange={(e) => { setProductSearch(e.target.value); setShowProductSuggestions(true); }} placeholder="Digite mesmo com erro: ex. pao" className="pl-9 text-left" autoComplete="off" />
                  {showProductSuggestions && productSearch.trim() ? <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                    {productSuggestions.length ? productSuggestions.map((p) => <button key={textValue(p.id)} type="button" className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground" onMouseDown={(event) => { event.preventDefault(); applyProduct(p.id); }}>
                      <span className="font-medium">{textValue(p.name)}</span>
                      {p.category ? <span className="text-xs text-muted-foreground">{textValue(p.category)}</span> : null}
                    </button>) : <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</div>}
                  </div> : null}
                </div>
              </ColdProField>
              <ColdProField label="Grupo ASHRAE"><ColdProSelect value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setProductSearch(""); set("product_id", null); }}><option value="">Seleção manual</option>{groups.map((group) => <option key={textValue(group)} value={textValue(group)}>{textValue(group)}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto ASHRAE"><ColdProSelect value={textValue(form.product_id)} disabled={filteredProducts.length === 0} onChange={(e) => applyProduct(e.target.value)}><option value="">{filteredProducts.length ? "Selecione o produto" : "Nenhum produto encontrado"}</option>{filteredProducts.map((p) => <option key={textValue(p.id)} value={textValue(p.id)}>{textValue(p.name)}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto"><ColdProInput type="text" value={textValue(form.product_name)} onChange={(e) => set("product_name", e.target.value)} className="text-left" /></ColdProField>
              {selectedCatalogProduct ? <div className="md:col-span-2 xl:col-span-4"><ColdProCalculatedInfo label="Dados do catálogo" value="Medidas e propriedades carregadas" description={textValue(selectedCatalogProduct.observations ?? selectedCatalogProduct.source_reference, "Produto técnico oficial")} tone="info" /></div> : null}
            </div></div><div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">{productGeometryFields}</div></div>
            <ColdProValidationMessage tone="error">{requiredError ? "Informe o produto do túnel." : ""}</ColdProValidationMessage>
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 3 — Massa e tempo de processo" description={isStatic ? "Batelada usa massa total do lote e tempo de batelada." : "Contínuo usa kg/h e tempo de retenção."} icon={isStatic ? <Warehouse className="h-4 w-4" /> : <Wind className="h-4 w-4" />}>
            {!isStatic ? <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
              <ColdProField label="Como deseja calcular a massa contínua?"><ColdProSelect value={continuousMassMode} onChange={(e) => setContinuousMassMode(e.target.value)}>{continuousModeOptions(tunnelType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Unidade do peso">
                <ColdProSelect value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
                  {Object.entries(WEIGHT_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              {continuousMassMode !== "calculated_by_belt_surface_density" ? <ColdProField label="Peso unitário" helpKey="unitWeightKg" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField> : null}
              {continuousMassMode === "calculated_by_units_per_hour" ? <ColdProField label="Unidades por hora"><ColdProInput {...num("units_per_hour")} /></ColdProField> : null}
              {continuousMassMode === "calculated_by_belt_loading" ? <><ColdProField label="Unidades por fileira"><ColdProInput {...num("units_per_row")} /></ColdProField><ColdProField label="Fileiras por metro"><ColdProInput {...num("rows_per_meter")} /></ColdProField><ColdProField label="Velocidade esteira" unit="m/min"><ColdProInput {...num("belt_speed_m_min")} /></ColdProField></> : null}
              {continuousMassMode === "calculated_by_belt_surface_density" ? <><ColdProField label="Largura da esteira" unit="m"><ColdProInput {...num("belt_width_m")} /></ColdProField><ColdProField label="Comprimento útil" unit="m"><ColdProInput {...beltLengthNum()} /></ColdProField><ColdProField label="Velocidade da esteira" unit="m/min"><ColdProInput {...beltSpeedNum()} /></ColdProField><ColdProField label="Densidade superficial" unit="kg/m²"><ColdProInput {...num("belt_surface_density_kg_m2")} /></ColdProField><ColdProField label="Área útil manual" unit="m²"><ColdProInput {...num("belt_area_m2")} /></ColdProField><ColdProField label="Capacidade nominal" unit="kg/h"><ColdProInput {...num("belt_nominal_capacity_kg_h")} /></ColdProField></> : null}
              {continuousMassMode === "calculated_by_trays" ? <><ColdProField label="Unidades por bandeja"><ColdProInput {...num("units_per_tray")} /></ColdProField><ColdProField label="Bandejas por hora"><ColdProInput {...num("trays_per_hour")} /></ColdProField><ColdProField label="Peso da bandeja" unit="kg"><ColdProInput {...num("tray_weight_kg")} /></ColdProField></> : null}
              {continuousMassMode === "calculated_by_feed_rate" ? <ColdProField label="Taxa de alimentação" unit="kg/h"><ColdProInput {...num("feed_rate_kg_h")} /></ColdProField> : null}
            </div><div>
              {continuousMassMode === "calculated_by_units" ? <ColdProField label="Unidades/ciclo" helpKey="unitsPerCycle"><ColdProInput {...num("units_per_cycle")} /></ColdProField> : null}
              <ColdProField label="Escala dos ciclos">
                <ColdProSelect value={cycleUnit} onChange={(e) => setCycleUnit(e.target.value as CycleUnit)}>
                  {Object.entries(CYCLE_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              {continuousMassMode === "calculated_by_units" ? <ColdProField label="Ciclos" helpKey="cyclesPerHour" unit={CYCLE_UNITS[cycleUnit].label}><ColdProInput {...cyclesNum(cycleUnit)} /></ColdProField> : null}
              {continuousMassMode === "direct_mass_flow" ? <ColdProField label="Massa direta" helpKey="massKgHour" unit="kg/h"><ColdProInput {...num("mass_kg_hour")} /></ColdProField> : null}
              {tunnelType === "fluidized_bed" ? <><ColdProField label="Diâmetro partícula" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("equivalent_particle_diameter_m", continuousUnit)} /></ColdProField><ColdProField label="Altura da camada" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("bulk_layer_height_m", continuousUnit)} /></ColdProField><ColdProField label="Largura leito" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("bed_width_m", continuousUnit)} /></ColdProField><ColdProField label="Comprimento leito" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("bed_length_m", continuousUnit)} /></ColdProField><ColdProField label="Velocidade superficial" unit="m/s"><ColdProInput {...num("superficial_air_velocity_m_s")} /></ColdProField></> : null}
              <ColdProField label="Escala do tempo">
                <ColdProSelect value={retentionUnit} onChange={(e) => setRetentionUnit(e.target.value as RetentionUnit)}>
                  {Object.entries(RETENTION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Tempo retenção" helpKey="retentionTime" unit={RETENTION_UNITS[retentionUnit].label}><ColdProInput {...(continuousMassMode === "calculated_by_belt_surface_density" ? beltSurfaceRetentionNum(retentionUnit) : retentionNum(retentionUnit))} /></ColdProField>
              {physicalModel === "continuous_spiral" ? <ColdProField label="Fator turbulência girofreezer"><ColdProInput {...num("spiral_turbulence_factor")} /></ColdProField> : null}
              {continuousMassMode === "calculated_by_belt_surface_density" ? <div className="mb-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">Velocidade define o fluxo principal. Tempo valida a retenção. Massa na esteira valida a física do túnel.</div> : null}
              {showBeltAreaMismatch ? <ColdProValidationMessage tone="warning">Área útil manual diverge de largura × comprimento útil. O cálculo físico principal usa largura × comprimento útil.</ColdProValidationMessage> : null}
              {showBeltFlowMismatch ? <ColdProValidationMessage tone="warning">Inconsistência entre fluxo por velocidade e fluxo por retenção. Verifique velocidade, tempo ou área útil.</ColdProValidationMessage> : null}
              <ColdProCalculatedInfo label="Massa usada no motor" value={`${fmtColdPro(massHour)} kg/h`} description={continuousMassMode === "direct_mass_flow" ? "kg/h informado" : continuousMassMode === "calculated_by_belt_surface_density" ? "carga linear × velocidade × 60" : continuousMassMode === "calculated_by_belt_loading" ? "fileiras × esteira × peso" : continuousMassMode === "calculated_by_trays" ? "bandejas/h × massa da bandeja" : "cadência calculada"} tone={massHour > 0 ? "success" : "warning"} />
              {continuousMassMode === "calculated_by_belt_surface_density" ? <ColdProCalculatedInfo label="Massa instantânea no túnel" value={`${fmtColdPro(beltSurfaceMassKg, 1)} kg`} description={`${fmtColdPro(beltSurfaceAreaM2, 2)} m² × ${fmtColdPro(Number(form.belt_surface_density_kg_m2 ?? 0), 2)} kg/m² sobre a esteira`} tone={beltSurfaceMassKg > 0 ? "info" : "warning"} /> : null}
            </div></div> : <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
              <ColdProField label="Como deseja informar a massa da batelada?" helpKey="staticMassMode"><ColdProSelect value={staticMassMode} onChange={(e) => set("static_mass_mode", e.target.value)}>{staticModeOptions(tunnelType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Escala das medidas do bloco/carga" helpKey="measurementScale"><ColdProSelect value={staticUnit} onChange={(e) => setStaticUnit(e.target.value as DimensionUnit)}>{Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Comprimento carrinho/carga" : "Comprimento pallet/bloco"} helpKey="palletLength" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_length_m", staticUnit)} /></ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Largura carrinho/carga" : "Largura pallet/bloco"} helpKey="palletWidth" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_width_m", staticUnit)} /></ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Altura carrinho/carga" : "Altura da carga"} helpKey="palletHeight" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_height_m", staticUnit)} /></ColdProField>
              {staticMassMode === "direct_pallet_mass" || staticMassMode === "direct_cart_mass" ? <ColdProField label={staticMassMode === "direct_cart_mass" ? "Massa por carrinho/rack" : "Massa por pallet/lote"} helpKey="palletMassKg" unit="kg"><ColdProInput {...num("pallet_mass_kg")} /></ColdProField> : null}
              {staticMassMode === "direct_batch_mass" ? <ColdProField label="Massa direta da batelada" unit="kg"><ColdProInput {...num("direct_batch_mass_kg")} /></ColdProField> : null}
              {staticMassMode === "calculated_pallet_composition" ? <><ColdProField label="Peso unitário do pote/produto" helpKey="unitWeightKg" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField><ColdProField label="Unidades por caixa" helpKey="unitsPerBox"><ColdProInput {...num("units_per_box")} /></ColdProField><ColdProField label="Caixas por camada" helpKey="boxesPerLayer"><ColdProInput {...num("boxes_per_layer")} /></ColdProField><ColdProField label="Número de camadas" helpKey="numberOfLayers"><ColdProInput {...num("number_of_layers")} /></ColdProField></> : null}
              {staticMassMode === "calculated_cart_composition" ? <><ColdProField label="Peso unitário" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField><ColdProField label="Unidades por bandeja"><ColdProInput {...num("units_per_tray")} /></ColdProField><ColdProField label="Bandejas por carrinho"><ColdProInput {...num("trays_per_cart")} /></ColdProField><ColdProField label="Peso embalagens/bandejas" unit="kg"><ColdProInput {...num("tray_packaging_weight_kg")} /></ColdProField></> : null}
              {staticMassMode === "calculated_batch_composition" ? <><ColdProField label="Peso unitário" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField><ColdProField label="Unidades por caixa"><ColdProInput {...num("units_per_box")} /></ColdProField><ColdProField label="Caixas na batelada"><ColdProInput {...num("boxes_per_batch")} /></ColdProField><ColdProField label="Peso embalagens/contentores" unit="kg"><ColdProInput {...num("packaging_weight_kg")} /></ColdProField></> : null}
            </div><div>
              {staticMassMode === "calculated_pallet_composition" ? <><ColdProField label="Unidades totais por pallet/lote" helpKey="totalUnitsPerPallet"><ColdProInput {...num("total_units_per_pallet")} /></ColdProField><ColdProField label="Peso de embalagens/caixas por pallet" helpKey="boxPackagingWeight" unit="kg"><ColdProInput {...num("box_packaging_weight_kg")} /></ColdProField><ColdProField label="Peso do pallet/base" helpKey="palletBaseWeight" unit="kg"><ColdProInput {...num("pallet_base_weight_kg")} /></ColdProField></> : null}
              {staticMassMode === "calculated_cart_composition" ? <><ColdProField label="Número de carrinhos"><ColdProInput {...num("number_of_carts")} /></ColdProField><ColdProField label="Peso estrutura carrinho" unit="kg"><ColdProInput {...num("cart_structure_weight_kg")} /></ColdProField></> : null}
              {staticMassMode === "direct_cart_mass" ? <ColdProField label="Número de carrinhos"><ColdProInput {...num("number_of_carts")} /></ColdProField> : null}
              {staticMassMode.includes("pallet") ? <ColdProField label="Número de pallets/lotes" helpKey="numberOfPallets"><ColdProInput {...num("number_of_pallets")} /></ColdProField> : null}
              {tunnelType === "blast_freezer" ? <><ColdProField label="Racks"><ColdProInput {...num("racks_count")} /></ColdProField><ColdProField label="Contentores"><ColdProInput {...num("containers_count")} /></ColdProField></> : null}
              <ColdProField label="Tempo de batelada" helpKey="batchTime" unit="h"><ColdProInput {...num("batch_time_h")} /></ColdProField>
              {physicalModel === "static_block" ? <ColdProField label="Fator exposição bloco" helpKey="blockExposureFactor"><ColdProInput {...num("block_exposure_factor")} /></ColdProField> : null}
              {tunnelType === "static_cart" ? <><ColdProField label="Número de camadas"><ColdProInput {...num("layers_count")} /></ColdProField><ColdProField label="Número de caixas"><ColdProInput {...num("boxes_count")} /></ColdProField><ColdProField label="Espaçamento bandejas" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("tray_spacing_m", staticUnit)} /></ColdProField></> : null}
              {staticMassMode === "calculated_pallet_composition" ? <><ColdProCalculatedInfo label="Unidades por pallet/lote" value={fmtColdPro(unitsPerPallet, 0)} description="caixas × camadas ou total informado" tone={unitsPerPallet > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Massa de produto por pallet" value={`${fmtColdPro(productMassPerPalletKg)} kg`} description="unidades × peso unitário" tone="info" /><ColdProCalculatedInfo label="Massa embalagem/base por pallet" value={`${fmtColdPro(packagingMassPerPalletKg)} kg`} description="embalagens + base" tone="info" /><ColdProCalculatedInfo label="Massa calculada por pallet/lote" value={`${fmtColdPro(calculatedPalletMassKg)} kg`} description={`${fmtColdPro(unitsPerPallet, 0)} unidades × ${fmtColdPro(unitWeight)} kg + ${fmtColdPro(packagingMassPerPalletKg)} kg`} tone={calculatedPalletMassKg > 0 ? "success" : "warning"} /></> : null}
              {staticMassMode === "calculated_cart_composition" ? <><ColdProCalculatedInfo label="Unidades por carrinho" value={fmtColdPro(unitsPerCart, 0)} description="unidades/bandeja × bandejas/carrinho" tone={unitsPerCart > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Massa calculada por carrinho" value={`${fmtColdPro(calculatedCartMassKg)} kg`} description="produto + bandejas + estrutura" tone={calculatedCartMassKg > 0 ? "success" : "warning"} /></> : null}
              {staticMassMode === "calculated_batch_composition" ? <ColdProCalculatedInfo label="Massa calculada da batelada" value={`${fmtColdPro(calculatedBatchMassKg)} kg`} description="peso unitário × unidades do lote + embalagens" tone={calculatedBatchMassKg > 0 ? "success" : "warning"} /> : null}
              <ColdProCalculatedInfo label="Massa total da batelada" value={`${fmtColdPro(staticMass)} kg`} description={`${fmtColdPro(effectiveBatchUnitMassKg)} kg × ${fmtColdPro(groupingCount, 0)} agrupamentos`} tone={staticMass > 0 ? "success" : "warning"} />
            </div></div>}
            {!isStatic && giroResult.errors.length > 0 ? (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Erros de preenchimento:</div>
                <ul className="list-disc space-y-1 pl-5">{giroResult.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
              </div>
            ) : null}
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 4 — Temperaturas e propriedades térmicas" description={catalogLocked ? "Propriedades técnicas carregadas do catálogo e bloqueadas para preservar a base oficial." : "Propriedades usadas na energia específica e na estimativa de tempo até o núcleo."} icon={<Thermometer className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
              <ColdProField label="Temp. entrada" helpKey="initialProductTemp" unit="°C"><ColdProInput {...num("inlet_temp_c")} /></ColdProField><ColdProField label="Temp. final" helpKey="finalProductTemp" unit="°C"><ColdProInput {...num("outlet_temp_c")} /></ColdProField><ColdProField label="Temp. congelamento" helpKey="freezingPoint" unit="°C"><ColdProInput {...lockedNum("freezing_temp_c")} /></ColdProField><ColdProField label="Temperatura do ar" helpKey="airTemp" unit="°C"><ColdProInput {...num("air_temp_c")} /></ColdProField><ColdProField label="Fator penetração térmica" helpKey="thermalPenetrationFactor"><ColdProInput {...num("thermal_penetration_factor")} /></ColdProField>
            </div><div>
              <ColdProField label="Cp acima" helpKey="specificHeatAbove" unit="kcal/kg·°C"><ColdProInput {...lockedNum("specific_heat_above_kcal_kg_c")} value={catalogLocked ? cpAboveKcalKgC : String(form.specific_heat_above_kcal_kg_c ?? "")} /></ColdProField><ColdProField label="Cp abaixo" helpKey="specificHeatBelow" unit="kcal/kg·°C"><ColdProInput {...lockedNum("specific_heat_below_kcal_kg_c")} value={catalogLocked ? cpBelowKcalKgC : String(form.specific_heat_below_kcal_kg_c ?? "")} /></ColdProField><ColdProField label="Calor latente" helpKey="latentHeat" unit="kcal/kg"><ColdProInput {...lockedNum("latent_heat_kcal_kg")} value={catalogLocked ? latentHeatKcalKg : String(form.latent_heat_kcal_kg ?? "")} /></ColdProField><ColdProField label="Fração congelável" helpKey="frozenWaterFraction" unit="0–1"><ColdProInput {...lockedNum("frozen_water_fraction")} /></ColdProField><ColdProField label="Densidade" helpKey="density" unit="kg/m³"><ColdProInput {...lockedNum("density_kg_m3")} /></ColdProField><ColdProField label="Condutividade congelado" helpKey="thermalConductivityFrozen" unit="W/m·K"><ColdProInput {...lockedNum("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
            </div></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <ColdProCalculatedInfo label="Prévia da carga do produto" value={firstThermalLoadReady ? `${fmtColdPro(tunnelResult.productLoadKW * 860.421, 0)} kcal/h` : "Aguardando massa e tempo"} description={`${fmtColdPro(tunnelResult.productLoadKW, 2)} kW`} tone={firstThermalLoadReady ? "success" : "warning"} />
              <ColdProCalculatedInfo label="Carga térmica total prévia" value={firstThermalLoadReady ? `${fmtColdPro(tunnelResult.totalKcalH, 0)} kcal/h` : "—"} description={`${fmtColdPro(tunnelResult.totalKW, 2)} kW · ${fmtColdPro(tunnelResult.totalTR, 2)} TR`} tone={firstThermalLoadReady ? "success" : "warning"} />
              <ColdProCalculatedInfo label="Base do cálculo" value={isStatic ? `${fmtColdPro(staticMass)} kg / ${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h` : `${fmtColdPro(massHour)} kg/h`} description="produto + propriedades térmicas informadas" tone={firstThermalLoadReady ? "info" : "warning"} />
            </div>
            {catalogLocked ? <ColdProValidationMessage>Dados térmicos sincronizados com o cadastro técnico oficial. Salve o túnel para recalcular com a versão mais recente do produto.</ColdProValidationMessage> : null}
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 5 — Ar, vazão e ventilação" description="Valida se a massa no túnel congela no tempo disponível e dimensiona parâmetros operacionais de ar." icon={<Fan className="h-4 w-4" />}>{airflowFields}</ColdProFormSection>
          <ColdProFormSection title="Etapa 6 — Cargas auxiliares" description="Cargas de embalagem, motores, ventiladores internos e outras fontes." icon={<Calculator className="h-4 w-4" />}>{internalLoadFields}</ColdProFormSection>
          <ColdProFormSection title="Etapa 7 — Resultado técnico base" description="Resultado calculado somente após as entradas de engenharia." icon={<Calculator className="h-4 w-4" />}>{tunnelResultCards}</ColdProFormSection>
          <ColdProFormSection title="Etapa 8 — Diagnóstico e consistência" description="Comparativo entre o motor do túnel e a carga consolidada do produto, sem sobrescrever valores." icon={<AlertTriangle className="h-4 w-4" />}>
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4"><ColdProCalculatedInfo label="Carga tunnelEngine" value={`${fmtColdPro(tunnelResult.totalKcalH, 0)} kcal/h`} description={`${fmtColdPro(tunnelResult.totalKW, 2)} kW`} tone="info" /><ColdProCalculatedInfo label="Carga aba Produtos" value={productSourceKcalH > 0 ? `${fmtColdPro(productSourceKcalH, 0)} kcal/h` : "—"} description="fonte consolidada disponível" tone={productSourceKcalH > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Diferença absoluta" value={productSourceKcalH > 0 ? `${fmtColdPro(Math.abs(loadDifferenceKcalH), 0)} kcal/h` : "—"} description="túnel - produto" tone={loadDifferencePercent > 10 ? "warning" : "info"} /><ColdProCalculatedInfo label="Diferença percentual" value={productSourceKcalH > 0 ? `${fmtColdPro(loadDifferencePercent, 1)}%` : "—"} description="base aba Produtos" tone={loadDifferencePercent > 10 ? "warning" : "info"} /></div>
            {loadDifferencePercent > 10 ? <ColdProValidationMessage tone="warning">Há divergência entre a carga calculada no túnel e a carga consolidada da aba Produtos. Verifique se há duplicidade de produto, processo ou conversão de unidade.</ColdProValidationMessage> : null}
          </ColdProFormSection>
          <details className="rounded-xl border bg-background p-3 shadow-sm sm:p-5">
            <summary className="cursor-pointer text-base font-semibold text-foreground">Etapa 9 — Simulador de Condições Operacionais</summary>
            <p className="mt-2 text-sm text-muted-foreground">Use para testar temperatura, velocidade, vazão, exposição e penetração térmica sem alterar o projeto original.</p>
            <div className="mt-5">{thermalSimulationFields}</div>
          </details>
      </div>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={save}>
          <Save className="h-4 w-4" /> Salvar túnel
        </button>
      </div>
    </div>
  );
});
