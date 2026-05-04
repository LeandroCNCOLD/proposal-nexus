/**
 * MELHORIA 2.2 — Módulo de Regras de Validação (Decoupling do Engine Principal)
 *
 * Centraliza todas as validações técnicas do ColdPro em um único lugar,
 * separando as regras de negócio do motor de cálculo.
 *
 * Tipos de validação:
 * - "error"   → bloqueia o cálculo (dado inválido ou fisicamente impossível)
 * - "warning" → cálculo prossegue, mas o usuário deve revisar
 * - "info"    → sugestão de melhoria ou informação técnica
 */

export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationCategory =
  | "dimensions"
  | "temperatures"
  | "insulation"
  | "infiltration"
  | "product"
  | "equipment"
  | "energy"
  | "process";

export interface ValidationResult {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  message: string;
  field?: string;
  suggestedValue?: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const n = (v: unknown, fallback = 0) => {
  const parsed = Number(v ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// Regras de Validação
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida as dimensões da câmara.
 */
export function validateDimensions(env: Record<string, unknown>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const width = n(env.width_m);
  const length = n(env.length_m);
  const height = n(env.height_m);
  const volume = n(env.volume_m3);

  if (width <= 0 && length <= 0 && volume <= 0) {
    results.push({ id: "dim_001", severity: "error", category: "dimensions", field: "width_m", message: "Dimensões da câmara não informadas. Informe largura × comprimento × altura ou volume total." });
  }
  if (height > 0 && height < 2.2) {
    results.push({ id: "dim_002", severity: "warning", category: "dimensions", field: "height_m", message: `Altura de ${height.toFixed(1)} m é muito baixa para uma câmara fria operacional. Altura mínima recomendada: 2,5 m.` });
  }
  if (height > 12) {
    results.push({ id: "dim_003", severity: "warning", category: "dimensions", field: "height_m", message: `Altura de ${height.toFixed(1)} m é incomum. Verifique se o valor está correto.` });
  }
  if (volume > 0 && volume < 5) {
    results.push({ id: "dim_004", severity: "info", category: "dimensions", field: "volume_m3", message: `Volume de ${volume.toFixed(1)} m³ é muito pequeno. Verifique se as dimensões estão em metros (não centímetros).` });
  }
  return results;
}

/**
 * Valida as temperaturas de operação.
 */
export function validateTemperatures(env: Record<string, unknown>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const internalTempC = n(env.internal_temp_c, null as any);
  const externalTempC = n(env.external_temp_c, null as any);
  const evaporatorTempC = n(env.evaporator_temp_c, null as any);

  if (internalTempC === null) {
    results.push({ id: "temp_001", severity: "error", category: "temperatures", field: "internal_temp_c", message: "Temperatura interna não informada." });
    return results;
  }
  if (externalTempC !== null && externalTempC <= internalTempC) {
    results.push({ id: "temp_002", severity: "warning", category: "temperatures", field: "external_temp_c", message: `Temperatura externa (${externalTempC}°C) é menor ou igual à interna (${internalTempC}°C). O cálculo de transmissão será zero. Verifique se os valores estão corretos.` });
  }
  if (internalTempC < -45) {
    results.push({ id: "temp_003", severity: "warning", category: "temperatures", field: "internal_temp_c", message: `Temperatura interna de ${internalTempC}°C é muito baixa. Verifique se o valor está correto (câmaras ultra-low geralmente usam CO₂ ou N₂ líquido).` });
  }
  if (evaporatorTempC !== null && evaporatorTempC > internalTempC) {
    results.push({ id: "temp_004", severity: "error", category: "temperatures", field: "evaporator_temp_c", message: `Temperatura do evaporador (${evaporatorTempC}°C) é maior que a temperatura interna (${internalTempC}°C). O evaporador não consegue resfriar a câmara.` });
  }
  return results;
}

/**
 * Valida o isolamento térmico.
 */
export function validateInsulation(env: Record<string, unknown>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const wallMm = n(env.wall_thickness_mm);
  const ceilingMm = n(env.ceiling_thickness_mm);
  const internalTempC = n(env.internal_temp_c);

  if (wallMm === 0 && ceilingMm === 0) {
    const faces = Array.isArray(env.construction_faces) ? env.construction_faces : [];
    if (faces.length === 0) {
      results.push({ id: "ins_001", severity: "warning", category: "insulation", field: "wall_thickness_mm", message: "Espessura de isolamento não informada. O cálculo de transmissão pode estar subestimado." });
    }
  }
  if (wallMm > 0 && wallMm < 50) {
    results.push({ id: "ins_002", severity: "warning", category: "insulation", field: "wall_thickness_mm", message: `Espessura de parede de ${wallMm} mm é muito baixa. Para câmaras frias, o mínimo recomendado é 75 mm (positivo) ou 100 mm (negativo).`, suggestedValue: internalTempC < 0 ? 100 : 75 });
  }
  if (internalTempC < -15 && wallMm > 0 && wallMm < 100) {
    results.push({ id: "ins_003", severity: "warning", category: "insulation", field: "wall_thickness_mm", message: `Para câmaras de congelamento (${internalTempC}°C), recomenda-se isolamento mínimo de 100 mm. Atual: ${wallMm} mm.`, suggestedValue: 100 });
  }
  return results;
}

/**
 * Valida a infiltração e operação de portas.
 */
export function validateInfiltration(env: Record<string, unknown>): ValidationResult[] {
  const results: ValidationResult[] = [];
  const doorOpenings = n(env.door_openings_per_day);
  const doorWidth = n(env.door_width_m);
  const doorHeight = n(env.door_height_m);
  const airChanges = n(env.air_changes_per_hour);
  const compressorHours = n(env.compressor_runtime_hours_day, 20);

  if (doorOpenings === 0 && airChanges === 0 && n(env.fresh_air_m3_h) === 0 && n(env.door_infiltration_m3_h) === 0) {
    results.push({ id: "inf_001", severity: "info", category: "infiltration", message: "Nenhuma fonte de infiltração informada. Verifique se a câmara é realmente hermética ou se os dados de porta estão corretos." });
  }
  if (doorOpenings > 200) {
    results.push({ id: "inf_002", severity: "warning", category: "infiltration", field: "door_openings_per_day", message: `${doorOpenings} aberturas de porta por dia é muito alto. Verifique se o valor está correto.` });
  }
  if (doorWidth > 0 && doorHeight > 0 && doorWidth * doorHeight > 20) {
    results.push({ id: "inf_003", severity: "warning", category: "infiltration", message: `Área de porta de ${(doorWidth * doorHeight).toFixed(1)} m² é muito grande. Verifique as dimensões.` });
  }
  if (compressorHours > 22) {
    results.push({ id: "inf_004", severity: "warning", category: "infiltration", field: "compressor_runtime_hours_day", message: `Compressor operando ${compressorHours}h/dia está próximo do limite. Verifique se a carga térmica não está superdimensionada.` });
  }
  return results;
}

/**
 * Valida o produto e a carga de produto.
 */
export function validateProduct(
  product: Record<string, unknown>,
  envInternalTempC: number,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const freezingPoint = n(product.freezing_point_c, null as any);
  const entryTemp = n(product.entry_temp_c, null as any);
  const exitTemp = n(product.exit_temp_c ?? product.storage_temp_c, null as any);
  const massKgDay = n(product.mass_kg_day);
  const massKgHour = n(product.mass_kg_hour);

  // MELHORIA 4.2 — Alerta de dano térmico (congelamento indesejado)
  if (freezingPoint !== null && exitTemp !== null && exitTemp < freezingPoint) {
    const loadMode = String(product.product_load_mode ?? "");
    const isFreezingMode = loadMode === "room_pull_down_or_freezing";
    if (!isFreezingMode) {
      results.push({
        id: "prod_001",
        severity: "warning",
        category: "product",
        field: "exit_temp_c",
        message: `⚠️ Risco de congelamento superficial: temperatura de saída (${exitTemp}°C) está abaixo do ponto de congelamento do produto (${freezingPoint}°C). Se o objetivo é apenas resfriamento, ajuste a temperatura de saída ou o modo de cálculo.`,
      });
    }
  }

  // Alerta de temperatura de câmara abaixo do ponto de congelamento para produto de resfriamento
  if (freezingPoint !== null && envInternalTempC < freezingPoint) {
    const loadMode = String(product.product_load_mode ?? "");
    const isFreezingMode = loadMode === "room_pull_down_or_freezing";
    if (!isFreezingMode) {
      results.push({
        id: "prod_002",
        severity: "warning",
        category: "product",
        field: "internal_temp_c",
        message: `⚠️ Temperatura da câmara (${envInternalTempC}°C) está abaixo do ponto de congelamento do produto "${String(product.product_name ?? "")}" (${freezingPoint}°C). Isso causará congelamento não intencional.`,
      });
    }
  }

  if (entryTemp !== null && exitTemp !== null && entryTemp <= exitTemp) {
    results.push({ id: "prod_003", severity: "warning", category: "product", message: `Temperatura de entrada (${entryTemp}°C) é menor ou igual à temperatura de saída (${exitTemp}°C). Verifique se os valores estão corretos.` });
  }
  if (massKgDay === 0 && massKgHour === 0) {
    results.push({ id: "prod_004", severity: "info", category: "product", message: "Massa do produto não informada. A carga de produto será zero." });
  }
  return results;
}

/**
 * Executa todas as validações e retorna os resultados consolidados.
 */
export function runAllValidations(
  env: Record<string, unknown>,
  products: Array<Record<string, unknown>>,
): ValidationResult[] {
  const results: ValidationResult[] = [
    ...validateDimensions(env),
    ...validateTemperatures(env),
    ...validateInsulation(env),
    ...validateInfiltration(env),
  ];

  const internalTempC = n(env.internal_temp_c);
  for (const product of products) {
    results.push(...validateProduct(product, internalTempC));
  }

  return results;
}

/**
 * Filtra os resultados por severidade.
 */
export function filterBySeverity(
  results: ValidationResult[],
  severity: ValidationSeverity,
): ValidationResult[] {
  return results.filter((r) => r.severity === severity);
}

/**
 * Verifica se há erros bloqueantes.
 */
export function hasBlockingErrors(results: ValidationResult[]): boolean {
  return results.some((r) => r.severity === "error");
}
