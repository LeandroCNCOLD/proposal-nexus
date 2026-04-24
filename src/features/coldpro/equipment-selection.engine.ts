import { supabase } from "@/integrations/supabase/client";
import { evaluatePolynomial, fitPerformancePolynomial } from "./performance-polynomial";

/**
 * Motor de Seleção por Curva Real CN ColdPro
 * ------------------------------------------
 * Dado:
 *  - carga térmica requerida (kcal/h)
 *  - temperatura da câmara
 *  - temperatura de evaporação sugerida
 *  - temperatura de condensação alvo
 *  - aplicação (HT/MT/LT)
 *  - refrigerante preferido (opcional)
 *
 * Faz:
 *  1) Filtra modelos compatíveis (linha + refrigerante)
 *  2) Para cada modelo, busca seus pontos de performance
 *  3) Ajusta uma curva polinomial por modelo usando Tcam, Tevap e Tcond
 *  4) Estima capacidade, potência e COP pela curva; se não houver dados, usa interpolação/ponto próximo
 *  5) Calcula quantidade necessária e sobra técnica
 *  6) Ranqueia por: sobra dentro do alvo (5–25%), depois COP, depois menor potência
 */

export type SelectionInput = {
  required_kcal_h: number;
  internal_temp_c: number;
  evaporation_temp_c: number;
  condensation_temp_c: number;
  application?: "HT" | "MT" | "LT" | null;
  refrigerant?: string | null;
  volume_m3?: number | null;
  surplus_target_min?: number; // % default 5
  surplus_target_max?: number; // % default 25
};

export type PerformancePoint = {
  id: string;
  equipment_model_id: string;
  temperature_room_c: number | null;
  evaporation_temp_c: number | null;
  condensation_temp_c: number | null;
  evaporator_capacity_kcal_h: number | null;
  compressor_capacity_kcal_h: number | null;
  total_power_kw: number | null;
  cop: number | null;
};

type EquipmentModelRow = SelectionCandidate["model"];
type EvaporatorSelectionRow = {
  equipment_model_id: string;
  airflow_m3_h: number | null;
  evaporator_quantity: number | null;
};

export type SelectionCandidate = {
  model: {
    id: string;
    modelo: string;
    linha: string | null;
    refrigerante: string | null;
    designacao_hp: string | null;
    gabinete: string | null;
  };
  evaporator_airflow_m3_h: number | null;
  refrigerant: string | null;
  // condições alvo / encontradas
  point_used: {
    interpolated: boolean;
    polynomial: boolean;
    polynomial_r2: number | null;
    temperature_room_c: number | null;
    evaporation_temp_c: number | null;
    condensation_temp_c: number | null;
  };
  capacity_unit_kcal_h: number;
  total_power_kw: number | null;
  cop: number | null;
  quantity: number;
  capacity_total_kcal_h: number;
  air_flow_total_m3_h: number;
  surplus_kcal_h: number;
  surplus_percent: number;
  air_changes_hour: number | null;
  score: number;
  warnings: string[];
};

// === Helpers ===
function dist(a: number, b: number) {
  return Math.abs(a - b);
}

/**
 * Interpolação linear simples por temperatura de evaporação,
 * mantendo a temperatura de condensação mais próxima.
 * Se não houver dois pontos que cerquem o Tevap alvo, usa o mais próximo.
 */
