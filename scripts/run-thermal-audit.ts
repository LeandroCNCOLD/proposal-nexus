import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  calculateKfcalcCompat,
  type KfcalcCompatComponents,
  type KfcalcCompatInputs,
  type KfcalcCompatResult,
} from "../src/modules/coldpro/audit/kfcalcCompatEngine";
type AuditStatus = "OK" | "ATENÇÃO" | "DIVERGENTE";

type ThermalComparison = {
  absoluteDifferenceKcalH: number;
  percentDifference: number;
  status: AuditStatus;
};

type AuditCase = {
  id: string;
  name: string;
  externalSystem: string;
  inputs: KfcalcCompatInputs;
  components: KfcalcCompatComponents;
  expectedKcalH?: number;
  coldproKcalH?: number;
};

type AuditCaseResult = {
  id: string;
  name: string;
  externalSystem: string;
  inputs: KfcalcCompatInputs;
  kfcalcResult: KfcalcCompatResult;
  coldproResult: {
    totalComSegurancaKcalH: number;
    source: string;
  };
  comparison: ThermalAuditComparison;
  diagnosis: string[];
  recommendations: string[];
};

const ROOT = process.cwd();
const OUTPUT_JSON = resolve(ROOT, "audit-output/thermal-audit-report.json");
const OUTPUT_MD = resolve(ROOT, "docs/auditoria-coldpro/RELATORIO_COMPARATIVO_KFCALC_SEQCT.md");

function compareThermalResults(referenceKcalH: number, candidateKcalH: number): ThermalComparison {
  const absoluteDifferenceKcalH = candidateKcalH - referenceKcalH;
  const percentDifference =
    referenceKcalH > 0 ? (absoluteDifferenceKcalH / referenceKcalH) * 100 : 0;
  const abs = Math.abs(percentDifference);
  const status: AuditStatus = abs <= 5 ? "OK" : abs <= 15 ? "ATENÇÃO" : "DIVERGENTE";
  return {
    absoluteDifferenceKcalH,
    percentDifference,
    status,
  };
}

function summarizeThermalComparisons(comparisons: ThermalComparison[]) {
  return {
    totalCases: comparisons.length,
    ok: comparisons.filter((item) => item.status === "OK").length,
    warning: comparisons.filter((item) => item.status === "ATENÇÃO").length,
    divergent: comparisons.filter((item) => item.status === "DIVERGENTE").length,
    mainDivergenceCauses: [] as string[],
  };
}

function readJsonIfExists(path: string): unknown | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function positiveNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeCase(raw: unknown, index: number, externalSystem: string): AuditCase | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const loads = (record.cargas_calculadas ?? record.loads ?? record.cargas ?? {}) as Record<
    string,
    unknown
  >;
  const dimensions = (record.dimensoes ?? {}) as Record<string, unknown>;
  const temperature = (record.temperatura ?? {}) as Record<string, unknown>;
  const inputs = (record.inputs ?? record.input ?? {}) as Record<string, unknown>;
  const volumeM3 = positiveNumber(inputs.volumeM3 ?? inputs.volume_m3 ?? dimensions.volume);
  const internalTempC = Number(
    inputs.internalTempC ?? inputs.temp_interna_C ?? temperature.interna ?? 0,
  );
  const externalTempC = Number(
    inputs.externalTempC ?? inputs.temp_externa_C ?? temperature.externa ?? 0,
  );
  const deltaT = Number.isFinite(Number(temperature.diferenca))
    ? Number(temperature.diferenca)
    : externalTempC - internalTempC;

  return {
    id: String(record.id ?? `case_${index + 1}`),
    name: String(record.name ?? record.nome ?? record.arquivo ?? `Caso ${index + 1}`),
    externalSystem,
    expectedKcalH: positiveNumber(
      record.expectedKcalH ?? record.totalKcalH ?? loads.total_com_seguranca,
    ),
    coldproKcalH: positiveNumber(record.coldproKcalH ?? record.coldpro_total_kcal_h),
    inputs: {
      volumeM3,
      internalTempC,
      externalTempC,
      airChangesPerDay: positiveNumber(inputs.infiltrationAirChangesPerDay ?? inputs.trocas_dia),
      exchangeAirChangesPerDay: positiveNumber(inputs.airChangesPerDay ?? inputs.numero_trocas),
      productMassKg: positiveNumber(inputs.productMassKg ?? inputs.massa_produto),
      productSpecificHeatKcalKgC: positiveNumber(
        inputs.productSpecificHeatKcalKgC ?? inputs.cp_produto,
      ),
      productInitialTempC: positiveNumber(
        inputs.productInitialTempC ?? inputs.temperatura_inicial_produto,
      ),
      productFinalTempC: positiveNumber(
        inputs.productFinalTempC ?? inputs.temperatura_final_produto,
      ),
      processTimeH:
        positiveNumber(inputs.processTimeH ?? inputs.tempo_h ?? record.tempo_processo_h) || 24,
      lightingPowerW: positiveNumber(inputs.lightingPowerW ?? inputs.potencia_iluminacao_w),
      motorPowerW: positiveNumber(inputs.motorsPowerW ?? inputs.potencia_motores_w),
      peopleCount: positiveNumber(inputs.peopleCount ?? inputs.numero_pessoas),
      safetyFactor: positiveNumber(loads.fator_seguranca ?? inputs.fator_seguranca) || 1.1,
    },
    components: {
      infiltracao: positiveNumber(loads.infiltracao),
      produto: positiveNumber(loads.produtos ?? loads.produto),
      trocas_ar: positiveNumber(loads.trocas_ar),
      iluminacao: positiveNumber(loads.iluminacao),
      motores: positiveNumber(loads.motores),
      pessoas: positiveNumber(loads.pessoas),
    },
  };
}

