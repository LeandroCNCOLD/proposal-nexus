import * as React from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ColdRoomSimulationResult } from "../types/coldRoomSimulation.types";

interface SimulationAIInsightPanelProps {
  result: ColdRoomSimulationResult;
  onAnalyze: (question: string) => Promise<string>;
}

export function SimulationAIInsightPanel({ result, onAnalyze }: SimulationAIInsightPanelProps) {
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const summary = result.summary;
      const question = `Analise o resultado da simulação dinâmica desta câmara fria e dê recomendações práticas.
      
Dados principais:
- Temp. Média Interna: ${summary.average_room_temperature_c.toFixed(1)}°C
- Pico de Carga: ${summary.peak_load_kcal_h.toFixed(0)} kcal/h
- Tempo Compressor Ligado: ${summary.compressor_runtime_pct.toFixed(1)}% (${summary.compressor_runtime_hours.toFixed(1)}h)
- Capacidade Adequada: ${summary.capacity_adequate ? 'Sim' : 'Não'} (Min. Recomendado: ${summary.recommended_min_capacity_kcal_h.toFixed(0)} kcal/h)
- Aberturas de Porta: ${summary.total_door_openings} (${summary.door_infiltration_pct_of_total.toFixed(1)}% da carga)
- Risco de Gelo: ${summary.ice_risk_level} (${summary.frost_kg_per_day.toFixed(1)} kg/dia)
- Tempo Parado (Degelo): ${summary.defrost_downtime_hours_per_day.toFixed(1)} h/dia

Por favor, responda em formato Markdown com os seguintes tópicos:
1. **Comportamento do Equipamento**: O equipamento está superdimensionado, subdimensionado ou adequado? Como ele lidou com os picos de carga?
2. **Impacto das Portas e Degelo**: A operação das portas está prejudicando a temperatura? O ciclo de degelo é suficiente?
3. **Recomendações de Seleção**: O que o projetista deve alterar (capacidade, portas, setpoint) para otimizar o projeto?`;

      const response = await onAnalyze(question);
      setAnalysis(response);
    } catch (err: any) {
      setError(err.message || "Falha ao gerar análise da simulação.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
          <Sparkles className="h-5 w-5" />
          <h3 className="font-semibold">Análise Inteligente da Simulação</h3>
        </div>
        {!analysis && !isAnalyzing && (
          <button
            onClick={handleAnalyze}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Gerar Análise
          </button>
        )}
      </div>

      {isAnalyzing && (
        <div className="flex items-center justify-center py-8 text-indigo-600 dark:text-indigo-400">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">A IA está analisando o comportamento térmico...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {analysis && !isAnalyzing && (
        <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none">
          <ReactMarkdown>{analysis}</ReactMarkdown>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-1.5 rounded-md border border-indigo-200 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refazer Análise
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
