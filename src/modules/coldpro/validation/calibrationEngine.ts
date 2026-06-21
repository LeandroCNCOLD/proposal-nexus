import { readFileSync } from "node:fs";

export type KfcalcProject = {
  arquivo: string;
  volumeM3: number;
  tempInternaC: number;
  tempExternaC: number;
  urInterna: number;
  urExterna: number;
  tempoProcessoH: number;
  cargas: {
    produto: number;
    infiltracao: number;
    trocasAr: number;
    iluminacao: number;
    motores: number;
    pessoas: number;
    total: number;
    coefSeguranca: number;
  };
};

export type CalibrationFactors = {
  produto: number;
  infiltracao: number;
  trocasAr: number;
  iluminacao: number;
  motores: number;
  pessoas: number;
  coefSeguranca: number;
};

export type CalibrationRowResult = {
  arquivo: string;
  csvTotal: number;
  coldproTotal: number;
  erro: number;
  erroPercentual: number;
  componentTotals: Omit<KfcalcProject["cargas"], "total" | "coefSeguranca">;
};

export type CalibrationReport = {
  media_erro_percentual: number;
  erro_maximo: number;
  erro_minimo: number;
  desvio_padrao: number;
  fatores_iniciais: CalibrationFactors;
  fatores_ajustados: CalibrationFactors;
  divergencias: {
    carga_auxiliar_media_percentual: number;
    coeficiente_seguranca_medio_percentual: number;
    componentes: Record<keyof Omit<KfcalcProject["cargas"], "total" | "coefSeguranca">, number>;
  };
  rows: CalibrationRowResult[];
};

export const DEFAULT_CALIBRATION_FACTORS: CalibrationFactors = {
  produto: 1,
  infiltracao: 1,
  trocasAr: 1,
  iluminacao: 1,
  motores: 1,
  pessoas: 1,
  coefSeguranca: 0,
};

export const WITHOUT_AUXILIARY_FACTORS: CalibrationFactors = {
  ...DEFAULT_CALIBRATION_FACTORS,
  iluminacao: 0,
  motores: 0,
  pessoas: 0,
};

function round(value: number, digits = 6): number {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function parseKfcalcCsv(csvText: string): KfcalcProject[] {
  const rows = parseCsv(csvText);
  const headers = rows[0] ?? [];
  return rows.slice(1).map((cells) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return {
      arquivo: String(record.arquivo ?? ""),
      volumeM3: parseNumber(record.volume_m3),
      tempInternaC: parseNumber(record.temp_interna_C),
      tempExternaC: parseNumber(record.temp_externa_C),
      urInterna: parseNumber(record.UR_interna),
      urExterna: parseNumber(record.UR_externa),
      tempoProcessoH: parseNumber(record.tempo_processo_h),
      cargas: {
        produto: parseNumber(record.carga_produtos),
        infiltracao: parseNumber(record.carga_infiltracao),
        trocasAr: parseNumber(record.carga_trocas_ar),
        iluminacao: parseNumber(record.carga_iluminacao),
        motores: parseNumber(record.carga_motores),
        pessoas: parseNumber(record.carga_pessoas),
        total: parseNumber(record.carga_total),
        coefSeguranca: parseNumber(record.coef_seguranca),
      },
    };
  });
}

export function loadKfcalcCsvFile(path: string): KfcalcProject[] {
  return parseKfcalcCsv(readFileSync(path, "utf8"));
}

export function estimateColdProTotal(project: KfcalcProject, factors: CalibrationFactors): number {
  const { cargas } = project;
  return (
    cargas.produto * factors.produto +
    cargas.infiltracao * factors.infiltracao +
    cargas.trocasAr * factors.trocasAr +
    cargas.iluminacao * factors.iluminacao +
    cargas.motores * factors.motores +
    cargas.pessoas * factors.pessoas +
    cargas.coefSeguranca * factors.coefSeguranca
  );
}