function defaultCases(): AuditCase[] {
  return [
    {
      id: "relatorio_001",
      name: "Câmara Pequena - Conservação",
      externalSystem: "KFCalc/SEQCT exemplo",
      expectedKcalH: 987.94,
      inputs: {
        volumeM3: 18.5,
        internalTempC: 9,
        externalTempC: 35,
        processTimeH: 24,
        safetyFactor: 1.1,
      },
      components: {
        infiltracao: 232.67,
        produto: 0,
        trocas_ar: 520.29,
        iluminacao: 28.67,
        motores: 0,
        pessoas: 116.5,
      },
    },
    {
      id: "relatorio_002",
      name: "Câmara Grande - Congelamento",
      externalSystem: "KFCalc/SEQCT exemplo",
      expectedKcalH: 43140.92,
      inputs: {
        volumeM3: 24000,
        internalTempC: 2,
        externalTempC: 20,
        processTimeH: 24,
        safetyFactor: 1.1,
      },
      components: {
        infiltracao: 0,
        produto: 1,
        trocas_ar: 9488.37,
        iluminacao: 35.83,
        motores: 29695.82,
        pessoas: 0,
      },
    },
  ];
}

function loadCases(): AuditCase[] {
  const candidates = [
    { path: "casos_teste_kfcalc.json", externalSystem: "KFCalc" },
    { path: "casos_teste_coldpro.json", externalSystem: "ColdPro" },
    { path: "dados_consolidados.json", externalSystem: "Consolidado" },
  ];
  const loaded: AuditCase[] = [];
  for (const candidate of candidates) {
    const data = readJsonIfExists(resolve(ROOT, candidate.path));
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown> | null)?.cases)
        ? ((data as Record<string, unknown>).cases as unknown[])
        : [];
    list.forEach((item, index) => {
      const normalized = normalizeCase(item, index, candidate.externalSystem);
      if (normalized) loaded.push(normalized);
    });
  }
  return loaded.length > 0 ? loaded : defaultCases();
}

function diagnose(
  caseData: AuditCase,
  result: KfcalcCompatResult,
  comparison: ThermalComparison,
): string[] {
  const out: string[] = [];
  const c = result.components;
  if (c.infiltracao > 0 && c.trocas_ar > 0)
    out.push("Verificar possível duplicidade infiltração/trocas de ar.");
  if (c.produto <= 0) out.push("Carga de produto ausente ou simplificada.");
  if (c.motores <= 0 || c.iluminacao <= 0 || c.pessoas <= 0)
    out.push("Verificar cargas auxiliares zeradas.");
  if (Math.abs(result.fatorSeguranca - 1.1) > 0.001) out.push("Diferença de fator de segurança.");
  if (comparison.status !== "OK")
    out.push("Diferença acima do limite; validar unidade, tempo de processo e dados de entrada.");
  if (!caseData.expectedKcalH && !caseData.coldproKcalH)
    out.push("Sem referência externa explícita; comparação usa resultado compat como proxy.");
  return out;
}

function recommendations(diagnosis: string[]): string[] {
  const out = new Set<string>();
  if (diagnosis.some((d) => /duplicidade/.test(d)))
    out.add("Separar regra de infiltração e trocas de ar para evitar dupla contagem.");
  if (diagnosis.some((d) => /produto/.test(d)))
    out.add("Adicionar massa, Cp, deltaT e tempo do produto para recalcular carga do zero.");
  if (diagnosis.some((d) => /auxiliares/.test(d)))
    out.add("Preencher motores, iluminação e pessoas antes de comparar com KFCalc/SEQCT.");
  out.add("Conferir se todos os valores estão em kcal/h antes da comparação.");
  return Array.from(out);
}

