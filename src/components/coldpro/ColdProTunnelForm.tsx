import * as React from "react";
import { AlertTriangle, Calculator, Fan, Package, Save, Search, Settings, Thermometer, Wind, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";
import { formToTunnelInput } from "@/modules/coldpro/adapters/formToTunnelInput";
import { calculateTunnelEngine } from "@/modules/coldpro/engines/tunnelEngine";
import { calculateContinuousGirofreezer } from "@/modules/coldpro/services/continuousGirofreezerService";
import { filterAndRankColdProProducts } from "@/modules/coldpro/core/productSearch";

const ARRANGEMENT_DEFAULTS: Record<string, { air: number; penetration: number; label: string }> = {
  individual_units: { air: 1, penetration: 1, label: "Produto individual sobre esteira" }, single_layer_blocks: { air: 0.8, penetration: 0.85, label: "Blocos em camada única" }, trays: { air: 0.65, penetration: 0.75, label: "Bandejas" }, stacked_packages: { air: 0.45, penetration: 0.55, label: "Pacotes empilhados" }, packaged_units: { air: 0.55, penetration: 0.65, label: "Produto embalado" }, trays_on_racks: { air: 0.65, penetration: 0.75, label: "Bandejas em racks/carrinhos" }, boxes_on_cart: { air: 0.35, penetration: 0.45, label: "Caixas em carrinho" }, hanging_product: { air: 0.8, penetration: 0.85, label: "Produto suspenso" }, palletized_boxes: { air: 0.35, penetration: 0.45, label: "Caixas paletizadas" }, palletized_blocks: { air: 0.25, penetration: 0.35, label: "Blocos paletizados" }, bulk_on_pallet: { air: 0.2, penetration: 0.3, label: "Produto a granel sobre pallet" }, loose_particles: { air: 0.9, penetration: 0.95, label: "Partículas soltas" }, small_individual_units: { air: 0.9, penetration: 0.95, label: "Unidades pequenas individuais" }, boxes: { air: 0.35, penetration: 0.45, label: "Caixas" }, racks: { air: 0.65, penetration: 0.75, label: "Racks" }, bulk_container: { air: 0.4, penetration: 0.5, label: "Contentores" },
};

const TUNNEL_TYPES = { continuous_belt: "Túnel contínuo de esteira", spiral_girofreezer: "Girofreezer / espiral", static_cart: "Túnel estático com carrinhos", static_pallet: "Túnel estático com pallets", fluidized_bed: "Leito fluidizado / IQF", blast_freezer: "Câmara/túnel de ar forçado" } as const;
const ARRANGEMENTS_BY_TUNNEL: Record<string, string[]> = { continuous_belt: ["individual_units", "single_layer_blocks", "trays", "stacked_packages"], spiral_girofreezer: ["individual_units", "trays", "packaged_units"], static_cart: ["trays_on_racks", "boxes_on_cart", "hanging_product"], static_pallet: ["palletized_boxes", "palletized_blocks", "bulk_on_pallet"], fluidized_bed: ["loose_particles", "small_individual_units"], blast_freezer: ["boxes", "racks", "bulk_container", "palletized_boxes", "trays_on_racks"] };
const STATIC_MASS_MODES = { static_pallet: ["direct_pallet_mass", "calculated_pallet_composition"], static_cart: ["direct_cart_mass", "calculated_cart_composition"], blast_freezer: ["direct_batch_mass", "calculated_batch_composition"] } as const;
const CONTINUOUS_MASS_MODES = { continuous_belt: ["direct_mass_flow", "calculated_by_units_per_hour", "calculated_by_belt_loading"], spiral_girofreezer: ["direct_mass_flow", "calculated_by_units", "calculated_by_trays"], fluidized_bed: ["direct_mass_flow", "calculated_by_feed_rate"] } as const;
const GEOMETRIES = { slab: "Placa / manta / hambúrguer achatado", rectangular_prism: "Bloco retangular", cube: "Cubo", cylinder: "Cilindro", sphere: "Esfera", irregular: "Irregular", packed_box: "Caixa / embalagem fechada", bulk: "Granel" } as const;
const EXPOSURE_MODELS = { fully_exposed: "Produto totalmente exposto ao ar", one_side_contact: "Uma face em contato", tray_contact: "Produto em bandeja", boxed: "Produto dentro de caixa", stacked: "Produto empilhado", bulk_layer: "Camada de produto a granel" } as const;
const PALLET_THERMAL_MODELS = { box_limited: "Limitado pela caixa individual", pallet_block_limited: "Pallet/bloco compacto conservador", hybrid: "Híbrido: caixa + penalização do pallet" } as const;

type DimensionUnit = "m" | "cm" | "mm";
type WeightUnit = "kg" | "g";
type CycleUnit = "h" | "min";
type RetentionUnit = "min" | "h";

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

function positiveValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
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
  if (tunnelType === "fluidized_bed") return 0.12;
  if (arrangement.includes("pallet") || arrangement.includes("block") || arrangement.includes("boxes")) return 0.3;
  if (arrangement.includes("tray") || arrangement.includes("rack")) return 0.22;
  return 0.18;
}

