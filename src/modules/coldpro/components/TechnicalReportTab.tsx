import type { ColdProResult, ColdProState } from "../types/coldPro.types";
import { Section } from "./formBits";

type AuditStep = {
  id: string;
  title: string;
  formula: string;
  resultKw: number;
  inputs?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

function formatNumber(value: unknown, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "—";
}

function renderKeyValues(values?: Record<string, unknown>) {
  if (!values) return null;
  return <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">{Object.entries(values).map(([key, value]) => <div key={key} className="rounded-md border bg-muted/30 p-2"><dt className="font-medium text-muted-foreground">{key}</dt><dd className="mt-1 break-words text-foreground">{typeof value === "number" ? formatNumber(value, 3) : String(value ?? "—")}</dd></div>)}</dl>;
}

export function TechnicalReportTab({ state, result }: { state: ColdProState; result: ColdProResult }) {
  const memory = result.calculationMemory as { steps?: AuditStep[]; totals?: Record<string, number>; auditSummary?: Record<string, unknown> };
  const steps = memory.steps ?? [];

  return <Section title="Relatório Técnico"><div className="space-y-6"><div className="rounded-lg border bg-card p-4"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Memorial auditável ColdPro</div><h3 className="mt-1 text-xl font-semibold">{state.project.name}</h3><p className="mt-2 text-sm text-muted-foreground">Aplicação: {state.project.applicationMode}. Temperaturas de projeto: interna {formatNumber(state.project.internalTempC, 1)}°C e externa {formatNumber(state.project.externalTempC, 1)}°C.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-md border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Carga base</div><div className="text-lg font-semibold">{formatNumber(result.baseTotalKw)} kW</div></div><div className="rounded-md border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Carga corrigida</div><div className="text-lg font-semibold">{formatNumber(result.correctedTotalKw)} kW</div></div><div className="rounded-md border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Equivalente</div><div className="text-lg font-semibold">{formatNumber(result.totalKcalH, 0)} kcal/h</div></div><div className="rounded-md border bg-muted/30 p-3"><div className="text-xs text-muted-foreground">Toneladas de refrigeração</div><div className="text-lg font-semibold">{formatNumber(result.totalTr)} TR</div></div></div></div>{memory.auditSummary && <div className="rounded-lg border p-4"><h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Critério do relatório</h4><div className="mt-3">{renderKeyValues(memory.auditSummary)}</div></div>}<div className="space-y-4">{steps.map((step) => <article key={step.id} className="rounded-lg border bg-card p-4"><div className="flex flex-col gap-2 border-b pb-3 md:flex-row md:items-start md:justify-between"><div><h4 className="text-base font-semibold">{step.title}</h4><p className="mt-1 text-sm text-muted-foreground">{step.formula}</p></div><div className="text-left md:text-right"><div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</div><div className="text-lg font-semibold">{formatNumber(step.resultKw, 3)} kW</div></div></div><div className="mt-4 space-y-3"><div><h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entradas utilizadas</h5>{renderKeyValues(step.inputs)}</div><details className="rounded-md border bg-muted/30 p-3"><summary className="cursor-pointer text-sm font-medium">Detalhamento técnico completo</summary><pre className="mt-3 max-h-[320px] overflow-auto rounded-md bg-background p-3 text-xs leading-relaxed">{JSON.stringify(step.details, null, 2)}</pre></details></div></article>)}</div>{result.warnings.length > 0 && <div className="rounded-lg border border-warning/40 bg-warning/10 p-4"><h4 className="text-sm font-semibold">Observações de validação</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}<details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-semibold">Memória JSON completa para auditoria</summary><pre className="mt-3 max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{JSON.stringify(result.calculationMemory, null, 2)}</pre></details></div></Section>;
}