export function runThermalAudit() {
  const cases = loadCases();
  const results: AuditCaseResult[] = cases.map((caseData) => {
    const kfcalcResult = calculateKfcalcCompat(caseData.inputs, caseData.components);
    const coldproTotal = caseData.coldproKcalH || kfcalcResult.totalComSeguranca;
    const comparison = compareThermalResults(kfcalcResult.totalComSeguranca, coldproTotal);
    const diagnosis = diagnose(caseData, kfcalcResult, comparison);
    return {
      id: caseData.id,
      name: caseData.name,
      externalSystem: caseData.externalSystem,
      inputs: caseData.inputs,
      kfcalcResult,
      coldproResult: {
        totalComSegurancaKcalH: coldproTotal,
        source: caseData.coldproKcalH ? "coldpro input" : "proxy compat",
      },
      comparison,
      diagnosis,
      recommendations: recommendations(diagnosis),
    };
  });
  return {
    cases: results,
    summary: summarizeThermalComparisons(results.map((item) => item.comparison)),
  };
}

function renderMarkdown(report: ReturnType<typeof runThermalAudit>): string {
  return [
    "# Relatório Comparativo KFCalc / SEQCT / ColdPro",
    "",
    "## Resumo executivo",
    "",
    `- Total de casos: ${report.summary.totalCases}`,
    `- OK: ${report.summary.ok}`,
    `- ATENÇÃO: ${report.summary.warning}`,
    `- DIVERGENTE: ${report.summary.divergent}`,
    "",
    "## Fórmulas KFCalc/SEQCT aplicadas",
    "",
    "- Q_infiltracao = 1.2 * volume * 0.24 * deltaT * trocas_dia / 24",
    "- Q_trocas_ar = 1.2 * volume * 0.24 * deltaT * numero_trocas / 24",
    "- Q_produto = massa * cp * deltaT / tempo_h",
    "- Q_iluminacao = potencia_w * 0.86",
    "- Q_motores = potencia_w * 0.86",
    "- Q_pessoas = numero_pessoas * 300",
    "- Q_total_com_segurança = soma * fator_segurança",
    "",
    "## Casos comparados",
    "",
    ...report.cases.flatMap((item) => [
      `### ${item.name}`,
      "",
      `- Sistema externo: ${item.externalSystem}`,
      `- KFCalc/SEQCT: ${item.kfcalcResult.totalComSeguranca.toFixed(2)} kcal/h`,
      `- ColdPro: ${item.coldproResult.totalComSegurancaKcalH.toFixed(2)} kcal/h`,
      `- Diferença: ${item.comparison.percentDifference.toFixed(2)}%`,
      `- Status: ${item.comparison.status}`,
      `- Diagnóstico: ${item.diagnosis.join(" ") || "Sem divergência relevante."}`,
      `- Recomendações: ${item.recommendations.join(" ")}`,
      "",
    ]),
    "## Principais causas prováveis",
    "",
    ...report.summary.mainDivergenceCauses.map((cause) => `- ${cause}`),
    "",
  ].join("\n");
}

function printConsole(report: ReturnType<typeof runThermalAudit>) {
  console.log("----------------------------------");
  console.log("AUDITORIA DE CARGA TÉRMICA");
  console.log("----------------------------------");
  for (const item of report.cases) {
    const sign = item.comparison.percentDifference >= 0 ? "+" : "";
    console.log("");
    console.log(`Caso: ${item.name}`);
    console.log(`KFCalc: ${item.kfcalcResult.totalComSeguranca.toFixed(0)} kcal/h`);
    console.log(`ColdPro: ${item.coldproResult.totalComSegurancaKcalH.toFixed(0)} kcal/h`);
    console.log(`Diferença: ${sign}${item.comparison.percentDifference.toFixed(1)}%`);
    console.log(`Status: ${item.comparison.status}`);
  }
  console.log("");
  console.log("----------------------------------");
  console.log("RESUMO");
  console.log("----------------------------------");
  console.log(`Total casos: ${report.summary.totalCases}`);
  console.log(`OK: ${report.summary.ok}`);
  console.log(`ATENÇÃO: ${report.summary.warning}`);
  console.log(`DIVERGENTE: ${report.summary.divergent}`);
}

function saveOutputs(report: ReturnType<typeof runThermalAudit>) {
  mkdirSync(resolve(ROOT, "audit-output"), { recursive: true });
  mkdirSync(resolve(ROOT, "docs/auditoria-coldpro"), { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2));
  writeFileSync(OUTPUT_MD, renderMarkdown(report));
}

const report = runThermalAudit();
printConsole(report);
saveOutputs(report);
console.log("");
console.log(`JSON: ${OUTPUT_JSON}`);
console.log(`Markdown: ${OUTPUT_MD}`);
