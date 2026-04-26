import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import type { ColdProProjectConsolidatedResult } from "../../core/projectResultConsolidator";

export type ColdProChartDatum = {
  id?: string;
  name: string;
  value: number;
  description?: string;
  meta?: Record<string, unknown>;
};

export const KCAL_PER_KW = 859.845;
export const KCAL_PER_TR = 3024;

export const COLDPRO_CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--destructive)",
  "var(--ring)",
];

export function fmtChart(value: unknown, digits = 1) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(value ?? 0));
}

export function toKW(kcalH: number) {
  return kcalH / KCAL_PER_KW;
}

export function toTR(kcalH: number) {
  return kcalH / KCAL_PER_TR;
}

export function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

export function unitValue(kcalH: number, unit: "kcal" | "kw" | "tr") {
  if (unit === "kw") return toKW(kcalH);
  if (unit === "tr") return toTR(kcalH);
  return kcalH;
}

export function unitLabel(unit: "kcal" | "kw" | "tr") {
  if (unit === "kw") return "kW";
  if (unit === "tr") return "TR";
  return "kcal/h";
}

export function filterPositive(rows: ColdProChartDatum[]) {
  return rows.filter((item) => Number(item.value) > 0);
}

export function compactSmallSlices(rows: ColdProChartDatum[], total: number, thresholdPercent = 1, maxSlices = 8) {
  const positive = filterPositive(rows).sort((a, b) => b.value - a.value);
  const small = positive.filter((item, index) => pct(item.value, total) < thresholdPercent || index >= maxSlices);
  const large = positive.filter((item, index) => pct(item.value, total) >= thresholdPercent && index < maxSlices);
  const smallTotal = small.reduce((sum, item) => sum + item.value, 0);
  return smallTotal > 0 ? [...large, { name: "Outras menores", value: smallTotal, description: "Soma de categorias menores agrupadas para melhorar a leitura." }] : large;
}

export function environmentLoadRows(normalized: ColdProNormalizedResult): ColdProChartDatum[] {
  const d = normalized.loadDistribution;
  return filterPositive([
    { name: "Transmissão", value: d.environmentKcalH, description: "Carga pelas superfícies do ambiente." },
    { name: "Produto", value: d.productKcalH, description: "Carga sensível/latente direta do produto." },
    { name: "Túnel/processo", value: d.tunnelProcessKcalH, description: "Carga calculada como processo de túnel ou processo especial." },
    { name: "Embalagem", value: d.packagingKcalH, description: "Carga térmica de embalagens." },
    { name: "Respiração", value: d.respirationKcalH, description: "Carga por respiração do produto." },
    { name: "Infiltração", value: d.infiltrationKcalH, description: "Entrada de ar externo e umidade." },
    { name: "Desumidificação", value: d.dehumidificationKcalH, description: "Carga de remoção de umidade." },
    { name: "Pessoas", value: d.peopleKcalH },
    { name: "Iluminação", value: d.lightingKcalH },
    { name: "Motores", value: d.motorsKcalH },
    { name: "Ventiladores", value: d.fansKcalH },
    { name: "Degelo", value: d.defrostKcalH },
    { name: "Gelo", value: d.iceImpactKcalH },
    { name: "Outras", value: d.otherKcalH },
    { name: "Segurança", value: d.safetyKcalH, description: "Margem de segurança aplicada ao subtotal." },
  ]);
}

export function environmentGroupedRows(normalized: ColdProNormalizedResult): ColdProChartDatum[] {
  const g = normalized.groupedLoads;
  return filterPositive([
    { name: "Transmissão", value: g.transmissionKcalH },
    { name: "Produto/processo", value: g.productsAndProcessKcalH },
    { name: "Infiltração/umidade", value: g.airAndMoistureKcalH },
    { name: "Cargas internas", value: g.internalLoadsKcalH },
    { name: "Degelo/gelo", value: g.defrostAndIceKcalH },
    { name: "Outras", value: g.otherKcalH },
    { name: "Segurança", value: g.safetyKcalH },
  ]);
}

export function projectGroupedRows(consolidated: ColdProProjectConsolidatedResult): ColdProChartDatum[] {
  const g = consolidated.groupedLoads;
  return filterPositive([
    { name: "Transmissão", value: g.transmissionKcalH },
    { name: "Produto/processo", value: g.productsAndProcessKcalH },
    { name: "Infiltração/umidade", value: g.airAndMoistureKcalH },
    { name: "Cargas internas", value: g.internalLoadsKcalH },
    { name: "Degelo/gelo", value: g.defrostAndIceKcalH },
    { name: "Segurança", value: g.safetyKcalH },
    { name: "Outras", value: g.otherKcalH },
  ]);
}

export function projectEnvironmentRows(consolidated: ColdProProjectConsolidatedResult): ColdProChartDatum[] {
  return consolidated.environmentResults
    .filter((item) => item.summary.requiredKcalH > 0)
    .map((item) => ({
      id: item.environment?.id ?? undefined,
      name: item.environment?.name ?? "Ambiente",
      value: item.summary.requiredKcalH,
      meta: { type: item.environment?.type, kw: item.summary.requiredKW, tr: item.summary.requiredTR, surplus: item.equipment.surplusPercent },
    }));
}

export function surplusStatus(surplus: number) {
  if (surplus < 0) return { label: "Subdimensionado", tone: "destructive" as const };
  if (surplus < 5) return { label: "Atenção", tone: "warning" as const };
  if (surplus <= 20) return { label: "Adequado", tone: "success" as const };
  if (surplus <= 30) return { label: "Alto", tone: "warning" as const };
  return { label: "Possível superdimensionamento", tone: "destructive" as const };
}