export function evaluateCalibration(
  projects: KfcalcProject[],
  factors: CalibrationFactors,
): CalibrationRowResult[] {
  return projects.map((project) => {
    const coldproTotal = estimateColdProTotal(project, factors);
    const csvTotal = project.cargas.total;
    const erro = csvTotal > 0 ? (coldproTotal - csvTotal) / csvTotal : 0;
    return {
      arquivo: project.arquivo,
      csvTotal,
      coldproTotal,
      erro,
      erroPercentual: erro * 100,
      componentTotals: {
        produto: project.cargas.produto,
        infiltracao: project.cargas.infiltracao,
        trocasAr: project.cargas.trocasAr,
        iluminacao: project.cargas.iluminacao,
        motores: project.cargas.motores,
        pessoas: project.cargas.pessoas,
      },
    };
  });
}

export function autoAdjustFactors(
  _projects: KfcalcProject[],
  initial: CalibrationFactors,
): CalibrationFactors {
  return {
    ...initial,
    produto: Number.isFinite(initial.produto) ? initial.produto : 1,
    infiltracao: Number.isFinite(initial.infiltracao) ? initial.infiltracao : 1,
    trocasAr: Number.isFinite(initial.trocasAr) ? initial.trocasAr : 1,
    iluminacao: Number.isFinite(initial.iluminacao) ? initial.iluminacao : 1,
    motores: Number.isFinite(initial.motores) ? initial.motores : 1,
    pessoas: Number.isFinite(initial.pessoas) ? initial.pessoas : 1,
    coefSeguranca: initial.coefSeguranca,
  };
}

function stats(values: number[]) {
  const mean =
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const variance =
    values.length > 0
      ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
      : 0;
  return {
    mean,
    max: values.length > 0 ? Math.max(...values) : 0,
    min: values.length > 0 ? Math.min(...values) : 0,
    stddev: Math.sqrt(variance),
  };
}

function sum(projects: KfcalcProject[], selector: (project: KfcalcProject) => number): number {
  return projects.reduce((total, project) => total + selector(project), 0);
}

export function buildCalibrationReport(
  projects: KfcalcProject[],
  initialFactors: CalibrationFactors = DEFAULT_CALIBRATION_FACTORS,
): CalibrationReport {
  const adjusted = autoAdjustFactors(projects, initialFactors);
  const rows = evaluateCalibration(projects, adjusted);
  const errors = rows.map((row) => row.erroPercentual);
  const errorStats = stats(errors);
  const total = sum(projects, (project) => project.cargas.total);
  const aux = sum(
    projects,
    (project) => project.cargas.iluminacao + project.cargas.motores + project.cargas.pessoas,
  );
  const components = {
    produto: sum(projects, (project) => project.cargas.produto),
    infiltracao: sum(projects, (project) => project.cargas.infiltracao),
    trocasAr: sum(projects, (project) => project.cargas.trocasAr),
    iluminacao: sum(projects, (project) => project.cargas.iluminacao),
    motores: sum(projects, (project) => project.cargas.motores),
    pessoas: sum(projects, (project) => project.cargas.pessoas),
  };

  return {
    media_erro_percentual: round(errorStats.mean, 4),
    erro_maximo: round(errorStats.max, 4),
    erro_minimo: round(errorStats.min, 4),
    desvio_padrao: round(errorStats.stddev, 4),
    fatores_iniciais: initialFactors,
    fatores_ajustados: adjusted,
    divergencias: {
      carga_auxiliar_media_percentual: total > 0 ? round((aux / total) * 100, 4) : 0,
      coeficiente_seguranca_medio_percentual:
        total > 0
          ? round((sum(projects, (project) => project.cargas.coefSeguranca) / total) * 100, 4)
          : 0,
      componentes: Object.fromEntries(
        Object.entries(components).map(([key, value]) => [
          key,
          total > 0 ? round((value / total) * 100, 4) : 0,
        ]),
      ) as CalibrationReport["divergencias"]["componentes"],
    },
    rows,
  };
}