function kcalFromThermal(kcal?: unknown, kj?: unknown) {
  return positiveValue(kcal) || positiveValue(kj) / 4.1868;
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
  return [{ value: "direct_mass_flow", label: "Informar kg/h diretamente" }, { value: "calculated_by_units_per_hour", label: "Calcular por unidades/h" }, { value: "calculated_by_belt_loading", label: "Calcular por carregamento da esteira" }];
}

function simulationDraftFromTunnel(source: any) {
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

export function ColdProTunnelForm({ environmentId, environment, product, tunnel, productCatalog = [], onSave }: { environmentId: string; environment?: any; product?: any | null; tunnel?: any; productCatalog?: any[]; onSave: (data: any) => void }) {
  const [form, setForm] = React.useState<any>(defaultTunnel(environmentId));
  const [selectedGroup, setSelectedGroup] = React.useState("");
  const [productSearch, setProductSearch] = React.useState("");
  const [showProductSuggestions, setShowProductSuggestions] = React.useState(false);
  const [continuousUnit, setContinuousUnit] = React.useState<DimensionUnit>("m");
  const [staticUnit, setStaticUnit] = React.useState<DimensionUnit>("m");
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>("kg");
  const [cycleUnit, setCycleUnit] = React.useState<CycleUnit>("h");
  const [retentionUnit, setRetentionUnit] = React.useState<RetentionUnit>("min");
  const [activeTab, setActiveTab] = React.useState("modelo");
  const [simulation, setSimulation] = React.useState<any>(() => simulationDraftFromTunnel(defaultTunnel(environmentId)));
  const autoAirPresetKeyRef = React.useRef("");

  React.useEffect(() => {
    const next = { ...defaultTunnel(environmentId), ...(tunnel ?? {}), environment_id: environmentId };
    setForm(next);
    setSimulation(simulationDraftFromTunnel(next));
  }, [environmentId, tunnel?.id]);

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const num = (key: string) => ({ type: "number" as const, step: "0.0001", value: form?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });
  const setSim = (key: string, value: unknown) => setSimulation((prev: any) => ({ ...prev, [key]: value }));
  const simNum = (key: string) => ({ type: "number" as const, step: "0.0001", value: simulation?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSim(key, numberOrNull(e.target.value)) });
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
  const continuousMassMode = tunnelType === "fluidized_bed" ? String(form.mass_flow_mode ?? "direct_mass_flow") : String(form.continuous_mass_mode ?? "direct_mass_flow");
  const throughputByUnits = unitWeight * positiveValue(form.units_per_cycle) * positiveValue(form.cycles_per_hour);
  const throughputByTrays = (unitWeight * positiveValue(form.units_per_tray) + positiveValue(form.tray_weight_kg)) * positiveValue(form.trays_per_hour);
  const throughputByUnitsHour = unitWeight * positiveValue(form.units_per_hour);
  const beltUnitsPerHour = positiveValue(form.units_per_row) * positiveValue(form.rows_per_meter) * positiveValue(form.belt_speed_m_min) * 60;
  const throughputByBelt = beltUnitsPerHour * unitWeight;
  const throughputByFeedRate = positiveValue(form.feed_rate_kg_h);
  const calculatedMassHour = continuousMassMode === "calculated_by_trays" ? throughputByTrays : continuousMassMode === "calculated_by_units_per_hour" ? throughputByUnitsHour : continuousMassMode === "calculated_by_belt_loading" ? throughputByBelt : continuousMassMode === "calculated_by_feed_rate" ? throughputByFeedRate : throughputByUnits;
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
  const airTemperatureC = airTempSource === "environment"
    ? Number(environment?.internal_temp_c ?? form.air_temp_c ?? 0)
    : Number(form.air_temp_c ?? environment?.internal_temp_c ?? 0);
  const freezingPointC = Number(form.freezing_temp_c ?? thermodynamicProduct?.initial_freezing_temp_c ?? -1.5);
  const cpAboveKcalKgC = kcalFromThermal(form.specific_heat_above_kcal_kg_c, form.specific_heat_above_kj_kg_k) || kcalFromThermal(thermodynamicProduct?.specific_heat_above_kcal_kg_c, thermodynamicProduct?.specific_heat_above_kj_kg_k);
  const cpBelowKcalKgC = kcalFromThermal(form.specific_heat_below_kcal_kg_c, form.specific_heat_below_kj_kg_k) || kcalFromThermal(thermodynamicProduct?.specific_heat_below_kcal_kg_c, thermodynamicProduct?.specific_heat_below_kj_kg_k);
  const latentHeatKcalKg = kcalFromThermal(form.latent_heat_kcal_kg, form.latent_heat_kj_kg) || kcalFromThermal(thermodynamicProduct?.latent_heat_kcal_kg, thermodynamicProduct?.latent_heat_kj_kg);
  const frozenConductivityWmK = positiveValue(form.thermal_conductivity_frozen_w_m_k, thermodynamicProduct?.thermal_conductivity_frozen_w_m_k, thermodynamicProduct?.thermal_conductivity_w_m_k);
  const frozenWaterFraction = positiveValue(form.frozen_water_fraction, thermodynamicProduct?.frozen_water_fraction, Number(thermodynamicProduct?.freezable_water_content_percent ?? 0) / 100, Number(thermodynamicProduct?.water_content_percent ?? 0) / 100, 0.9);
  const tunnelInput = formToTunnelInput(form, environment ?? {});
  const baseResult = calculateTunnelEngine(tunnelInput);
  const simulationForm = { ...form, ...simulation, initial_scenario_input: tunnelInput.initialScenarioInput, thermal_condition_approved: false };
  const simulationInput = formToTunnelInput(simulationForm, environment ?? {});
  const simulationResult = calculateTunnelEngine(simulationInput);
  const tunnelResult = baseResult;
  const initialScenario = baseResult.adjustedScenario;
  const adjustedScenario = simulationResult.adjustedScenario;
  const baseFanAirflowM3H = Number(tunnelResult.fanAirflowM3H ?? tunnelResult.informedAirFlowM3H ?? 0) || tunnelResult.airFlowM3H;
  const simulatedFanAirflowM3H = Number(simulationResult.fanAirflowM3H ?? simulationResult.informedAirFlowM3H ?? 0) || simulationResult.airFlowM3H;
  const deltaFanAirflowM3H = simulatedFanAirflowM3H - baseFanAirflowM3H;
  const productSourceKcalH = positiveValue(product?.total_load_kcal_h, product?.product_load_kcal_h, product?.total_kcal_h, product?.load_kcal_h);
  const loadDifferenceKcalH = productSourceKcalH > 0 ? tunnelResult.totalKcalH - productSourceKcalH : 0;
  const loadDifferencePercent = productSourceKcalH > 0 ? Math.abs(loadDifferenceKcalH) / productSourceKcalH * 100 : 0;
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
    airDensityKgM3: 1.2,
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

  const buildAirflowPreset = React.useCallback((source: any = form) => {
    const presetVelocity = recommendedTunnelAirVelocity(tunnelType, isStatic);
    const requiredAirflow = positiveValue(tunnelResult.airFlowM3H, thermalResult.requiredAirflowM3H, source?.informed_air_flow_m3_h, source?.airflow_m3_h);
    const fanAirflowM3H = requiredAirflow;
    const blockageFactor = positiveValue(source?.blockage_factor) || recommendedBlockageFactor(tunnelType, source?.arrangement_type ?? form.arrangement_type);
    const freeAreaM2 = fanAirflowM3H > 0 ? fanAirflowM3H / 3600 / presetVelocity : 0;
    const grossAreaM2 = freeAreaM2 > 0 ? freeAreaM2 / Math.max(0.05, 1 - blockageFactor) : 0;
    const currentWidth = positiveValue(source?.tunnel_cross_section_width_m);
    const currentHeight = positiveValue(source?.tunnel_cross_section_height_m);
    const ratioWidthM = grossAreaM2 > 0 ? Math.sqrt(grossAreaM2 * 1.6) : 0;
    const ratioHeightM = grossAreaM2 > 0 ? grossAreaM2 / Math.max(ratioWidthM, 0.01) : 0;
    const sectionWidthM = currentWidth || ratioWidthM;
    const sectionHeightM = currentHeight || ratioHeightM;
    return {
      airflow_source: "airflow_by_fans",
      fan_airflow_m3_h: roundPreset(fanAirflowM3H, 2),
      informed_air_flow_m3_h: roundPreset(fanAirflowM3H, 2),
      airflow_m3_h: roundPreset(fanAirflowM3H, 2),
      tunnel_cross_section_width_m: roundPreset(sectionWidthM, 3),
      tunnel_cross_section_height_m: roundPreset(sectionHeightM, 3),
      blockage_factor: roundPreset(clamp(blockageFactor, 0, 0.9), 4),
      blockage_factor_input_mode: "decimal",
      air_delta_t_k: positiveValue(source?.air_delta_t_k) || 6,
      air_temp_c: Number.isFinite(Number(source?.air_temp_c)) ? source?.air_temp_c : airTemperatureC,
      air_velocity_m_s: roundPreset(presetVelocity, 2),
    };
  }, [airTemperatureC, form, isStatic, thermalResult.requiredAirflowM3H, tunnelResult.airFlowM3H, tunnelType]);

  const applyAirflowPreset = React.useCallback(() => {
    setForm((prev: any) => ({ ...prev, ...buildAirflowPreset(prev) }));
  }, [buildAirflowPreset]);

  const requiredAirflowM3H = tunnelResult.airFlowM3H;
  const informedFanAirflowM3H = positiveValue(form.fan_airflow_m3_h);
  const airflowDeltaM3H = informedFanAirflowM3H - requiredAirflowM3H;
  const airflowDeltaPercent = requiredAirflowM3H > 0 ? Math.abs(airflowDeltaM3H) / requiredAirflowM3H * 100 : 0;
  const showAirflowMismatch = form.airflow_source === "airflow_by_fans" && requiredAirflowM3H > 0 && informedFanAirflowM3H > 0 && airflowDeltaPercent > 5;
  const loadBreakdown = tunnelResult.calculationBreakdown.loads ?? {};
  const modelBreakdown = tunnelResult.calculationBreakdown.model ?? {};
  const airBreakdown = tunnelResult.calculationBreakdown.air ?? {};
  const productLoadMissingFields = Array.isArray(loadBreakdown.productLoadMissingFields) ? loadBreakdown.productLoadMissingFields : [];
  const productLoadMassDescription = isStatic
    ? `${fmtColdPro(loadBreakdown.massUsedForProductLoad ?? tunnelResult.staticMassKg)} kg ÷ ${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h × energia específica`
    : `${fmtColdPro(loadBreakdown.massUsedForProductLoad ?? tunnelResult.usedMassKgH)} kg/h × energia específica`;

  React.useEffect(() => {
    const presetKey = `${environmentId}:${tunnel?.id ?? "new"}`;
    const hasAirInputs = positiveValue(form.fan_airflow_m3_h, form.tunnel_cross_section_width_m, form.tunnel_cross_section_height_m, form.informed_air_flow_m3_h) > 0;
    if (autoAirPresetKeyRef.current === presetKey || hasAirInputs || tunnelResult.airFlowM3H <= 0) return;
    autoAirPresetKeyRef.current = presetKey;
    setForm((prev: any) => ({ ...prev, ...buildAirflowPreset(prev) }));
  }, [buildAirflowPreset, environmentId, form.fan_airflow_m3_h, form.informed_air_flow_m3_h, form.tunnel_cross_section_height_m, form.tunnel_cross_section_width_m, tunnel?.id, tunnelResult.airFlowM3H]);

  const setProcessType = (value: string) => {
    const tunnel = legacyTunnelType(value);
    const arrangement = defaultArrangement(tunnel);
    const defaults = ARRANGEMENT_DEFAULTS[arrangement];
    const nextIsStatic = isStaticProcess(tunnel);
    setForm((prev: any) => ({ ...prev, process_type: value, tunnel_type: tunnel, physical_model: physicalModelFromProcess(tunnel), operation_mode: nextIsStatic ? "batch" : "continuous", tunnel_mode: nextIsStatic ? "static" : "continuous", arrangement_type: arrangement, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
    setActiveTab(nextIsStatic ? "estatico" : "continuo");
  };

  const setTunnelType = (value: string) => {
    const arrangement = defaultArrangement(value);
    const defaults = ARRANGEMENT_DEFAULTS[arrangement];
    const nextIsStatic = isStaticProcess(value);
    setForm((prev: any) => ({ ...prev, tunnel_type: value, process_type: value, physical_model: physicalModelFromProcess(value), operation_mode: nextIsStatic ? "batch" : "continuous", tunnel_mode: nextIsStatic ? "static" : "continuous", arrangement_type: arrangement, static_mass_mode: nextIsStatic ? defaultMassModeForTunnel(value) : prev.static_mass_mode, continuous_mass_mode: !nextIsStatic ? "direct_mass_flow" : prev.continuous_mass_mode, mass_flow_mode: value === "fluidized_bed" ? "direct_mass_flow" : prev.mass_flow_mode, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration, ...suggestedStaticArrangementFields(value, arrangement) }));
    setActiveTab(nextIsStatic ? "estatico" : "continuo");
  };

  const setArrangementType = (value: string) => {
    const defaults = ARRANGEMENT_DEFAULTS[value] ?? ARRANGEMENT_DEFAULTS.individual_units;
    setForm((prev: any) => ({ ...prev, arrangement_type: value, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration, ...suggestedStaticArrangementFields(String(prev.tunnel_type ?? tunnelType), value) }));
  };

  const resetSimulation = () => setSimulation(simulationDraftFromTunnel(form));

  const approveThermalCondition = () => {
    if (adjustedScenario.status !== "adequate") {
      window.alert("Condição térmica ainda não atende o tempo de processo. Ajuste temperatura, velocidade ou tempo de batelada/retenção.");
      return;
    }
    setForm((prev: any) => ({
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
    const catalogGeometry = geometryFromCatalogShape(p.geometry_shape);
    const lengthM = Number(p.length_mm ?? 0) > 0 ? Number(p.length_mm) / 1000 : null;
    const widthM = Number(p.width_mm ?? 0) > 0 ? Number(p.width_mm) / 1000 : null;
    const heightM = Number(p.height_or_thickness_mm ?? 0) > 0 ? Number(p.height_or_thickness_mm) / 1000 : null;
    const characteristicM = Number(p.characteristic_thickness_m ?? 0) > 0 ? Number(p.characteristic_thickness_m) : Number(p.characteristic_thickness_mm ?? 0) > 0 ? Number(p.characteristic_thickness_mm) / 1000 : null;
    setForm((prev: any) => ({
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
      specific_heat_above_kcal_kg_c: Number(p.specific_heat_above_kcal_kg_c ?? prev.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: Number(p.specific_heat_below_kcal_kg_c ?? prev.specific_heat_below_kcal_kg_c),
      latent_heat_kj_kg: p.latent_heat_kj_kg ?? null,
      latent_heat_kcal_kg: Number(p.latent_heat_kcal_kg ?? prev.latent_heat_kcal_kg),
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
    setSelectedGroup(p.category ?? "");
    setProductSearch(p.name ?? "");
    setShowProductSuggestions(false);
  };

  const save = () => onSave({
    ...form,
    ...(selectedCatalogProduct ? {
      product_name: selectedCatalogProduct.name,
      freezing_temp_c: selectedCatalogProduct.initial_freezing_temp_c ?? form.freezing_temp_c,
      density_kg_m3: selectedCatalogProduct.density_kg_m3 ?? form.density_kg_m3,
      ashrae_density_kg_m3: selectedCatalogProduct.density_kg_m3 ?? form.ashrae_density_kg_m3,
      specific_heat_above_kj_kg_k: selectedCatalogProduct.specific_heat_above_kj_kg_k ?? null,
      specific_heat_below_kj_kg_k: selectedCatalogProduct.specific_heat_below_kj_kg_k ?? null,
      specific_heat_above_kcal_kg_c: Number(selectedCatalogProduct.specific_heat_above_kcal_kg_c ?? form.specific_heat_above_kcal_kg_c),
      specific_heat_below_kcal_kg_c: Number(selectedCatalogProduct.specific_heat_below_kcal_kg_c ?? form.specific_heat_below_kcal_kg_c),
      latent_heat_kj_kg: selectedCatalogProduct.latent_heat_kj_kg ?? null,
      latent_heat_kcal_kg: Number(selectedCatalogProduct.latent_heat_kcal_kg ?? form.latent_heat_kcal_kg),
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
    feed_rate_kg_h: Number(form.feed_rate_kg_h ?? 0) || null,
    units_per_pallet: (tunnelResult.unitsPerPallet ?? unitsPerPallet) || null,
    product_mass_per_pallet_kg: (tunnelResult.productMassPerPalletKg ?? productMassPerPalletKg) || null,
    packaging_mass_per_pallet_kg: (tunnelResult.packagingMassPerPalletKg ?? packagingMassPerPalletKg) || null,
    calculated_pallet_mass_kg: (tunnelResult.calculatedPalletMassKg ?? calculatedPalletMassKg) || null,
    pallet_mass_kg: staticMassMode === "calculated_pallet_composition" ? (tunnelResult.calculatedPalletMassKg ?? calculatedPalletMassKg) : Number(form.pallet_mass_kg ?? 0),
    staticMassKg: tunnelResult.staticMassKg ?? null,
    static_mass_kg: tunnelResult.staticMassKg ?? null,
    product_name: String(form.product_name ?? "").trim(),
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
  });

  const statusLabel: Record<string, string> = {
    adequate: "Adequado",
    insufficient: "Insuficiente",
    missing_data: "Faltam dados",
    invalid_input: "Dados inválidos",
  };
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
        {!isStatic ? <ColdProCalculatedInfo label="Espessura do produto" value={`${fmtColdPro(productThicknessM, 3)} m`} description="dimensão informada" tone={productThicknessM > 0 ? "info" : "warning"} /> : null}
        {isStatic ? <ColdProCalculatedInfo label="Dimensões pallet/bloco" value={`${fmtColdPro(Number(form.pallet_length_m ?? 0), 2)} × ${fmtColdPro(Number(form.pallet_width_m ?? 0), 2)} × ${fmtColdPro(Number(form.pallet_height_m ?? 0), 2)} m`} description="C × L × A" tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} /> : null}
        <ColdProCalculatedInfo label={isStatic ? "Tempo de batelada" : "Tempo de retenção"} value={`${fmtColdPro(tunnelResult.availableTimeMin, 1)} min`} description={isStatic ? `${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h` : "tempo disponível"} tone={tunnelResult.availableTimeMin > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label={isStatic ? "Menor dimensão da carga" : "Dimensão característica"} value={`${fmtColdPro(tunnelResult.characteristicDimensionM, 3)} m`} description={isStatic ? "menor dimensão do pallet/carga" : "espessura do produto"} tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Distância até o núcleo" value={`${fmtColdPro(tunnelResult.distanceToCoreM * 1000, 1)} mm`} description="dimensão característica ÷ 2" tone={tunnelResult.distanceToCoreM > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Energia específica total" value={`${fmtColdPro(tunnelResult.energy.totalKJkg, 2)} kJ/kg`} description="sensível + latente" tone={tunnelResult.energy.totalKJkg > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Sensível acima" value={`${fmtColdPro(tunnelResult.energy.sensibleAboveKJkg, 2)} kJ/kg`} description="Cp acima × ΔT" tone="info" />
        <ColdProCalculatedInfo label="Latente" value={`${fmtColdPro(tunnelResult.energy.latentKJkg, 2)} kJ/kg`} description="calor latente × fração" tone="info" />
        <ColdProCalculatedInfo label="Sensível abaixo" value={`${fmtColdPro(tunnelResult.energy.sensibleBelowKJkg, 2)} kJ/kg`} description="Cp abaixo × ΔT" tone="info" />
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
        <ColdProField label="Temp. ar simulada" helpKey="simulatedAirTemp" unit="°C"><ColdProInput {...simNum("air_temp_c")} /></ColdProField>
        <ColdProField label="Fonte da velocidade" helpKey="airflowSource"><ColdProSelect value={simulation.airflow_source ?? "manual_velocity"} onChange={(e) => setSim("airflow_source", e.target.value)}><option value="manual_velocity">Velocidade manual</option><option value="airflow_by_fans">Vazão por ventiladores</option></ColdProSelect></ColdProField>
        {simulation.airflow_source !== "airflow_by_fans" ? <ColdProField label="Velocidade simulada" helpKey="simulatedAirVelocity" unit="m/s"><ColdProInput {...simNum("air_velocity_m_s")} /></ColdProField> : null}
        {simulation.airflow_source === "airflow_by_fans" ? <><ColdProField label="Vazão dos ventiladores" helpKey="simulatedAirflow" unit="m³/h"><ColdProInput {...simNum("fan_airflow_m3_h")} /></ColdProField><ColdProField label="Largura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_width_m")} /></ColdProField><ColdProField label="Altura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_height_m")} /></ColdProField><ColdProField label="Fator de bloqueio" helpKey="blockageFactor" unit="%"><ColdProInput {...simBlockagePercentNum("blockage_factor")} /></ColdProField><ColdProCalculatedInfo label="Área livre simulada" value={`${fmtColdPro(simulationResult.freeAirAreaM2 ?? 0, 2)} m²`} description="seção livre calculada" tone={(simulationResult.freeAirAreaM2 ?? 0) > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Velocidade simulada" value={`${fmtColdPro(simulationResult.calculatedAirVelocityMS ?? 0, 2)} m/s`} description="vazão ÷ área livre" tone="info" /></> : null}
        <ColdProField label="ΔT do ar" helpKey="airDeltaT" unit="K"><ColdProInput {...simNum("air_delta_t_k")} /></ColdProField>
        <ColdProField label="Approach ar sugerido" helpKey="approachAirSuggested" unit="K"><ColdProInput {...simNum("suggested_air_approach_k")} /></ColdProField>
        <ColdProField label="Vazão informada" helpKey="informedAirflow" unit="m³/h"><ColdProInput {...simNum("informed_air_flow_m3_h")} /></ColdProField>
        <ColdProField label="Coef. convecção manual" helpKey="manualConvectiveCoefficient"><ColdProInput {...simNum("convective_coefficient_manual_w_m2_k")} /></ColdProField>
      </div><div>
        <ColdProField label="Tipo de embalagem" helpKey="packagingType"><ColdProInput type="text" value={simulation.package_type ?? ""} onChange={(e) => setSim("package_type", e.target.value)} className="text-left" /></ColdProField>
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
        <ColdProCalculatedInfo label="Condição térmica" value={form.thermal_condition_approved ? "Aprovada" : "Não aprovada"} description={form.thermal_condition_approved_at ? new Date(form.thermal_condition_approved_at).toLocaleString("pt-BR") : "aguardando aprovação"} tone={form.thermal_condition_approved ? "success" : "warning"} />
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
      <ColdProField label="Ventiladores internos" helpKey="internalFansPower" unit="kW"><ColdProInput {...num("internal_fans_kw")} /></ColdProField>
      <ColdProField label="Outras cargas" helpKey="otherInternalLoads" unit="kW"><ColdProInput {...num("other_internal_kw")} /></ColdProField>
    </div></div>
  );

  const airflowFields = (
    <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
      <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">Pré-set técnico pela carga, ΔT, temperatura do ambiente e velocidade típica do túnel.</div>
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-muted" onClick={applyAirflowPreset}><Calculator className="h-4 w-4" /> Calcular ar</button>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <ColdProCalculatedInfo label="1. Carga térmica do produto" value={`${fmtColdPro(tunnelResult.productLoadKW, 2)} kW`} description={productLoadMassDescription} tone={tunnelResult.productLoadKW > 0 ? "success" : "warning"} />
        <ColdProCalculatedInfo label="2. Carga usada na vazão" value={`${fmtColdPro(tunnelResult.totalKW, 2)} kW`} description="produto + embalagem + interna" tone={tunnelResult.totalKW > 0 ? "success" : "warning"} />
      </div>
      {productLoadMissingFields.length > 0 ? <ColdProValidationMessage tone="warning">Carga do produto pendente: falta {productLoadMissingFields.join(", ")}.</ColdProValidationMessage> : null}
      <ColdProField label="Fonte da velocidade" helpKey="airflowSource"><ColdProSelect value={form.airflow_source ?? "manual_velocity"} onChange={(e) => { if (e.target.value === "airflow_by_fans") setForm((prev: any) => ({ ...prev, ...buildAirflowPreset(prev) })); else set("airflow_source", e.target.value); }}><option value="manual_velocity">Velocidade manual</option><option value="airflow_by_fans">Vazão por ventiladores</option></ColdProSelect></ColdProField>
      {form.airflow_source !== "airflow_by_fans" ? <ColdProField label="Velocidade do ar" helpKey="airVelocity" unit="m/s"><ColdProInput {...num("air_velocity_m_s")} /></ColdProField> : null}
      {form.airflow_source === "airflow_by_fans" ? <><ColdProField label="Vazão dos ventiladores informada" helpKey="fanAirflow" unit="m³/h"><ColdProInput {...num("fan_airflow_m3_h")} /></ColdProField>{showAirflowMismatch ? <ColdProValidationMessage>A vazão informada está {airflowDeltaM3H > 0 ? "acima" : "abaixo"} da necessária em {fmtColdPro(Math.abs(airflowDeltaM3H), 0)} m³/h ({fmtColdPro(airflowDeltaPercent, 1)}%). Use “Calcular ar” para igualar ao cálculo atual.</ColdProValidationMessage> : null}<ColdProField label="Largura seção de passagem" helpKey="tunnelCrossSectionWidth" unit="m"><ColdProInput {...num("tunnel_cross_section_width_m")} /></ColdProField><ColdProField label="Altura seção de passagem" helpKey="tunnelCrossSectionHeight" unit="m"><ColdProInput {...num("tunnel_cross_section_height_m")} /></ColdProField><ColdProField label="Fator de bloqueio" helpKey="blockageFactor" unit="%"><ColdProInput {...blockagePercentNum("blockage_factor")} /></ColdProField></> : null}
    </div><div>
      <ColdProField label="ΔT do ar" helpKey="airDeltaT" unit="K"><ColdProInput {...num("air_delta_t_k")} /></ColdProField>
      <ColdProField label="Temperatura do ar" helpKey="airTemp" unit="°C"><ColdProInput {...num("air_temp_c")} /></ColdProField>
      <ColdProField label="Coeficiente convectivo manual" helpKey="manualConvectiveCoefficient" unit="W/m²K"><ColdProInput {...num("convective_coefficient_manual_w_m2_k")} /></ColdProField>
      <ColdProCalculatedInfo label="3. Vazão necessária calculada" value={`${fmtColdPro(requiredAirflowM3H, 0)} m³/h`} description="carga total ÷ densidade × Cp × ΔT" tone={requiredAirflowM3H > 0 ? "success" : "warning"} />
      <ColdProCalculatedInfo label="Área bruta calculada" value={`${fmtColdPro(tunnelResult.grossAirAreaM2 ?? 0, 2)} m²`} description="largura × altura" tone="info" />
      <ColdProCalculatedInfo label="Área livre calculada" value={`${fmtColdPro(tunnelResult.freeAirAreaM2 ?? 0, 2)} m²`} description="área bruta × (1 - bloqueio)" tone={(tunnelResult.freeAirAreaM2 ?? 0) > 0 ? "info" : "warning"} />
      <ColdProCalculatedInfo label="Velocidade calculada" value={`${fmtColdPro(tunnelResult.calculatedAirVelocityMS ?? 0, 2)} m/s`} description="vazão dos ventiladores ÷ seção livre" tone="info" />
    </div></div>
  );

  const productGeometryFields = (
    <div className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">
      <ColdProField label="Tipo de arranjo" helpKey="arrangementType">
        <ColdProSelect value={form.arrangement_type} onChange={(e) => setArrangementType(e.target.value)}>
          {arrangementOptions.map((key) => <option key={key} value={key}>{ARRANGEMENT_DEFAULTS[key]?.label ?? key}</option>)}
        </ColdProSelect>
      </ColdProField>
      <ColdProField label="Geometria do produto" helpKey="productGeometry"><ColdProSelect value={form.product_geometry ?? "slab"} onChange={(e) => set("product_geometry", e.target.value)}>{Object.entries(GEOMETRIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      <ColdProField label="Modelo de exposição" helpKey="surfaceExposureModel"><ColdProSelect value={form.surface_exposure_model ?? "fully_exposed"} onChange={(e) => set("surface_exposure_model", e.target.value)}>{Object.entries(EXPOSURE_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      {tunnelType === "static_pallet" && form.arrangement_type === "palletized_boxes" ? <ColdProField label="Modelo térmico do pallet"><ColdProSelect value={form.thermal_model_for_pallet ?? "hybrid"} onChange={(e) => set("thermal_model_for_pallet", e.target.value)}>{Object.entries(PALLET_THERMAL_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField> : null}
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
                <ColdProSelect value={form.arrangement_type} onChange={(e) => setArrangementType(e.target.value)}>
                  {arrangementOptions.map((key) => <option key={key} value={key}>{ARRANGEMENT_DEFAULTS[key]?.label ?? key}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Regime calculado" helpKey="operationRegime"><ColdProInput readOnly value={isStatic ? "Batelada / estático" : "Contínuo"} /></ColdProField>
              <ColdProField label="Modelo físico aplicado" helpKey="physicalModel"><ColdProInput readOnly value={tunnelResult.physicalModelLabel} /></ColdProField>
            </div>
            {staticWarning ? <ColdProValidationMessage tone="warning">Congelamento de caixa, pallet ou bloco depende da embalagem, arranjo, vazão e passagem real de ar. Use como estimativa conservadora.</ColdProValidationMessage> : null}
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 2 — Produto e geometria" description="Separe a dimensão da unidade/caixa da dimensão do pallet, carrinho ou bloco." icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.45fr)]"><div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">
              <ColdProField label="Pesquisar produto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <ColdProInput type="search" value={productSearch} onFocus={() => setShowProductSuggestions(true)} onBlur={() => window.setTimeout(() => setShowProductSuggestions(false), 120)} onChange={(e) => { setProductSearch(e.target.value); setShowProductSuggestions(true); }} placeholder="Digite mesmo com erro: ex. pao" className="pl-9 text-left" autoComplete="off" />
                  {showProductSuggestions && productSearch.trim() ? <div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] z-30 max-h-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                    {productSuggestions.length ? productSuggestions.map((p) => <button key={p.id} type="button" className="flex w-full flex-col rounded-sm px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground" onMouseDown={(event) => { event.preventDefault(); applyProduct(p.id); }}>
                      <span className="font-medium">{p.name}</span>
                      {p.category ? <span className="text-xs text-muted-foreground">{p.category}</span> : null}
                    </button>) : <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum produto encontrado</div>}
                  </div> : null}
                </div>
              </ColdProField>
              <ColdProField label="Grupo ASHRAE"><ColdProSelect value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setProductSearch(""); set("product_id", null); }}><option value="">Seleção manual</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto ASHRAE"><ColdProSelect value={form.product_id ?? ""} disabled={filteredProducts.length === 0} onChange={(e) => applyProduct(e.target.value)}><option value="">{filteredProducts.length ? "Selecione o produto" : "Nenhum produto encontrado"}</option>{filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto"><ColdProInput type="text" value={form.product_name ?? ""} onChange={(e) => set("product_name", e.target.value)} className="text-left" /></ColdProField>
              {selectedCatalogProduct ? <ColdProCalculatedInfo label="Dados do catálogo" value="Medidas e propriedades carregadas" description={selectedCatalogProduct.observations ?? selectedCatalogProduct.source_reference ?? "Produto técnico oficial"} tone="info" /> : null}
            </div><div className="min-w-0 rounded-lg border bg-muted/20 p-3 sm:p-4">{productGeometryFields}</div></div>
            <ColdProValidationMessage tone="error">{requiredError ? "Informe o produto do túnel." : ""}</ColdProValidationMessage>
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 3 — Massa e tempo de processo" description={isStatic ? "Batelada usa massa total do lote e tempo de batelada." : "Contínuo usa kg/h e tempo de retenção."} icon={isStatic ? <Warehouse className="h-4 w-4" /> : <Wind className="h-4 w-4" />}>
            {!isStatic ? <div className="grid grid-cols-1 gap-x-10 xl:grid-cols-2"><div>
              <ColdProField label="Como deseja calcular a massa contínua?"><ColdProSelect value={continuousMassMode} onChange={(e) => { set(tunnelType === "fluidized_bed" ? "mass_flow_mode" : "continuous_mass_mode", e.target.value); }}>{continuousModeOptions(tunnelType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Unidade do peso">
                <ColdProSelect value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
                  {Object.entries(WEIGHT_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Peso unitário" helpKey="unitWeightKg" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField>
              {continuousMassMode === "calculated_by_units_per_hour" ? <ColdProField label="Unidades por hora"><ColdProInput {...num("units_per_hour")} /></ColdProField> : null}
              {continuousMassMode === "calculated_by_belt_loading" ? <><ColdProField label="Unidades por fileira"><ColdProInput {...num("units_per_row")} /></ColdProField><ColdProField label="Fileiras por metro"><ColdProInput {...num("rows_per_meter")} /></ColdProField><ColdProField label="Velocidade esteira" unit="m/min"><ColdProInput {...num("belt_speed_m_min")} /></ColdProField></> : null}
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
              <ColdProField label="Tempo retenção" helpKey="retentionTime" unit={RETENTION_UNITS[retentionUnit].label}><ColdProInput {...retentionNum(retentionUnit)} /></ColdProField>
              {physicalModel === "continuous_spiral" ? <ColdProField label="Fator turbulência girofreezer"><ColdProInput {...num("spiral_turbulence_factor")} /></ColdProField> : null}
              <ColdProCalculatedInfo label="Massa usada no motor" value={`${fmtColdPro(massHour)} kg/h`} description={continuousMassMode === "direct_mass_flow" ? "kg/h informado" : continuousMassMode === "calculated_by_belt_loading" ? "fileiras × esteira × peso" : continuousMassMode === "calculated_by_trays" ? "bandejas/h × massa da bandeja" : "cadência calculada"} tone={massHour > 0 ? "success" : "warning"} />
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
              <ColdProField label="Cp acima" helpKey="specificHeatAbove"><ColdProInput {...lockedNum("specific_heat_above_kcal_kg_c")} /></ColdProField><ColdProField label="Cp abaixo" helpKey="specificHeatBelow"><ColdProInput {...lockedNum("specific_heat_below_kcal_kg_c")} /></ColdProField><ColdProField label="Calor latente" helpKey="latentHeat"><ColdProInput {...lockedNum("latent_heat_kcal_kg")} /></ColdProField><ColdProField label="Fração congelável" helpKey="frozenWaterFraction"><ColdProInput {...lockedNum("frozen_water_fraction")} /></ColdProField><ColdProField label="Densidade" helpKey="density" unit="kg/m³"><ColdProInput {...lockedNum("density_kg_m3")} /></ColdProField><ColdProField label="Condutividade congelado" helpKey="thermalConductivityFrozen"><ColdProInput {...lockedNum("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
            </div></div>
            {catalogLocked ? <ColdProValidationMessage>Dados térmicos bloqueados por virem do catálogo oficial. Para alterar, edite o cadastro técnico do produto.</ColdProValidationMessage> : null}
          </ColdProFormSection>

          <ColdProFormSection title="Etapa 5 — Ar, vazão e ventilação" description="A velocidade real pode ser manual ou calculada por vazão e seção livre." icon={<Fan className="h-4 w-4" />}>{airflowFields}</ColdProFormSection>
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
}
