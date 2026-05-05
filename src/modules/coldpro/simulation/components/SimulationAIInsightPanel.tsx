import * as React from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ColdRoomSimulationResult } from "../types/coldRoomSimulation.types";

interface SimulationAIInsightPanelProps {
  result: ColdRoomSimulationResult;
  onAnalyze: (question: string) => Promise<string>;
}

function buildSimulationAIPrompt(result: ColdRoomSimulationResult): string {
  const s = result.summary;

  // Formatadores
  const fmt = (v: number | null | undefined, dec = 1) =>
    v != null && !isNaN(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "N/D";
  const fmtInt = (v: number | null | undefined) =>
    v != null && !isNaN(v) ? Math.round(v).toLocaleString("pt-BR") : "N/D";

  // Classificação de capacidade em português
  const assessmentLabel: Record<string, string> = {
    NOMINALLY_ADEQUATE: "Nominalmente adequado",
    ADEQUATE_WITH_OPERATIONAL_RISK: "Adequado com risco operacional",
    UNDER_STRESS: "Sob estresse",
    INSUFFICIENT: "Insuficiente",
  };
  const assessment = assessmentLabel[(s as any).capacity_assessment ?? ""] ?? "Não classificado";

  // Alertas ativos
  const alertLines = result.alerts
    .slice(0, 10)
    .map((a) => `  - [${a.severity.toUpperCase()}] ${a.code}: ${a.message}`)
    .join("\n");

  // Inconsistências detectadas
  const inconsistencies: string[] = [];
  if ((s as any).deficit_inconsistency_warning) inconsistencies.push((s as any).deficit_inconsistency_warning);
  if ((s as any).percent_sum_warning) inconsistencies.push((s as any).percent_sum_warning);
  const inconsistencyLines = inconsistencies.length > 0
    ? inconsistencies.map((i) => `  - ${i}`).join("\n")
    : "  - Nenhuma inconsistência detectada automaticamente.";

  return `Você é um engenheiro especialista em refrigeração industrial e deve analisar o resultado da simulação dinâmica de uma câmara fria. Sua análise deve ser tecnicamente precisa, coerente e não contraditória.

## REGRAS OBRIGATÓRIAS DE TEXTO
- NÃO diga que o equipamento é insuficiente se: capacidade instalada >= recomendada E horas fora do range = 0.
- NÃO use a sobra estática (vs carga estática do memorial) para afirmar superdimensionamento contra a carga dinâmica média.
- NÃO apresente percentuais de composição de carga que não somem aproximadamente 100%.
- NÃO diga que a carga de produto é zero se o campo "Carga de produto (estático)" for maior que zero.
- NÃO use o déficit acumulado como prova final de falha sem cruzar com temperatura, runtime e capacidade instalada.
- SEMPRE separe: carga estática do memorial, carga média dinâmica e pico de carga.
- SEMPRE use a classificação de capacidade fornecida: ${assessment}.

## DADOS DA SIMULAÇÃO

### Período e configuração
- Período simulado: ${s.simulation_period_days} dias
- Passos totais: ${fmtInt(s.simulation_steps_total)}

### Temperatura interna
- Média: ${fmt(s.average_room_temperature_c)}°C
- Máxima: ${fmt(s.max_room_temperature_c)}°C
- Mínima: ${fmt(s.min_room_temperature_c)}°C
- Horas fora do range: ${fmt(s.temperature_out_of_range_hours)} h

### Cargas térmicas
- Pico de carga: ${fmtInt(s.peak_load_kcal_h)} kcal/h (${s.worst_hour})
- Carga média dinâmica: ${fmtInt((s as any).average_dynamic_load_kcal_h)} kcal/h
- Carga total no período: ${fmtInt(s.total_cooling_load_kcal)} kcal
- Carga de produto (estático, do memorial): ${fmtInt((s as any).static_product_load_kcal_h ?? 0)} kcal/h
- Composição (base: carga total dinâmica):
  - Transmissão: ${fmt((s as any).transmission_pct)}%
  - Infiltração: ${fmt((s as any).infiltration_pct)}%
  - Produto/processo: ${fmt((s as any).product_pct)}%
  - Cargas internas: ${fmt((s as any).internal_pct)}%

### Capacidade e diagnóstico
- Capacidade instalada: ${fmtInt((s as any).installed_capacity_kcal_h)} kcal/h
- Capacidade dinâmica recomendada (pico + 10%): ${fmtInt(s.recommended_min_capacity_kcal_h)} kcal/h
- Classificação de capacidade: **${assessment}**
- Sobra vs carga estática do memorial: ${(s as any).static_surplus_pct != null ? fmt((s as any).static_surplus_pct) + "%" : "N/D (carga estática não informada)"}
- Sobra vs carga média dinâmica: ${(s as any).dynamic_avg_surplus_pct != null ? fmt((s as any).dynamic_avg_surplus_pct) + "%" : "N/D"}
- Sobra vs capacidade dinâmica recomendada: ${(s as any).dynamic_recommended_surplus_pct != null ? fmt((s as any).dynamic_recommended_surplus_pct) + "%" : "N/D"}
- Cobertura de capacidade no período: ${fmt((s as any).capacity_coverage_pct)}%

### Compressor e energia
- Runtime do compressor: ${fmt(s.compressor_runtime_pct)}% (${fmt(s.compressor_runtime_hours)} h)
- Consumo total: ${fmtInt(s.total_energy_kwh)} kWh
- COP médio: ${fmt(s.average_cop)}

### Déficit acumulado
- Déficit acumulado real: ${fmtInt((s as any).accumulated_deficit_kcal)} kcal
- Dias com pico acima da capacidade instalada: ${(s as any).critical_days_count ?? 0} de ${s.simulation_period_days}

### Portas e infiltração
- Total de aberturas: ${fmtInt(s.total_door_openings)}
- Infiltração por portas: ${fmt(s.door_infiltration_pct_of_total)}% da carga total

### Gelo e degelo
- Risco de gelo: ${s.ice_risk_level?.toUpperCase() ?? "N/A"}
- Gelo estimado: ${fmt(s.frost_kg_per_day)} kg/dia
- Máquina parada para degelo: ${fmt(s.defrost_downtime_hours_per_day)} h/dia

### Inconsistências detectadas automaticamente
${inconsistencyLines}

### Alertas ativos
${alertLines || "  - Nenhum alerta ativo."}

---

## ESTRUTURA OBRIGATÓRIA DA RESPOSTA (em Markdown)

Responda EXATAMENTE nestas 11 seções:

### 1. Validação de Consistência dos Dados
Verifique se os dados são coerentes entre si. Aponte qualquer inconsistência detectada (ex: déficit sem reflexo em temperatura, percentuais que não fecham, produto zerado com carga estática > 0).

### 2. Conclusão Executiva
Uma conclusão clara, não contraditória, baseada na classificação de capacidade fornecida. Máximo 3 frases.

### 3. Comparativo: Carga Estática vs Simulação Dinâmica
Compare a carga do memorial estático com o comportamento dinâmico. Explique as diferenças.

### 4. Indicadores Principais
Tabela com os 5-8 KPIs mais relevantes e sua interpretação.

### 5. Composição das Cargas
Analise a distribuição percentual. Se houver inconsistência nos percentuais, informe claramente.

### 6. Análise de Portas e Infiltração
Avalie o impacto das aberturas de porta na carga total. Recomende ações se > 30%.

### 7. Análise de Produto/Processo
Avalie se a carga de produto foi corretamente herdada do memorial. Se produto dinâmico = 0 mas estático > 0, explique o que isso significa.

### 8. Análise de Capacidade do Equipamento
Use a classificação de 4 níveis fornecida. Separe sobra estática, sobra vs média dinâmica e sobra vs recomendação dinâmica.

### 9. Análise de Temperatura e Recuperação
Avalie o controle térmico: oscilação, horas fora do range, velocidade de recuperação.

### 10. Alertas de Inconsistência
Liste todos os alertas ativos e as inconsistências detectadas automaticamente.

### 11. Recomendações Técnicas
Liste de 3 a 5 ações concretas e priorizadas para o projetista.`;
}

export function SimulationAIInsightPanel({ result, onAnalyze }: SimulationAIInsightPanelProps) {
  const [analysis, setAnalysis] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const question = buildSimulationAIPrompt(result);
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