function selectCapacityForModel(
  points: PerformancePoint[],
  input: SelectionInput,
): {
  capacity: number;
  power: number | null;
  cop: number | null;
  used: { interpolated: boolean; polynomial: boolean; polynomial_r2: number | null; t_room: number | null; t_evap: number | null; t_cond: number | null };
} | null {
  const valid = points.filter(
    (p) => p.evaporator_capacity_kcal_h !== null && p.evaporator_capacity_kcal_h > 0,
  );
  if (valid.length === 0) return null;

  const polynomial = fitPerformancePolynomial(valid);
  if (polynomial?.capacity) {
    const curveInput = {
      temperature_room_c: input.internal_temp_c,
      evaporation_temp_c: input.evaporation_temp_c,
      condensation_temp_c: input.condensation_temp_c,
    };
    const capacity = evaluatePolynomial(polynomial.capacity, curveInput);
    if (capacity !== null && capacity > 0) {
      const power = evaluatePolynomial(polynomial.power, curveInput);
      const cop = evaluatePolynomial(polynomial.cop, curveInput) ?? (power && power > 0 ? capacity / 860 / power : null);
      return {
        capacity,
        power,
        cop,
        used: {
          interpolated: false,
          polynomial: true,
          polynomial_r2: polynomial.capacity.r2,
          t_room: input.internal_temp_c,
          t_evap: input.evaporation_temp_c,
          t_cond: input.condensation_temp_c,
        },
      };
    }
  }

  // 1) escolhe a temperatura de condensação mais próxima do alvo
  const condCandidates = Array.from(
    new Set(valid.map((p) => p.condensation_temp_c).filter((v): v is number => v !== null)),
  );
  let targetCond = input.condensation_temp_c;
  if (condCandidates.length > 0) {
    targetCond = condCandidates.reduce((best, c) =>
      dist(c, input.condensation_temp_c) < dist(best, input.condensation_temp_c) ? c : best,
    );
  }

  // filtra pelos pontos da Tcond escolhida (com tolerância de ±2°C)
  const subset = valid.filter(
    (p) => p.condensation_temp_c === null || Math.abs((p.condensation_temp_c ?? targetCond) - targetCond) <= 2,
  );
  const pool = subset.length > 0 ? subset : valid;

  // 2) tenta interpolar em Tevap
  const targetEvap = input.evaporation_temp_c;
  const withEvap = pool.filter((p) => p.evaporation_temp_c !== null);

  if (withEvap.length >= 2) {
    // ordena por Tevap
    const sorted = [...withEvap].sort(
      (a, b) => (a.evaporation_temp_c! - b.evaporation_temp_c!),
    );
    // procura par que cerque targetEvap
    let lower: PerformancePoint | null = null;
    let upper: PerformancePoint | null = null;
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.evaporation_temp_c! <= targetEvap && b.evaporation_temp_c! >= targetEvap) {
        lower = a;
        upper = b;
        break;
      }
    }
    if (lower && upper && lower.evaporation_temp_c !== upper.evaporation_temp_c) {
      const t1 = lower.evaporation_temp_c!;
      const t2 = upper.evaporation_temp_c!;
      const ratio = (targetEvap - t1) / (t2 - t1);
      const cap =
        lower.evaporator_capacity_kcal_h! +
        (upper.evaporator_capacity_kcal_h! - lower.evaporator_capacity_kcal_h!) * ratio;
      const pow =
        lower.total_power_kw !== null && upper.total_power_kw !== null
          ? lower.total_power_kw + (upper.total_power_kw - lower.total_power_kw) * ratio
          : (upper.total_power_kw ?? lower.total_power_kw);
      const cop =
        lower.cop !== null && upper.cop !== null
          ? lower.cop + (upper.cop - lower.cop) * ratio
          : (upper.cop ?? lower.cop);
      return {
        capacity: cap,
        power: pow,
        cop,
        used: {
          interpolated: true,
          polynomial: false,
          polynomial_r2: null,
          t_room: lower.temperature_room_c,
          t_evap: targetEvap,
          t_cond: targetCond,
        },
      };
    }
  }

  // 3) fallback: ponto mais próximo do alvo no espaço (Tevap, Tcond, Tcamara)
  let best: PerformancePoint | null = null;
  let bestScore = Infinity;
  for (const p of pool) {
    let s = 0;
    if (p.evaporation_temp_c !== null) s += dist(p.evaporation_temp_c, targetEvap);
    if (p.condensation_temp_c !== null) s += dist(p.condensation_temp_c, targetCond) * 0.5;
    if (p.temperature_room_c !== null) s += dist(p.temperature_room_c, input.internal_temp_c) * 0.3;
    if (s < bestScore) {
      bestScore = s;
      best = p;
    }
  }
  if (!best) return null;
  return {
    capacity: best.evaporator_capacity_kcal_h!,
    power: best.total_power_kw,
    cop: best.cop,
    used: {
      interpolated: false,
      polynomial: false,
      polynomial_r2: null,
      t_room: best.temperature_room_c,
      t_evap: best.evaporation_temp_c,
      t_cond: best.condensation_temp_c,
    },
  };
}

/**
 * Busca candidatos no banco e retorna ranqueado.
 */
