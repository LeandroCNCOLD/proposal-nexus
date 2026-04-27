export type ColdProTechnicalStatus = "VALID" | "WARNING" | "BLOCKED" | "INVALID_INPUT";

const TUNNEL_TYPES = new Set([
  "blast_freezer",
  "freezing_tunnel",
  "cooling_tunnel",
  "tunnel",
  "static_pallet",
  "static_cart",
  "continuous_belt",
  "spiral_girofreezer",
  "fluidized_bed",
]);

function n(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function provided(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function key(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getColdProApplicationLabel(value: unknown) {
  const type = key(value);
  if (type === "blast_freezer") return "Blast freezer";
  if (["cooling_tunnel"].includes(type)) return "Túnel de resfriamento";
  if (["freezing_tunnel", "tunnel", "static_pallet", "static_cart", "continuous_belt", "spiral_girofreezer", "fluidized_bed"].includes(type)) return "Túnel de congelamento";
  if (["freezer_room", "frozen_room", "frozen_storage"].includes(type)) return "Câmara de congelados";
  if (["chilled_room", "cold_room", "positive_room"].includes(type)) return "Câmara fria";
  if (type === "seed_storage") return "Armazenagem de sementes";
  if (type === "climatized_room" || type === "climatized") return "Sala climatizada";
  return value ? String(value) : "—";
}

export function isColdProTunnelLike(environment?: any | null, tunnel?: any | null) {
  const values = [environment?.environment_type, environment?.application_type, tunnel?.tunnel_type, tunnel?.process_type, tunnel?.processType, tunnel?.tunnelType];
  return values.some((value) => TUNNEL_TYPES.has(key(value)) || key(value).includes("tunnel") || key(value).includes("freezing"));
}

export function auditColdProTechnicalConsistency(input: { environment?: any | null; result?: any | null; tunnel?: any | null; products?: any[]; advancedProcesses?: any[]; selection?: any | null }) {
  const { environment, result, tunnel, products = [], advancedProcesses = [] } = input;
  const blockers: Array<{ code: string; message: string }> = [];
  const warnings: Array<{ code: string; message: string }> = [];
  const tunnelData = tunnel ?? result?.calculation_breakdown?.tunnel ?? result?.calculation_breakdown?.tunnel?.calculation_breakdown ?? null;
  const tunnelLike = isColdProTunnelLike(environment, tunnelData);
  const internalTempC = n(environment?.internal_temp_c ?? environment?.internalTempC ?? tunnelData?.airTempC);
  const productProcessKcalH = n(result?.product_kcal_h) + n(result?.packaging_kcal_h) + n(result?.tunnel_internal_load_kcal_h ?? tunnelData?.total_kcal_h ?? tunnelData?.totalKcalH);
  const tunnelProductKcalH = n(tunnelData?.product_kcal_h ?? tunnelData?.productKcalH ?? tunnelData?.product_load_kw) * (n(tunnelData?.product_load_kw) > 0 ? 859.845 : 1);
  const processMass = Math.max(n(tunnelData?.used_mass_kg_h), n(tunnelData?.calculated_mass_kg_h), n(tunnelData?.static_mass_kg), n(tunnelData?.staticMassKg), ...products.map((p) => Math.max(n(p.mass_kg_day), n(p.mass_kg_hour), n(p.freezing_batch_mass_kg))));
  const processTime = Math.max(n(tunnelData?.batch_time_h), n(tunnelData?.process_time_min), n(tunnelData?.availableTimeMin), ...products.map((p) => Math.max(n(p.process_time_h), n(p.freezing_batch_time_h))));
  const inletProvided = provided(tunnelData?.inlet_temp_c ?? tunnelData?.initialTempC ?? products[0]?.inlet_temp_c);
  const outletProvided = provided(tunnelData?.outlet_temp_c ?? tunnelData?.finalTempC ?? products[0]?.outlet_temp_c);
  const thermalValid = n(tunnelData?.q_specific_kj_kg ?? tunnelData?.energy?.totalKJkg) > 0 || n(tunnelData?.specific_heat_above_kj_kg_k ?? tunnelData?.cpAboveKJkgK ?? products[0]?.specific_heat_above_kj_kg_k) > 0;
  const totalKcalH = n(result?.total_required_kcal_h ?? tunnelData?.total_kcal_h ?? tunnelData?.totalKcalH);
  const subtotalKcalH = n(result?.subtotal_kcal_h);
  const infiltrationKcalH = n(result?.infiltration_kcal_h ?? tunnelData?.infiltrationLoadKW) * (n(tunnelData?.infiltrationLoadKW) > 0 ? 859.845 : 1);
  const defrostKcalH = n(result?.defrost_kcal_h);
  const doorArea = n(environment?.door_width_m) * n(environment?.door_height_m) || n(environment?.total_door_area_m2) || n(result?.calculation_breakdown?.infiltration_technical?.doorAreaM2);
  const doorOpenings = n(environment?.door_openings_per_day ?? result?.calculation_breakdown?.infiltration_technical?.doorOpeningsPerDay);

  if (tunnelLike) {
    if (processMass <= 0 || processTime <= 0 || productProcessKcalH <= 0 || tunnelProductKcalH <= 0) blockers.push({ code: "tunnel_product_process_zero", message: "Produto/processo zerado em túnel ou blast freezer. Carga térmica inválida." });
    if (!inletProvided) blockers.push({ code: "tunnel_inlet_temp_missing", message: "Temperatura de entrada do produto ausente em túnel ou blast freezer." });
    if (!outletProvided) blockers.push({ code: "tunnel_outlet_temp_missing", message: "Temperatura final do produto ausente em túnel ou blast freezer." });
    if (!thermalValid) blockers.push({ code: "tunnel_thermal_properties_missing", message: "Propriedades térmicas obrigatórias ausentes em túnel ou blast freezer." });
    if (totalKcalH > 0 && totalKcalH < 10000) warnings.push({ code: "tunnel_low_total_load", message: "Carga térmica baixa para túnel de congelamento. Validar massa, tempo e produto." });
  }

  if (internalTempC < 0 && defrostKcalH <= 0) blockers.push({ code: "negative_room_without_defrost", message: "Câmara negativa com degelo equivalente zerado; revisar umidade, infiltração e premissas de degelo." });
  if (internalTempC < 0 && infiltrationKcalH <= 0) warnings.push({ code: "negative_room_zero_infiltration", message: "Infiltração zerada em ambiente negativo. Validar portas, abertura e operação real." });
  if (internalTempC < 0 && doorArea <= 0 && doorOpenings <= 0) warnings.push({ code: "no_operational_opening_premise", message: "Ambiente sem abertura operacional informada." });
  if ((doorArea > 0 || doorOpenings > 0) && infiltrationKcalH <= 0) warnings.push({ code: "door_without_infiltration", message: "Há porta, abertura ou operação informada, mas a infiltração ficou zerada; revisar dimensões, tempo aberta e operação real." });
  if (totalKcalH > 0 && subtotalKcalH > 0 && totalKcalH + 1 < subtotalKcalH) blockers.push({ code: "required_below_subtotal", message: "Carga total requerida menor que subtotal válido." });
  if (totalKcalH > 0 && productProcessKcalH > 0 && totalKcalH + 1 < productProcessKcalH) blockers.push({ code: "required_below_product", message: "Carga total requerida menor que carga de produto/processo." });

  for (const process of advancedProcesses) {
    if (key(process?.advanced_process_type) !== "none" && n(process?.calculation_result?.total_additional_kcal_h) <= 0) warnings.push({ code: "advanced_process_zero", message: "Processo especial informado com carga adicional zerada; validar dados obrigatórios do processo." });
  }

  const technicalStatus: ColdProTechnicalStatus = blockers.length ? "BLOCKED" : warnings.length ? "WARNING" : "VALID";
  return {
    technicalStatus,
    isBlocked: technicalStatus === "BLOCKED" || technicalStatus === "INVALID_INPUT",
    isPreliminary: technicalStatus !== "VALID",
    blockers,
    warnings,
    criticalWarnings: blockers.map((item) => item.message),
    displayApplicationLabel: getColdProApplicationLabel(environment?.environment_type ?? tunnelData?.tunnel_type),
  };
}