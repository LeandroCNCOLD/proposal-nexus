/**
 * MELHORIA 2.1 — Versionamento de Resultados de Cálculo (Calculation Snapshots)
 *
 * Cada vez que o usuário executa um cálculo, um snapshot imutável é criado
 * contendo os inputs e outputs completos. Isso permite:
 * - Histórico de cálculos por ambiente
 * - Comparação "Cenário A vs Cenário B"
 * - Rastreabilidade de mudanças de premissas
 * - Reversão para um cálculo anterior
 */

export interface CalculationSnapshotInput {
  /** ID do ambiente ColdPro */
  environmentId: string;
  /** Label descritivo do cenário (ex: "Isolamento 100mm", "Isolamento 150mm") */
  scenarioLabel?: string | null;
  /** JSON completo dos inputs do ambiente no momento do cálculo */
  inputSnapshot: Record<string, unknown>;
  /** JSON completo do resultado do cálculo */
  resultSnapshot: Record<string, unknown>;
  /** Versão do engine de cálculo usada */
  engineVersion?: string | null;
}

export interface CalculationSnapshot extends CalculationSnapshotInput {
  id: string;
  createdAt: string;
  /** Hash SHA-256 do inputSnapshot para detecção de mudanças */
  inputHash: string;
}

export interface SnapshotComparison {
  snapshotA: CalculationSnapshot;
  snapshotB: CalculationSnapshot;
  differences: SnapshotDifference[];
  totalLoadDeltaKcalH: number;
  totalLoadDeltaPercent: number;
  energySavingKwhYear: number;
}

export interface SnapshotDifference {
  field: string;
  labelA: string;
  labelB: string;
  valueA: unknown;
  valueB: unknown;
  unit?: string;
  impact: "positive" | "negative" | "neutral";
}

/**
 * Gera um hash simples (djb2) do objeto de input para detecção de mudanças.
 * Em produção, substituir por SHA-256 via Web Crypto API.
 */
export function hashInputSnapshot(input: Record<string, unknown>): string {
  const str = JSON.stringify(input, Object.keys(input).sort());
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // converte para unsigned 32-bit
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Cria um novo snapshot de cálculo.
 */
export function createCalculationSnapshot(input: CalculationSnapshotInput): CalculationSnapshot {
  return {
    ...input,
    id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    inputHash: hashInputSnapshot(input.inputSnapshot),
  };
}

/**
 * Compara dois snapshots e retorna as diferenças relevantes para o cálculo.
 */
export function compareSnapshots(
  snapshotA: CalculationSnapshot,
  snapshotB: CalculationSnapshot,
): SnapshotComparison {
  const differences: SnapshotDifference[] = [];

  const TRACKED_FIELDS: Array<{ key: string; label: string; unit?: string }> = [
    { key: "wall_thickness_mm", label: "Espessura da parede", unit: "mm" },
    { key: "ceiling_thickness_mm", label: "Espessura do teto", unit: "mm" },
    { key: "floor_thickness_mm", label: "Espessura do piso", unit: "mm" },
    { key: "internal_temp_c", label: "Temperatura interna", unit: "°C" },
    { key: "external_temp_c", label: "Temperatura externa", unit: "°C" },
    { key: "safety_factor_percent", label: "Fator de segurança", unit: "%" },
    { key: "compressor_runtime_hours_day", label: "Horas do compressor/dia", unit: "h" },
    { key: "door_openings_per_day", label: "Aberturas de porta/dia" },
    { key: "people_count", label: "Número de pessoas" },
    { key: "lighting_power_w", label: "Potência de iluminação", unit: "W" },
  ];

  for (const field of TRACKED_FIELDS) {
    const valueA = snapshotA.inputSnapshot[field.key];
    const valueB = snapshotB.inputSnapshot[field.key];
    if (valueA !== valueB) {
      differences.push({
        field: field.key,
        labelA: String(valueA ?? "—"),
        labelB: String(valueB ?? "—"),
        valueA,
        valueB,
        unit: field.unit,
        impact: "neutral",
      });
    }
  }

  // Comparar carga total
  const totalA = Number((snapshotA.resultSnapshot as any)?.total_kcal_h ?? 0);
  const totalB = Number((snapshotB.resultSnapshot as any)?.total_kcal_h ?? 0);
  const totalLoadDeltaKcalH = totalB - totalA;
  const totalLoadDeltaPercent = totalA > 0 ? (totalLoadDeltaKcalH / totalA) * 100 : 0;

  // Economia de energia anual estimada (assumindo COP 2.5 e 8760h/ano)
  const COP = 2.5;
  const hoursYear = 8760;
  const energySavingKwhYear = Math.abs(totalLoadDeltaKcalH) / 860 / COP * hoursYear;

  return {
    snapshotA,
    snapshotB,
    differences,
    totalLoadDeltaKcalH: Math.round(totalLoadDeltaKcalH * 100) / 100,
    totalLoadDeltaPercent: Math.round(totalLoadDeltaPercent * 10) / 10,
    energySavingKwhYear: Math.round(energySavingKwhYear),
  };
}

/**
 * Formata a diferença de carga para exibição ao usuário.
 */
export function formatLoadDelta(delta: number, percent: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${Math.round(delta).toLocaleString("pt-BR")} kcal/h (${sign}${percent.toFixed(1)}%)`;
}
