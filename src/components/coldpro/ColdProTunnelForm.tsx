import * as React from "react";
import { AlertTriangle, Calculator, Fan, Package, Save, Settings, Thermometer, Wind, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";
import { formToTunnelInput } from "@/modules/coldpro/adapters/formToTunnelInput";
import { calculateTunnelEngine } from "@/modules/coldpro/engines/tunnelEngine";
import { calculateContinuousGirofreezer } from "@/modules/coldpro/services/continuousGirofreezerService";

const ARRANGEMENT_DEFAULTS: Record<string, { air: number; penetration: number; label: string }> = {
  individual_units: { air: 1, penetration: 1, label: "Produto individual sobre esteira" }, single_layer_blocks: { air: 0.8, penetration: 0.85, label: "Blocos em camada única" }, trays: { air: 0.65, penetration: 0.75, label: "Bandejas" }, stacked_packages: { air: 0.45, penetration: 0.55, label: "Pacotes empilhados" }, packaged_units: { air: 0.55, penetration: 0.65, label: "Produto embalado" }, trays_on_racks: { air: 0.65, penetration: 0.75, label: "Bandejas em racks/carrinhos" }, boxes_on_cart: { air: 0.35, penetration: 0.45, label: "Caixas em carrinho" }, hanging_product: { air: 0.8, penetration: 0.85, label: "Produto suspenso" }, palletized_boxes: { air: 0.35, penetration: 0.45, label: "Caixas paletizadas" }, palletized_blocks: { air: 0.25, penetration: 0.35, label: "Blocos paletizados" }, bulk_on_pallet: { air: 0.2, penetration: 0.3, label: "Produto a granel sobre pallet" }, loose_particles: { air: 0.9, penetration: 0.95, label: "Partículas soltas" }, small_individual_units: { air: 0.9, penetration: 0.95, label: "Unidades pequenas individuais" }, boxes: { air: 0.35, penetration: 0.45, label: "Caixas" }, racks: { air: 0.65, penetration: 0.75, label: "Racks" }, bulk_container: { air: 0.4, penetration: 0.5, label: "Contentores" },
};

const TUNNEL_TYPES = { continuous_belt: "Túnel contínuo de esteira", spiral_girofreezer: "Girofreezer / espiral", static_cart: "Túnel estático com carrinhos", static_pallet: "Túnel estático com pallets", fluidized_bed: "Leito fluidizado / IQF", blast_freezer: "Câmara/túnel de ar forçado" } as const;
const ARRANGEMENTS_BY_TUNNEL: Record<string, string[]> = { continuous_belt: ["individual_units", "single_layer_blocks", "trays", "stacked_packages"], spiral_girofreezer: ["individual_units", "trays", "packaged_units"], static_cart: ["trays_on_racks", "boxes_on_cart", "hanging_product"], static_pallet: ["palletized_boxes", "palletized_blocks", "bulk_on_pallet"], fluidized_bed: ["loose_particles", "small_individual_units"], blast_freezer: ["boxes", "racks", "bulk_container"] };
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

function kcalFromThermal(kcal?: unknown, kj?: unknown) {
  return positiveValue(kcal) || positiveValue(kj) / 4.1868;
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
  const [continuousUnit, setContinuousUnit] = React.useState<DimensionUnit>("m");
  const [staticUnit, setStaticUnit] = React.useState<DimensionUnit>("m");
  const [weightUnit, setWeightUnit] = React.useState<WeightUnit>("kg");
  const [cycleUnit, setCycleUnit] = React.useState<CycleUnit>("h");
  const [retentionUnit, setRetentionUnit] = React.useState<RetentionUnit>("min");
  const [activeTab, setActiveTab] = React.useState("modelo");
  const [simulation, setSimulation] = React.useState<any>(() => simulationDraftFromTunnel(defaultTunnel(environmentId)));

  React.useEffect(() => {
    const next = { ...defaultTunnel(environmentId), ...(tunnel ?? {}), environment_id: environmentId };
    setForm(next);
    setSimulation(simulationDraftFromTunnel(next));
  }, [environmentId, tunnel?.id]);

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const num = (key: string) => ({ type: "number" as const, value: form?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });
  const setSim = (key: string, value: unknown) => setSimulation((prev: any) => ({ ...prev, [key]: value }));
  const simNum = (key: string) => ({ type: "number" as const, value: simulation?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSim(key, numberOrNull(e.target.value)) });
  const dimensionValueM = (key: string) => key === "product_thickness_m" ? (Number(form.product_thickness_m ?? 0) || Number(form.product_thickness_mm ?? 0) / 1000) : Number(form?.[key] ?? 0);
  const dimensionNum = (key: string, unit: DimensionUnit) => {
    const unitConfig = DIMENSION_UNITS[unit];
    const valueM = dimensionValueM(key);
    return {
      type: "number" as const,
      step: unitConfig.step,
      value: Number.isFinite(valueM) && valueM !== 0 ? valueM / unitConfig.toMeters : form?.[key] === 0 ? 0 : "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value) === null ? null : Number(e.target.value) * unitConfig.toMeters),
    };
  };
  const weightNum = (key: string, unit: WeightUnit) => {
    const unitConfig = WEIGHT_UNITS[unit];
    const valueKg = Number(form?.[key] ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valueKg) && valueKg !== 0 ? valueKg / unitConfig.toKg : form?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value) === null ? null : Number(e.target.value) * unitConfig.toKg) };
  };
  const cyclesNum = (unit: CycleUnit) => {
    const unitConfig = CYCLE_UNITS[unit];
    const valuePerHour = Number(form.cycles_per_hour ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valuePerHour) && valuePerHour !== 0 ? valuePerHour / unitConfig.toCyclesPerHour : form.cycles_per_hour === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set("cycles_per_hour", numberOrNull(e.target.value) === null ? null : Number(e.target.value) * unitConfig.toCyclesPerHour) };
  };
  const retentionNum = (unit: RetentionUnit) => {
    const unitConfig = RETENTION_UNITS[unit];
    const valueMin = Number(form.process_time_min ?? 0);
    return { type: "number" as const, step: unitConfig.step, value: Number.isFinite(valueMin) && valueMin !== 0 ? valueMin / unitConfig.toMinutes : form.process_time_min === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set("process_time_min", numberOrNull(e.target.value) === null ? null : Number(e.target.value) * unitConfig.toMinutes) };
  };
  const blockagePercentNum = (key: string) => {
    const value = Number(form?.[key] ?? 0);
    return { type: "number" as const, min: 0, max: 95, step: "0.1", value: Number.isFinite(value) && value !== 0 ? value * 100 : form?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value) === null ? null : Math.min(Math.max(Number(e.target.value), 0), 95) / 100) };
  };
  const simBlockagePercentNum = (key: string) => {
    const value = Number(simulation?.[key] ?? 0);
    return { type: "number" as const, min: 0, max: 95, step: "0.1", value: Number.isFinite(value) && value !== 0 ? value * 100 : simulation?.[key] === 0 ? 0 : "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSim(key, numberOrNull(e.target.value) === null ? null : Math.min(Math.max(Number(e.target.value), 0), 95) / 100) };
  };
  const processType = String(form.process_type ?? "continuous_individual_freezing");
  const tunnelType = String(form.tunnel_type ?? legacyTunnelType(processType));
  const arrangementOptions = ARRANGEMENTS_BY_TUNNEL[tunnelType] ?? ARRANGEMENTS_BY_TUNNEL.continuous_belt;
  const physicalModel = String(form.physical_model ?? physicalModelFromProcess(processType));
  const isStatic = ["static_cart", "static_pallet", "blast_freezer"].includes(tunnelType) || isStaticTunnel(processType, form.operation_mode);
  const modelTab = isStatic ? "estatico" : "continuo";
  const unitWeight = Number(form.unit_weight_kg ?? 0) || Number(form.product_unit_weight_kg ?? 0);
  const throughput = Number(form.units_per_cycle ?? 0) * unitWeight * Number(form.cycles_per_hour ?? 0);
  const massHour = Number(form.mass_kg_hour ?? 0) || throughput;
  const staticMass = Number(form.pallet_mass_kg ?? 0) * Math.max(1, Number(form.number_of_pallets ?? 1));
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
    directMassKgH: Number(form.mass_kg_hour ?? 0),
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
  const filteredProducts = React.useMemo(() => productCatalog.filter((p) => !selectedGroup || p.category === selectedGroup), [productCatalog, selectedGroup]);

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
    setForm((prev: any) => ({ ...prev, tunnel_type: value, process_type: value, physical_model: physicalModelFromProcess(value), operation_mode: nextIsStatic ? "batch" : "continuous", tunnel_mode: nextIsStatic ? "static" : "continuous", arrangement_type: arrangement, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
    setActiveTab(nextIsStatic ? "estatico" : "continuo");
  };

  const setArrangementType = (value: string) => {
    const defaults = ARRANGEMENT_DEFAULTS[value] ?? ARRANGEMENT_DEFAULTS.individual_units;
    setForm((prev: any) => ({ ...prev, arrangement_type: value, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
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
    setForm((prev: any) => ({
      ...prev,
      product_id: p.id,
      product_name: p.name,
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
  };

  const save = () => onSave({
    ...form,
    physical_model: tunnelResult.physicalModel,
    tunnel_type: tunnelResult.tunnelType,
    arrangement_type: tunnelResult.arrangementType,
    spiral_turbulence_factor: Number(form.spiral_turbulence_factor ?? 1.8),
    block_exposure_factor: Number(form.block_exposure_factor ?? 0.7),
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
    air_flow_m3_h: tunnelResult.airFlowM3H ?? null,
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
        <ColdProCalculatedInfo label="Modelo físico aplicado" value={tunnelResult.physicalModelLabel} description={tunnelResult.calculationBreakdown.model.physicalDescription} tone="info" />
        <ColdProCalculatedInfo label="Tipo de túnel" value={TUNNEL_TYPES[tunnelResult.tunnelType as keyof typeof TUNNEL_TYPES] ?? tunnelResult.tunnelType} description={tunnelResult.operationRegime === "batch" ? "batelada" : "contínuo"} tone="info" />
        <ColdProCalculatedInfo label="Tipo de arranjo" value={ARRANGEMENT_DEFAULTS[String(tunnelResult.arrangementType)]?.label ?? String(tunnelResult.arrangementType ?? "—")} description="arranjo usado no fator de exposição" tone="info" />
        <ColdProCalculatedInfo label="Geometria do produto" value={GEOMETRIES[String(tunnelResult.productGeometry) as keyof typeof GEOMETRIES] ?? String(tunnelResult.productGeometry ?? "—")} description={String(tunnelResult.geometrySource ?? "")} tone="info" />
        {tunnelResult.thermalModelForPallet ? <ColdProCalculatedInfo label="Modelo térmico do pallet" value={PALLET_THERMAL_MODELS[String(tunnelResult.thermalModelForPallet) as keyof typeof PALLET_THERMAL_MODELS] ?? String(tunnelResult.thermalModelForPallet)} description="separa caixa individual e bloco paletizado" tone="info" /> : null}
        <ColdProCalculatedInfo label="Premissa geométrica" value={tunnelResult.physicalModel === "static_block" ? "Bloco/pallet" : "Espessura"} description={tunnelResult.calculationBreakdown.model.geometryAssumption} tone="info" />
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
        <ColdProCalculatedInfo label="Vazão de ar estimada" value={`${fmtColdPro(tunnelResult.airFlowM3H, 0)} m³/h`} description="por balanço térmico" tone={tunnelResult.airFlowM3H > 0 ? "info" : "warning"} />
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
        <ColdProCalculatedInfo label="Diferença do ar" value={fmtMaybe(tunnelResult.calculationBreakdown.air.comparison as number | null, 1, " °C")} description="informada - sugerida" tone={Number(tunnelResult.calculationBreakdown.air.comparison ?? 0) > 5 ? "warning" : "info"} />
        <ColdProCalculatedInfo label="h base" value={fmtMaybe(tunnelResult.h.hBaseWM2K, 2, " W/m²K")} description="antes dos fatores de exposição" tone={tunnelResult.h.hBaseWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="h efetivo" value={fmtMaybe(tunnelResult.h.hEffectiveWM2K, 2, " W/m²K")} description={`Fonte: ${tunnelResult.h.source}`} tone={tunnelResult.h.hEffectiveWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Fonte do h" value={tunnelResult.h.source} description={tunnelResult.calculationBreakdown.model.convectionAssumption} tone="info" />
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
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <ColdProCalculatedInfo label="Projeto · Carga" value={`${fmtColdPro(initialScenario.totalKW, 2)} kW`} description={`${fmtColdPro(initialScenario.totalKcalH, 0)} kcal/h`} tone="info" />
        <ColdProCalculatedInfo label="Projeto · Tempo" value={fmtMaybe(initialScenario.estimatedTimeMin, 1, " min")} description={`${fmtColdPro(initialScenario.availableTimeMin, 1)} min disponíveis`} tone={initialScenario.status === "adequate" ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Projeto · Vazão" value={`${fmtColdPro(initialScenario.airFlowM3H, 0)} m³/h`} description="estimada pelo motor" tone="info" />
        <ColdProCalculatedInfo label="Projeto · Temp. sugerida" value={`${fmtColdPro(initialScenario.suggestedAirTempC, 1)} °C`} description="final - approach" tone="info" />
        <ColdProCalculatedInfo label="Projeto · Status" value={statusLabel[initialScenario.status] ?? initialScenario.status} description="referência do motor" tone={initialScenario.status === "adequate" ? "success" : "warning"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
        <ColdProField label="Temp. ar simulada" unit="°C"><ColdProInput {...simNum("air_temp_c")} /></ColdProField>
        <ColdProField label="Fonte da velocidade"><ColdProSelect value={simulation.airflow_source ?? "manual_velocity"} onChange={(e) => setSim("airflow_source", e.target.value)}><option value="manual_velocity">Velocidade manual</option><option value="airflow_by_fans">Vazão por ventiladores</option></ColdProSelect></ColdProField>
        {simulation.airflow_source !== "airflow_by_fans" ? <ColdProField label="Velocidade simulada" unit="m/s"><ColdProInput {...simNum("air_velocity_m_s")} /></ColdProField> : null}
        {simulation.airflow_source === "airflow_by_fans" ? <><ColdProField label="Vazão dos ventiladores" unit="m³/h"><ColdProInput {...simNum("fan_airflow_m3_h")} /></ColdProField><ColdProField label="Largura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_width_m")} /></ColdProField><ColdProField label="Altura seção túnel" unit="m"><ColdProInput {...simNum("tunnel_cross_section_height_m")} /></ColdProField><ColdProField label="Fator de bloqueio" unit="%"><ColdProInput {...simBlockagePercentNum("blockage_factor")} /></ColdProField><ColdProCalculatedInfo label="Área livre simulada" value={`${fmtColdPro(simulationResult.freeAirAreaM2 ?? 0, 2)} m²`} description="seção livre calculada" tone={(simulationResult.freeAirAreaM2 ?? 0) > 0 ? "info" : "warning"} /><ColdProCalculatedInfo label="Velocidade simulada" value={`${fmtColdPro(simulationResult.calculatedAirVelocityMS ?? 0, 2)} m/s`} description="vazão ÷ área livre" tone="info" /></> : null}
        <ColdProField label="ΔT do ar" unit="K"><ColdProInput {...simNum("air_delta_t_k")} /></ColdProField>
        <ColdProField label="Approach ar sugerido" unit="K"><ColdProInput {...simNum("suggested_air_approach_k")} /></ColdProField>
        <ColdProField label="Vazão informada" unit="m³/h"><ColdProInput {...simNum("informed_air_flow_m3_h")} /></ColdProField>
        <ColdProField label="Coef. convecção manual"><ColdProInput {...simNum("convective_coefficient_manual_w_m2_k")} /></ColdProField>
      </div><div>
        <ColdProField label="Tipo de embalagem"><ColdProInput type="text" value={simulation.package_type ?? ""} onChange={(e) => setSim("package_type", e.target.value)} className="text-left" /></ColdProField>
        <ColdProField label="Fator exposição ao ar"><ColdProInput {...simNum("air_exposure_factor")} /></ColdProField>
        <ColdProField label="Fator penetração térmica"><ColdProInput {...simNum("thermal_penetration_factor")} /></ColdProField>
        <ColdProField label="Limite velocidade mín." unit="m/s"><ColdProInput {...num("min_air_velocity_m_s")} /></ColdProField>
        <ColdProField label="Limite velocidade máx." unit="m/s"><ColdProInput {...num("max_air_velocity_m_s")} /></ColdProField>
        <ColdProValidationMessage>{velocityWarning ? "Confira a velocidade do ar. Valores usuais ficam acima de 0 e geralmente abaixo de 10 m/s." : ""}</ColdProValidationMessage>
        <ColdProValidationMessage tone="error">{processError ? (isStatic ? "Tempo de batelada deve ser maior que zero." : "Tempo de retenção deve ser maior que zero.") : ""}</ColdProValidationMessage>
      </div></div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <ColdProCalculatedInfo label="Ajustado · Carga" value={`${fmtColdPro(adjustedScenario.totalKW, 2)} kW`} description={`${fmtColdPro(adjustedScenario.totalKcalH, 0)} kcal/h`} tone="info" />
        <ColdProCalculatedInfo label="Ajustado · Tempo" value={fmtMaybe(adjustedScenario.estimatedTimeMin, 1, " min")} description={`${fmtColdPro(adjustedScenario.availableTimeMin, 1)} min disponíveis`} tone={adjustedScenario.status === "adequate" ? "success" : "warning"} />
        <ColdProCalculatedInfo label="Ajustado · Vazão" value={`${fmtColdPro(adjustedScenario.airFlowM3H, 0)} m³/h`} description={adjustedScenario.informedAirFlowM3H ? `informada: ${fmtColdPro(adjustedScenario.informedAirFlowM3H, 0)} m³/h` : "estimada pelo motor"} tone="info" />
        <ColdProCalculatedInfo label="Ajustado · h efetivo" value={fmtMaybe(adjustedScenario.hEffectiveWM2K, 2, " W/m²K")} description={adjustedScenario.hSource} tone={adjustedScenario.hEffectiveWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Ajustado · Status" value={statusLabel[adjustedScenario.status] ?? adjustedScenario.status} description="cenário simulado" tone={adjustedScenario.status === "adequate" ? "success" : "warning"} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
    <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
      <ColdProField label="Embalagem" unit="kg/h"><ColdProInput {...num("packaging_mass_kg_hour")} /></ColdProField>
      <ColdProField label="Cp embalagem"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField>
    </div><div>
      <ColdProField label="Motor esteira" unit="kW"><ColdProInput {...num("belt_motor_kw")} /></ColdProField>
      <ColdProField label="Ventiladores internos" unit="kW"><ColdProInput {...num("internal_fans_kw")} /></ColdProField>
      <ColdProField label="Outras cargas" unit="kW"><ColdProInput {...num("other_internal_kw")} /></ColdProField>
    </div></div>
  );

  const productGeometryFields = (
    <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
      <ColdProField label="Tipo de arranjo">
        <ColdProSelect value={form.arrangement_type} onChange={(e) => setArrangementType(e.target.value)}>
          {arrangementOptions.map((key) => <option key={key} value={key}>{ARRANGEMENT_DEFAULTS[key]?.label ?? key}</option>)}
        </ColdProSelect>
      </ColdProField>
      <ColdProField label="Geometria do produto"><ColdProSelect value={form.product_geometry ?? "slab"} onChange={(e) => set("product_geometry", e.target.value)}>{Object.entries(GEOMETRIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      <ColdProField label="Modelo de exposição"><ColdProSelect value={form.surface_exposure_model ?? "fully_exposed"} onChange={(e) => set("surface_exposure_model", e.target.value)}>{Object.entries(EXPOSURE_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</ColdProSelect></ColdProField>
      <ColdProField label="Escala das medidas do produto"><ColdProSelect value={continuousUnit} onChange={(e) => setContinuousUnit(e.target.value as DimensionUnit)}>{Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</ColdProSelect></ColdProField>
      {form.product_geometry === "slab" ? <><ColdProField label="Comprimento produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_width_m", continuousUnit)} /></ColdProField><ColdProField label="Espessura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_thickness_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "rectangular_prism" ? <><ColdProField label="Comprimento produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_width_m", continuousUnit)} /></ColdProField><ColdProField label="Altura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_height_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "cube" ? <ColdProField label="Lado do cubo" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_side_m", continuousUnit)} /></ColdProField> : null}
      {form.product_geometry === "cylinder" ? <><ColdProField label="Diâmetro produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_diameter_m", continuousUnit)} /></ColdProField><ColdProField label="Comprimento produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "sphere" ? <ColdProField label="Diâmetro produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_diameter_m", continuousUnit)} /></ColdProField> : null}
      {form.product_geometry === "packed_box" ? <><ColdProField label="Comprimento caixa" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_length_m", continuousUnit)} /></ColdProField><ColdProField label="Largura caixa" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_width_m", continuousUnit)} /></ColdProField><ColdProField label="Altura caixa" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("box_height_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "bulk" ? <><ColdProField label="Altura da camada" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("bulk_layer_height_m", continuousUnit)} /></ColdProField><ColdProField label="Diâmetro equivalente partícula" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("equivalent_particle_diameter_m", continuousUnit)} /></ColdProField></> : null}
      {form.product_geometry === "irregular" ? <><ColdProField label="Diâmetro equivalente" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("equivalent_diameter_m", continuousUnit)} /></ColdProField><ColdProField label="Dimensão característica manual" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("characteristic_dimension_m", continuousUnit)} /></ColdProField></> : null}
    </div>
  );

  return (
    <div className="rounded-xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Túnel de congelamento / resfriamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configuração térmica separando produto individual e massa agrupada.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:min-w-80">
          <ColdProCalculatedInfo label={isStatic ? "Massa lote" : "Throughput"} value={`${fmtColdPro(isStatic ? staticMass : massHour)} ${isStatic ? "kg" : "kg/h"}`} description={isStatic ? "pallet/lote × quantidade" : "kg/h ou un/ciclo"} tone={(isStatic ? staticMass : massHour) > 0 ? "success" : "warning"} />
          <ColdProCalculatedInfo label="Dimensão térmica" value={`${fmtColdPro(tunnelResult.characteristicDimensionM, 3)} m`} description="Caminho até núcleo = metade" tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="modelo">Modelo físico</TabsTrigger>
          <TabsTrigger value="produto">Produto</TabsTrigger>
          <TabsTrigger value={modelTab}>{isStatic ? "Estático" : "Contínuo"}</TabsTrigger>
        </TabsList>

        <TabsContent value="modelo">
          <ColdProFormSection title="Modelo físico aplicado" description="Escolha se o produto será tratado como unidade individual ou bloco térmico equivalente." icon={<Settings className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <ColdProField label="Tipo de túnel">
                <ColdProSelect value={tunnelType} onChange={(e) => setTunnelType(e.target.value)}>
                  {Object.entries(TUNNEL_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Status físico"><ColdProInput readOnly value={tunnelResult.physicalModelLabel} /></ColdProField>
            </div>
            {staticWarning ? <ColdProValidationMessage tone="warning">Congelamento de caixa, pallet ou bloco depende da embalagem, arranjo, vazão e passagem real de ar. Use como estimativa conservadora.</ColdProValidationMessage> : null}
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="produto">
          <ColdProFormSection title="Produto e propriedades térmicas" description="Propriedades do alimento; geometria e embalagem são parâmetros de aplicação." icon={<Package className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Grupo ASHRAE"><ColdProSelect value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); set("product_id", null); }}><option value="">Seleção manual</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto ASHRAE"><ColdProSelect value={form.product_id ?? ""} disabled={!selectedGroup} onChange={(e) => applyProduct(e.target.value)}><option value="">{selectedGroup ? "Selecione o produto" : "Selecione primeiro o grupo"}</option>{filteredProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</ColdProSelect></ColdProField>
              <ColdProField label="Produto"><ColdProInput type="text" value={form.product_name ?? ""} onChange={(e) => set("product_name", e.target.value)} className="text-left" /></ColdProField>
              <ColdProField label="Densidade" unit="kg/m³"><ColdProInput {...num("density_kg_m3")} /></ColdProField>
            </div><div>
              <ColdProField label="Temp. entrada" unit="°C"><ColdProInput {...num("inlet_temp_c")} /></ColdProField>
              <ColdProField label="Temp. final" unit="°C"><ColdProInput {...num("outlet_temp_c")} /></ColdProField>
              <ColdProField label="Temp. congelamento" unit="°C"><ColdProInput {...num("freezing_temp_c")} /></ColdProField>
              <ColdProField label="Cp acima"><ColdProInput {...num("specific_heat_above_kcal_kg_c")} /></ColdProField>
              <ColdProField label="Cp abaixo"><ColdProInput {...num("specific_heat_below_kcal_kg_c")} /></ColdProField>
              <ColdProField label="Calor latente"><ColdProInput {...num("latent_heat_kcal_kg")} /></ColdProField>
              <ColdProField label="Condutividade congelado"><ColdProInput {...num("thermal_conductivity_frozen_w_m_k")} /></ColdProField>
              <ColdProField label="Água" unit="%"><ColdProInput {...num("water_content_percent")} /></ColdProField>
            </div></div>
            <ColdProValidationMessage tone="error">{requiredError ? "Informe o produto do túnel." : ""}</ColdProValidationMessage>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="continuo">
          <ColdProFormSection title="Contínuo / girofreezer" description="Produto individualizado ou camada fina exposta ao ar." icon={<Wind className="h-4 w-4" />}>
            {productGeometryFields}
            <div className="mt-5 border-t pt-5" />
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Unidade do peso">
                <ColdProSelect value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
                  {Object.entries(WEIGHT_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Peso unitário" unit={WEIGHT_UNITS[weightUnit].label}><ColdProInput {...weightNum("unit_weight_kg", weightUnit)} /></ColdProField>
            </div><div>
              <ColdProField label="Unidades/ciclo"><ColdProInput {...num("units_per_cycle")} /></ColdProField>
              <ColdProField label="Escala dos ciclos">
                <ColdProSelect value={cycleUnit} onChange={(e) => setCycleUnit(e.target.value as CycleUnit)}>
                  {Object.entries(CYCLE_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Ciclos" unit={CYCLE_UNITS[cycleUnit].label}><ColdProInput {...cyclesNum(cycleUnit)} /></ColdProField>
              <ColdProField label="Massa direta" unit="kg/h"><ColdProInput {...num("mass_kg_hour")} /></ColdProField>
              <ColdProField label="Escala do tempo">
                <ColdProSelect value={retentionUnit} onChange={(e) => setRetentionUnit(e.target.value as RetentionUnit)}>
                  {Object.entries(RETENTION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Tempo retenção" unit={RETENTION_UNITS[retentionUnit].label}><ColdProInput {...retentionNum(retentionUnit)} /></ColdProField>
              {physicalModel === "continuous_spiral" ? <ColdProField label="Fator turbulência girofreezer"><ColdProInput {...num("spiral_turbulence_factor")} /></ColdProField> : null}
            </div></div>
            {physicalModel === "continuous_spiral" ? <ColdProValidationMessage>Girofreezer usa alta convecção: o h calculado recebe fator de turbulência; coeficiente manual não é multiplicado.</ColdProValidationMessage> : null}
            {tunnelResultCards}
            <div className="mt-6 border-t pt-5">
              <ColdProFormSection title="Ar, embalagem, penetração e cargas internas" description="Use como simulador de preenchimento sem sobrescrever o projeto até aplicar a simulação." icon={<Fan className="h-4 w-4" />}>
                {thermalSimulationFields}
                <div className="mt-5 border-t pt-5">{internalLoadFields}</div>
              </ColdProFormSection>
            </div>
            {giroResult.errors.length > 0 ? (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Erros de preenchimento:</div>
                <ul className="list-disc space-y-1 pl-5">{giroResult.errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
              </div>
            ) : null}
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="estatico">
          <ColdProFormSection title="Estático / carrinho / pallet" description="Massa agrupada tratada como bloco térmico equivalente." icon={<Warehouse className="h-4 w-4" />}>
            {productGeometryFields}
            <div className="mt-5 border-t pt-5" />
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Escala das medidas">
                <ColdProSelect value={staticUnit} onChange={(e) => setStaticUnit(e.target.value as DimensionUnit)}>
                  {Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Comprimento carrinho/carga" : "Comprimento pallet/bloco"} unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_length_m", staticUnit)} /></ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Largura carrinho/carga" : "Largura pallet/bloco"} unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_width_m", staticUnit)} /></ColdProField>
              <ColdProField label={tunnelType === "static_cart" ? "Altura carrinho/carga" : "Altura da carga"} unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_height_m", staticUnit)} /></ColdProField>
              {tunnelType === "static_cart" ? <><ColdProField label="Número de camadas"><ColdProInput {...num("layers_count")} /></ColdProField><ColdProField label="Espaçamento bandejas" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("tray_spacing_m", staticUnit)} /></ColdProField></> : null}
              <ColdProField label="Massa por pallet/lote" unit="kg"><ColdProInput {...num("pallet_mass_kg")} /></ColdProField>
            </div><div>
              <ColdProField label="Número de pallets/lotes"><ColdProInput {...num("number_of_pallets")} /></ColdProField>
              <ColdProField label="Tempo batelada desejado" unit="h"><ColdProInput {...num("batch_time_h")} /></ColdProField>
              {physicalModel === "static_block" ? <ColdProField label="Fator exposição bloco"><ColdProInput {...num("block_exposure_factor")} /></ColdProField> : null}
              {tunnelType === "static_cart" ? <ColdProField label="Número de caixas"><ColdProInput {...num("boxes_count")} /></ColdProField> : null}
              <ColdProCalculatedInfo label="Massa total" value={`${fmtColdPro(staticMass)} kg`} description="massa × quantidade" tone={staticMass > 0 ? "success" : "warning"} />
            </div></div>
            {physicalModel === "static_cart" ? <ColdProValidationMessage>Estático em carrinho trata o produto como bandejas/rack expostos e usa a espessura do produto como dimensão crítica.</ColdProValidationMessage> : null}
            {physicalModel === "static_block" ? <ColdProValidationMessage tone="warning">Estático em pallet/bloco usa a menor dimensão do bloco e aplica redução de exposição; é uma estimativa conservadora.</ColdProValidationMessage> : null}
            {tunnelResultCards}
            <div className="mt-6 border-t pt-5">
              <ColdProFormSection title="Ar, embalagem, penetração e cargas internas" description="Use como simulador de preenchimento sem sobrescrever o projeto até aplicar a simulação." icon={<Fan className="h-4 w-4" />}>
                {thermalSimulationFields}
                <div className="mt-5 border-t pt-5">{internalLoadFields}</div>
              </ColdProFormSection>
            </div>
          </ColdProFormSection>
        </TabsContent>

      </Tabs>

      <div className="mt-5 flex justify-end border-t pt-4">
        <button type="button" disabled={!canSave} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={save}>
          <Save className="h-4 w-4" /> Salvar túnel
        </button>
      </div>
    </div>
  );
}