export async function findEquipmentCandidates(
  input: SelectionInput,
  db: any = supabase,
): Promise<SelectionCandidate[]> {
  const surplusMin = input.surplus_target_min ?? 5;
  const surplusMax = input.surplus_target_max ?? 25;

  // 1) filtra modelos elegíveis
  let modelsQuery = db
    .from("coldpro_equipment_models")
    .select("id, modelo, linha, refrigerante, designacao_hp, gabinete")
    .eq("active", true);

  if (input.application) modelsQuery = modelsQuery.eq("linha", input.application);
  if (input.refrigerant) modelsQuery = modelsQuery.eq("refrigerante", input.refrigerant);

  const { data: models, error: mErr } = await modelsQuery;
  if (mErr) throw new Error(`Erro ao buscar modelos: ${mErr.message}`);
  if (!models || models.length === 0) return [];

  const modelRows = (models ?? []) as EquipmentModelRow[];
  const modelIds = modelRows.map((m) => m.id);

  // 2) busca pontos de performance (em batch)
  const { data: points, error: pErr } = await db
    .from("coldpro_equipment_performance_points")
    .select(
      "id, equipment_model_id, temperature_room_c, evaporation_temp_c, condensation_temp_c, evaporator_capacity_kcal_h, compressor_capacity_kcal_h, total_power_kw, cop",
    )
    .in("equipment_model_id", modelIds);
  if (pErr) throw new Error(`Erro ao buscar pontos: ${pErr.message}`);

  // 3) busca evaporadores (vazão)
  const { data: evaporators } = await db
    .from("coldpro_equipment_evaporators")
    .select("equipment_model_id, airflow_m3_h, evaporator_quantity")
    .in("equipment_model_id", modelIds);

  const pointsByModel = new Map<string, PerformancePoint[]>();
  ((points ?? []) as PerformancePoint[]).forEach((p) => {
    const list = pointsByModel.get(p.equipment_model_id) ?? [];
    list.push(p as PerformancePoint);
    pointsByModel.set(p.equipment_model_id, list);
  });
  const evapByModel = new Map<string, { airflow: number | null; qty: number | null }>();
  ((evaporators ?? []) as EvaporatorSelectionRow[]).forEach((e) => {
    evapByModel.set(e.equipment_model_id, {
      airflow: e.airflow_m3_h,
      qty: e.evaporator_quantity,
    });
  });

  const candidates: SelectionCandidate[] = [];

  for (const m of modelRows) {
    const pts = pointsByModel.get(m.id) ?? [];
    if (pts.length === 0) continue;

    const sel = selectCapacityForModel(pts, input);
    if (!sel || sel.capacity <= 0) continue;

    const quantity = Math.max(1, Math.ceil(input.required_kcal_h / sel.capacity));
    const totalCap = sel.capacity * quantity;
    const surplusKcal = totalCap - input.required_kcal_h;
    const surplusPct = (surplusKcal / input.required_kcal_h) * 100;

    const evap = evapByModel.get(m.id);
    const airflowUnit = evap?.airflow ?? null;
    const airflowTotal = (airflowUnit ?? 0) * quantity * (evap?.qty ?? 1);
    const airChanges =
      input.volume_m3 && input.volume_m3 > 0 && airflowTotal > 0
        ? airflowTotal / input.volume_m3
        : null;

    // Score:
    //  - dentro da janela de sobra: prioridade alta (peso 0)
    //  - fora: penaliza pelo desvio
    //  - bonifica COP alto (subtrai)
    //  - penaliza potência alta
    let score = 0;
    if (surplusPct < surplusMin) score += (surplusMin - surplusPct) * 4; // sub-dimensionado é pior
    else if (surplusPct > surplusMax) score += (surplusPct - surplusMax) * 1.5;
    if (sel.cop !== null) score -= sel.cop * 5;
    if (sel.power !== null) score += sel.power * 0.3;
    score += quantity * 2; // prefere menos unidades

    const warnings: string[] = [];
    if (surplusPct < 0) warnings.push("Subdimensionado para a carga requerida");
    if (surplusPct > 50) warnings.push("Superdimensionado (>50% de folga)");
    if (sel.used.polynomial) warnings.push("Capacidade estimada por curva polinomial do catálogo");
    if (sel.used.interpolated) warnings.push("Capacidade interpolada entre pontos do catálogo");

    candidates.push({
      model: m,
      evaporator_airflow_m3_h: airflowUnit,
      refrigerant: m.refrigerante,
      point_used: {
        interpolated: sel.used.interpolated,
        polynomial: sel.used.polynomial,
        polynomial_r2: sel.used.polynomial_r2,
        temperature_room_c: sel.used.t_room,
        evaporation_temp_c: sel.used.t_evap,
        condensation_temp_c: sel.used.t_cond,
      },
      capacity_unit_kcal_h: sel.capacity,
      total_power_kw: sel.power,
      cop: sel.cop,
      quantity,
      capacity_total_kcal_h: totalCap,
      air_flow_total_m3_h: airflowTotal,
      surplus_kcal_h: surplusKcal,
      surplus_percent: surplusPct,
      air_changes_hour: airChanges,
      score,
      warnings,
    });
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates;
}

/**
 * Sugere uma temperatura de evaporação a partir da temperatura interna da câmara.
 * Regra prática: Tevap ≈ Tcamara − DT (DT ~ 6 a 10°C dependendo da aplicação)
 */
export function suggestEvaporationTemp(internalTempC: number): number {
  if (internalTempC <= -25) return internalTempC - 6;
  if (internalTempC <= -10) return internalTempC - 7;
  if (internalTempC <= 5) return internalTempC - 8;
  return internalTempC - 10;
}

/**
 * Sugere a aplicação (HT/MT/LT) a partir da temperatura interna.
 */
export function suggestApplication(internalTempC: number): "HT" | "MT" | "LT" {
  if (internalTempC <= -15) return "LT";
  if (internalTempC <= 5) return "MT";
  return "HT";
}
