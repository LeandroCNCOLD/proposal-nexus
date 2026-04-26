import * as React from "react";
import { AlertTriangle, Fan, Package, Save, Settings, Wind, Warehouse } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColdProField, ColdProInput, ColdProSelect } from "./ColdProField";
import { ColdProCalculatedInfo, ColdProFormSection, ColdProValidationMessage, fmtColdPro, numberOrNull } from "./ColdProFormPrimitives";
import { formToTunnelInput } from "@/modules/coldpro/adapters/formToTunnelInput";
import { calculateTunnelEngine } from "@/modules/coldpro/engines/tunnelEngine";
import { calculateContinuousGirofreezer } from "@/modules/coldpro/services/continuousGirofreezerService";

const ARRANGEMENT_DEFAULTS: Record<string, { air: number; penetration: number; label: string }> = {
  individual_exposed: { air: 1, penetration: 1, label: "Produto individual exposto" },
  tray_layer: { air: 0.8, penetration: 0.8, label: "Bandeja/camada" },
  cart_rack: { air: 0.7, penetration: 0.7, label: "Carrinho com circulação" },
  boxed_product: { air: 0.35, penetration: 0.45, label: "Produto em caixa" },
  pallet_block: { air: 0.15, penetration: 0.2, label: "Pallet/bloco compacto" },
  bulk_static: { air: 0.1, penetration: 0.15, label: "Massa a granel" },
};

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
  tunnel_type: "blast_freezer",
  operation_mode: "continuous",
  process_type: "continuous_individual_freezing",
  arrangement_type: "individual_exposed",
  product_name: "Produto",
  product_length_m: 0,
  product_width_m: 0,
  product_thickness_m: 0,
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
  air_delta_t_k: 6,
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
  process_time_min: 60,
  specific_heat_above_kcal_kg_c: 0.8,
  specific_heat_below_kcal_kg_c: 0.4,
  latent_heat_kcal_kg: 60,
  packaging_mass_kg_hour: 0,
  packaging_specific_heat_kcal_kg_c: 0.4,
  belt_motor_kw: 0,
  internal_fans_kw: 0,
  other_internal_kw: 0,
});

function isStaticProcess(processType: string) {
  return processType === "static_cart_freezing" || processType === "static_pallet_freezing";
}

