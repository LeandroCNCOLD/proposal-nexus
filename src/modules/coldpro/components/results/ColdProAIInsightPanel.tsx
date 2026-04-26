import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, Sparkles } from "lucide-react";
import type { ColdProNormalizedResult } from "../../core/resultNormalizer";
import { buildColdProAIContext } from "../../core/aiTechnicalContextBuilder";

const ACTIONS = [
  ["Auditar dimensionamento", "Audite o dimensionamento, fechamento matemático, divergências críticas e severidade dos achados."],
  ["Explicar maiores cargas", "Explique os maiores componentes de carga e o impacto técnico/comercial deles."],
  ["Validar seleção de equipamento", "Valide a seleção de equipamento, capacidade, sobra técnica, COP, potência e vazão."],
  ["Analisar túnel", "Analise o túnel/processo, tempo disponível, tempo estimado, vazão, velocidade e coeficientes h."],
  ["Analisar gelo e degelo", "Analise gelo, umidade, perda de rendimento, carga adicional e degelo preventivo."],
  ["Gerar recomendações comerciais", "Gere recomendações comerciais objetivas com riscos, oportunidades e linguagem para proposta."],
  ["Gerar laudo técnico completo", "Gere laudo técnico completo com conclusão executiva, principais cargas, túnel, equipamento e recomendações práticas."],
] as const;

type Props = {
  normalized: ColdProNormalizedResult;
  onAnalyze?: (question: string, previousAnalysis?: string | null) => Promise<string | null>;
  isAnalyzing?: boolean;
};

export function ColdProAIInsightPanel({ normalized, onAnalyze, isAnalyzing }: Props) {
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(label: string, instruction: string) {
    if (!onAnalyze) return;
    setError(null);
    const isFinal = label.includes("laudo");
    if (isFinal && normalized.consistencyAudit.hasCriticalDivergence) {
      setError("Há divergências críticas. Revise antes de emitir laudo final.");
      return;
    }
    const context = buildColdProAIContext(normalized);
    const response = await onAnalyze(JSON.stringify({ action: label, instruction, technicalContext: context }, null, 2), analysis);
    if (response) setAnalysis(response);
    else setError("A IA não retornou análise para este contexto.");
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
        <div>
          <h4 className="text-sm font-semibold">IA técnica orientada por dados</h4>
          <p className="text-xs text-muted-foreground">A análise recebe o resultado normalizado e a auditoria, incluindo a regra produto + túnel/processo.</p>
        </div>
      </div>
      {normalized.consistencyAudit.hasCriticalDivergence ? <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Há divergências críticas. Revise antes de emitir laudo final.</div> : null}
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map(([label, instruction]) => (
          <button key={label} type="button" onClick={() => run(label, instruction)} disabled={!onAnalyze || isAnalyzing} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {label}
          </button>
        ))}
      </div>
      {error ? <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
      {analysis ? <div className="prose prose-sm mt-4 max-w-none rounded-lg border bg-muted/20 p-4 text-foreground"><ReactMarkdown>{analysis}</ReactMarkdown></div> : null}
    </div>
  );
}
