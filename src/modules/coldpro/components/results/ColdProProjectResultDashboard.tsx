import * as React from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Bot, Building2, Calculator, Gauge, Loader2, Snowflake, Sparkles } from "lucide-react";
import { consolidateColdProProjectResult } from "../../core/projectResultConsolidator";
import { buildColdProProjectAIContext, compactColdProAIQuestion } from "../../core/aiTechnicalContextBuilder";
import { fmtColdProChart } from "./chartUtils";

type Props = {
  project: any;
  environments: any[];
  results: any[];
  selections: any[];
  products: any[];
  advancedProcesses?: any[];
  onAnalyze?: (question: string, previousAnalysis?: string | null) => Promise<string | null>;
  isAnalyzing?: boolean;
};

function Kpi({ label, value, unit, icon }: { label: string; value: unknown; unit: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <div className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{fmtColdProChart(value, 2)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

const ACTIONS = [
  ["Auditar projeto", "Audite o resultado geral consolidado, totais, divergências críticas por ambiente e fechamento global."],
  ["Comparar ambientes", "Compare os ambientes por carga requerida, capacidade selecionada, sobra e criticidade."],
  ["Gerar laudo geral", "Gere análise geral do projeto sem atribuir totais globais a ambientes individuais."],
] as const;

export function ColdProProjectResultDashboard(props: Props) {
  const consolidated = consolidateColdProProjectResult(props);
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const max = Math.max(1, ...consolidated.ranking.map((item) => item.requiredKcalH));

  async function run(label: string, instruction: string) {
    if (!props.onAnalyze) return;
    setError(null);
    const context = buildColdProProjectAIContext(consolidated);
    const warnings = context.consistencyAudit.warnings.slice(0, 6).join(" | ");
    const question = compactColdProAIQuestion(label, `${instruction} Totais: ${fmtColdProChart(context.summary.requiredKcalH, 0)} kcal/h, ${fmtColdProChart(context.summary.requiredKW, 1)} kW, ${fmtColdProChart(context.summary.requiredTR, 1)} TR. Alertas: ${warnings || "sem alertas críticos"}.`, "project");
    const response = await props.onAnalyze(question, analysis);
    if (response) setAnalysis(response);
    else setError("A IA não retornou análise para o resultado geral.");
  }

  return (
    <section className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resultado Geral do Projeto</h3>
          <p className="text-sm text-muted-foreground">Consolidado de todos os ambientes, separado do ambiente atualmente selecionado.</p>
        </div>
        <span className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{consolidated.summary.calculatedEnvironmentCount}/{consolidated.summary.environmentCount} ambientes calculados</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Carga total" value={consolidated.summary.requiredKcalH} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
        <Kpi label="Potência total" value={consolidated.summary.requiredKW} unit="kW" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Capacidade" value={consolidated.summary.requiredTR} unit="TR" icon={<Snowflake className="h-4 w-4" />} />
        <Kpi label="Capacidade selecionada" value={consolidated.summary.totalSelectedCapacityKcalH} unit="kcal/h" icon={<Building2 className="h-4 w-4" />} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border p-4">
          <h4 className="mb-3 text-sm font-semibold">Ranking de ambientes por carga</h4>
          <div className="space-y-3">
            {consolidated.ranking.map((item) => (
              <div key={item.environmentId ?? item.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{item.position}. {item.name}</span>
                  <b className="tabular-nums">{fmtColdProChart(item.requiredKcalH, 0)} kcal/h</b>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (item.requiredKcalH / max) * 100)}%` }} /></div>
                <div className="text-xs text-muted-foreground">Capacidade selecionada: {fmtColdProChart(item.selectedCapacityKcalH, 0)} kcal/h · Sobra: {fmtColdProChart(item.surplusPercent, 1)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <h4 className="mb-3 text-sm font-semibold">Auditoria global</h4>
          {consolidated.consistencyAudit.hasCriticalDivergence ? (
            <div className="space-y-2">
              <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" /> {consolidated.consistencyAudit.criticalEnvironmentCount} ambiente(s) com divergência crítica.</div>
              {consolidated.consistencyAudit.warnings.slice(0, 5).map((warning) => <div key={warning} className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">{warning}</div>)}
            </div>
          ) : <div className="rounded-md bg-primary/5 p-3 text-sm text-primary">Sem divergências críticas no consolidado.</div>}
        </div>
      </div>

      <div className="mt-5 rounded-xl border p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
          <div><h4 className="text-sm font-semibold">IA geral do projeto</h4><p className="text-xs text-muted-foreground">Analisa somente o consolidado global e compara ambientes sem misturar escopos.</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(([label, instruction]) => <button key={label} type="button" onClick={() => run(label, instruction)} disabled={!props.onAnalyze || props.isAnalyzing} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">{props.isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{label}</button>)}
        </div>
        {error ? <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
        {analysis ? <div className="prose prose-sm mt-4 max-w-none rounded-lg border bg-muted/20 p-4 text-foreground"><ReactMarkdown>{analysis}</ReactMarkdown></div> : null}
      </div>
    </section>
  );
}