function defaultArrangement(processType: string) {
  if (processType === "static_cart_freezing") return "cart_rack";
  if (processType === "static_pallet_freezing") return "pallet_block";
  if (processType === "continuous_girofreezer") return "tray_layer";
  return "individual_exposed";
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

  React.useEffect(() => setForm((prev: any) => ({ ...prev, ...(tunnel ?? {}), environment_id: environmentId })), [environmentId, tunnel?.id]);

  const set = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const num = (key: string) => ({ type: "number" as const, value: form?.[key] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, numberOrNull(e.target.value)) });
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
  const processType = String(form.process_type ?? "continuous_individual_freezing");
  const isStatic = isStaticProcess(processType);
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
  const staticWarning = isStatic || ["boxed_product", "pallet_block", "bulk_static"].includes(String(form.arrangement_type));
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
  const tunnelResult = calculateTunnelEngine(tunnelInput);
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
    const arrangement = defaultArrangement(value);
    const defaults = ARRANGEMENT_DEFAULTS[arrangement];
    setForm((prev: any) => ({ ...prev, process_type: value, operation_mode: isStaticProcess(value) ? "batch" : "continuous", arrangement_type: arrangement, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
  };

  const setArrangementType = (value: string) => {
    const defaults = ARRANGEMENT_DEFAULTS[value] ?? ARRANGEMENT_DEFAULTS.individual_exposed;
    setForm((prev: any) => ({ ...prev, arrangement_type: value, air_exposure_factor: defaults.air, thermal_penetration_factor: defaults.penetration }));
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
        <ColdProCalculatedInfo label={isStatic ? "Massa do lote" : "Massa usada"} value={`${fmtColdPro(isStatic ? tunnelResult.staticMassKg : tunnelResult.usedMassKgH)} ${isStatic ? "kg" : "kg/h"}`} description={isStatic ? "pallet/lote × quantidade" : "kg/h usado no motor"} tone={(isStatic ? tunnelResult.staticMassKg : tunnelResult.usedMassKgH) > 0 ? "success" : "warning"} />
        {!isStatic ? <ColdProCalculatedInfo label="Massa por cadência" value={`${fmtColdPro(tunnelResult.calculatedMassKgH)} kg/h`} description="peso × unidades × ciclos/h" tone={tunnelResult.calculatedMassKgH > 0 ? "info" : "warning"} /> : null}
        <ColdProCalculatedInfo label={isStatic ? "Tempo de batelada" : "Tempo de retenção"} value={`${fmtColdPro(tunnelResult.availableTimeMin, 1)} min`} description={isStatic ? `${fmtColdPro(Number(form.batch_time_h ?? 0), 2)} h` : "tempo disponível"} tone={tunnelResult.availableTimeMin > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Dimensão característica" value={`${fmtColdPro(tunnelResult.characteristicDimensionM, 3)} m`} description="menor dimensão térmica" tone={tunnelResult.characteristicDimensionM > 0 ? "info" : "warning"} />
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
        <ColdProCalculatedInfo label="Vazão de ar necessária" value={`${fmtColdPro(tunnelResult.airFlowM3H, 0)} m³/h`} description="potência ÷ ar × Cp × ΔT" tone={tunnelResult.airFlowM3H > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Temperatura de ar requerida" value={`${fmtColdPro(tunnelResult.requiredAirTempC, 1)} °C`} description="temperatura final - ΔT do ar" tone="info" />
        <ColdProCalculatedInfo label="Temperatura de ar informada" value={`${fmtColdPro(Number(tunnelInput.airTempC ?? 0), 1)} °C`} description="valor real usado no cálculo" tone="info" />
        <ColdProCalculatedInfo label="Diferença do ar" value={fmtMaybe(tunnelResult.calculationBreakdown.air.comparison as number | null, 1, " °C")} description="informada - requerida" tone={Number(tunnelResult.calculationBreakdown.air.comparison ?? 0) > 5 ? "warning" : "info"} />
        <ColdProCalculatedInfo label="h efetivo" value={fmtMaybe(tunnelResult.h.hEffectiveWM2K, 2, " W/m²K")} description={`Fonte: ${tunnelResult.h.source}`} tone={tunnelResult.h.hEffectiveWM2K ? "info" : "warning"} />
        <ColdProCalculatedInfo label="k efetivo" value={fmtMaybe(tunnelResult.kEffectiveWMK, 3, " W/mK")} description="condutividade × penetração" tone={tunnelResult.kEffectiveWMK ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Tempo estimado" value={fmtMaybe(tunnelResult.estimatedTimeMin, 1, " min")} description="estimativa até o núcleo" tone={tunnelResult.estimatedTimeMin ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Tempo disponível" value={`${fmtColdPro(tunnelResult.availableTimeMin, 1)} min`} description={isStatic ? "batelada" : "retenção"} tone={tunnelResult.availableTimeMin > 0 ? "info" : "warning"} />
        <ColdProCalculatedInfo label="Status" value={statusLabel[tunnelResult.status] ?? tunnelResult.status} description="tempo estimado × disponível" tone={tunnelResult.status === "adequate" ? "success" : "warning"} />
      </div>
      {tunnelResult.warnings.length > 0 ? <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Alertas técnicos:</div><ul className="list-disc space-y-1 pl-5">{tunnelResult.warnings.map((warning: string, index: number) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div> : null}
      {tunnelResult.missingFields.length > 0 ? <div className="mt-4 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning"><div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Dados necessários para cálculo completo:</div><ul className="list-disc space-y-1 pl-5">{tunnelResult.missingFields.map((field: string, index: number) => <li key={`${field}-${index}`}>{field}</li>)}</ul></div> : null}
    </>
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
          <ColdProCalculatedInfo label="Dimensão térmica" value={`${fmtColdPro(characteristic, 3)} m`} description="Caminho até núcleo = metade" tone={characteristic > 0 ? "info" : "warning"} />
        </div>
      </div>

      <Tabs defaultValue="modelo" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="modelo">Modelo físico</TabsTrigger>
          <TabsTrigger value="produto">Produto</TabsTrigger>
          <TabsTrigger value="continuo">Contínuo</TabsTrigger>
          <TabsTrigger value="estatico">Estático</TabsTrigger>
          <TabsTrigger value="ar">Ar e embalagem</TabsTrigger>
          <TabsTrigger value="cargas">Cargas internas</TabsTrigger>
        </TabsList>

        <TabsContent value="modelo">
          <ColdProFormSection title="Modelo físico aplicado" description="Escolha se o produto será tratado como unidade individual ou bloco térmico equivalente." icon={<Settings className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
              <ColdProField label="Tipo de processo">
                <ColdProSelect value={processType} onChange={(e) => setProcessType(e.target.value)}>
                  <option value="continuous_individual_freezing">Túnel contínuo individual</option>
                  <option value="continuous_girofreezer">Girofreezer contínuo</option>
                  <option value="static_cart_freezing">Estático em carrinho</option>
                  <option value="static_pallet_freezing">Estático em pallet/bloco</option>
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Tipo de arranjo">
                <ColdProSelect value={form.arrangement_type} onChange={(e) => setArrangementType(e.target.value)}>
                  {Object.entries(ARRANGEMENT_DEFAULTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Tipo de túnel"><ColdProSelect value={form.tunnel_type} onChange={(e) => set("tunnel_type", e.target.value)}><option value="blast_freezer">Congelamento</option><option value="cooling_tunnel">Resfriamento</option></ColdProSelect></ColdProField>
              <ColdProField label="Status físico"><ColdProInput readOnly value={isStatic ? "Massa agrupada / núcleo do bloco" : "Unidade individual / retenção"} /></ColdProField>
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
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Escala das medidas">
                <ColdProSelect value={continuousUnit} onChange={(e) => setContinuousUnit(e.target.value as DimensionUnit)}>
                  {Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Comprimento produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_length_m", continuousUnit)} /></ColdProField>
              <ColdProField label="Largura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_width_m", continuousUnit)} /></ColdProField>
              <ColdProField label="Espessura produto" unit={DIMENSION_UNITS[continuousUnit].label}><ColdProInput {...dimensionNum("product_thickness_m", continuousUnit)} /></ColdProField>
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
            </div></div>
            {tunnelResultCards}
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
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Escala das medidas">
                <ColdProSelect value={staticUnit} onChange={(e) => setStaticUnit(e.target.value as DimensionUnit)}>
                  {Object.entries(DIMENSION_UNITS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
                </ColdProSelect>
              </ColdProField>
              <ColdProField label="Comprimento pallet/bloco" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_length_m", staticUnit)} /></ColdProField>
              <ColdProField label="Largura pallet/bloco" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_width_m", staticUnit)} /></ColdProField>
              <ColdProField label="Altura da carga" unit={DIMENSION_UNITS[staticUnit].label}><ColdProInput {...dimensionNum("pallet_height_m", staticUnit)} /></ColdProField>
              <ColdProField label="Massa por pallet/lote" unit="kg"><ColdProInput {...num("pallet_mass_kg")} /></ColdProField>
            </div><div>
              <ColdProField label="Número de pallets/lotes"><ColdProInput {...num("number_of_pallets")} /></ColdProField>
              <ColdProField label="Tempo batelada desejado" unit="h"><ColdProInput {...num("batch_time_h")} /></ColdProField>
              <ColdProField label="Número de camadas"><ColdProInput {...num("layers_count")} /></ColdProField>
              <ColdProField label="Número de caixas"><ColdProInput {...num("boxes_count")} /></ColdProField>
              <ColdProField label="Espaçamento bandejas" unit="m"><ColdProInput {...num("tray_spacing_m")} /></ColdProField>
              <ColdProCalculatedInfo label="Massa total" value={`${fmtColdPro(staticMass)} kg`} description="massa × quantidade" tone={staticMass > 0 ? "success" : "warning"} />
            </div></div>
            {tunnelResultCards}
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="ar">
          <ColdProFormSection title="Ar, embalagem e penetração térmica" description="A condição informada é ponto inicial; a recomendação final sai da iteração." icon={<Wind className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Temp. ar inicial" unit="°C"><ColdProInput {...num("air_temp_c")} /></ColdProField>
              <ColdProField label="Velocidade inicial" unit="m/s"><ColdProInput {...num("air_velocity_m_s")} /></ColdProField>
              <ColdProField label="ΔT do ar" unit="K"><ColdProInput {...num("air_delta_t_k")} /></ColdProField>
              <ColdProField label="Vazão informada" unit="m³/h"><ColdProInput {...num("airflow_m3_h")} /></ColdProField>
              <ColdProField label="Coef. convecção manual"><ColdProInput {...num("convective_coefficient_manual_w_m2_k")} /></ColdProField>
            </div><div>
              <ColdProField label="Limite temp. mínima" unit="°C"><ColdProInput {...num("min_air_temp_c")} /></ColdProField>
              <ColdProField label="Limite temp. máxima" unit="°C"><ColdProInput {...num("max_air_temp_c")} /></ColdProField>
              <ColdProField label="Limite velocidade mín." unit="m/s"><ColdProInput {...num("min_air_velocity_m_s")} /></ColdProField>
              <ColdProField label="Limite velocidade máx." unit="m/s"><ColdProInput {...num("max_air_velocity_m_s")} /></ColdProField>
              <ColdProField label="Passo temp." unit="°C"><ColdProInput {...num("air_temp_step_c")} /></ColdProField>
              <ColdProField label="Passo velocidade" unit="m/s"><ColdProInput {...num("air_velocity_step_m_s")} /></ColdProField>
              <ColdProField label="Tipo de embalagem"><ColdProInput type="text" value={form.package_type ?? ""} onChange={(e) => set("package_type", e.target.value)} className="text-left" /></ColdProField>
              <ColdProField label="Fator exposição ao ar"><ColdProInput {...num("air_exposure_factor")} /></ColdProField>
              <ColdProField label="Fator penetração térmica"><ColdProInput {...num("thermal_penetration_factor")} /></ColdProField>
              <ColdProValidationMessage>A vazão recomendada será recalculada por potência, densidade do ar, Cp do ar e ΔT do ar.</ColdProValidationMessage>
              <ColdProValidationMessage>{velocityWarning ? "Confira a velocidade do ar. Valores usuais ficam acima de 0 e geralmente abaixo de 10 m/s." : ""}</ColdProValidationMessage>
              <ColdProValidationMessage tone="error">{processError ? (isStatic ? "Tempo de batelada deve ser maior que zero." : "Tempo de retenção deve ser maior que zero.") : ""}</ColdProValidationMessage>
            </div></div>
          </ColdProFormSection>
        </TabsContent>

        <TabsContent value="cargas">
          <ColdProFormSection title="Cargas internas" description="Embalagem, motores, ventiladores internos e demais potências dentro do túnel." icon={<Fan className="h-4 w-4" />}>
            <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2"><div>
              <ColdProField label="Embalagem" unit="kg/h"><ColdProInput {...num("packaging_mass_kg_hour")} /></ColdProField>
              <ColdProField label="Cp embalagem"><ColdProInput {...num("packaging_specific_heat_kcal_kg_c")} /></ColdProField>
            </div><div>
              <ColdProField label="Motor esteira" unit="kW"><ColdProInput {...num("belt_motor_kw")} /></ColdProField>
              <ColdProField label="Ventiladores internos" unit="kW"><ColdProInput {...num("internal_fans_kw")} /></ColdProField>
              <ColdProField label="Outras cargas" unit="kW"><ColdProInput {...num("other_internal_kw")} /></ColdProField>
            </div></div>
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
