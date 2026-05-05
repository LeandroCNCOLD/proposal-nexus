import * as React from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type {
  ColdRoomSimulationResult,
  ColdRoomSimulationTimeStep,
} from "../types/coldRoomSimulation.types";

interface SimulationAIInsightPanelProps {
  result: ColdRoomSimulationResult;
  onAnalyze: (question: string) => Promise<string>;
}

/** Agrega a timeline em buckets diários para análise temporal real */
function aggregateByDay(timeline: ColdRoomSimulationTimeStep[]) {
  const byDay = new Map<
    string,
    {
      day: string;
      tMin: number;
      tMax: number;
      tAvg: number;
      tExt_min: number;
      tExt_max: number;
      tExt_avg: number;
      loadPeak: number;
      loadAvg: number;
      energyKwh: number;
      runtimePct: number;
      doorLoad: number;
      productLoad: number;
      transmissionLoad: number;
      hoursOutOfRange: number;
      frostKg: number;
      defrostHours: number;
      stepsOn: number;
      stepsTotal: number;
    }
  >();

  if (timeline.length < 2) return [];
  const stepHours =
    (new Date(timeline[1].timestamp).getTime() - new Date(timeline[0].timestamp).getTime()) /
    3_600_000;

  for (const s of timeline) {
    const day = s.timestamp.slice(0, 10);
    let b = byDay.get(day);
    if (!b) {
      b = {
        day,
        tMin: s.room_temperature_c,
        tMax: s.room_temperature_c,
        tAvg: 0,
        tExt_min: s.external_temperature_c,
        tExt_max: s.external_temperature_c,
        tExt_avg: 0,
        loadPeak: 0,
        loadAvg: 0,
        energyKwh: 0,
        runtimePct: 0,
        doorLoad: 0,
        productLoad: 0,
        transmissionLoad: 0,
        hoursOutOfRange: 0,
        frostKg: 0,
        defrostHours: 0,
        stepsOn: 0,
        stepsTotal: 0,
      };
      byDay.set(day, b);
    }
    b.stepsTotal += 1;
    b.tMin = Math.min(b.tMin, s.room_temperature_c);
    b.tMax = Math.max(b.tMax, s.room_temperature_c);
    b.tAvg += s.room_temperature_c;
    b.tExt_min = Math.min(b.tExt_min, s.external_temperature_c);
    b.tExt_max = Math.max(b.tExt_max, s.external_temperature_c);
    b.tExt_avg += s.external_temperature_c;
    b.loadPeak = Math.max(b.loadPeak, s.total_load_kcal_h);
    b.loadAvg += s.total_load_kcal_h;
    b.doorLoad += s.infiltration_load_kcal_h * stepHours;
    b.productLoad += s.product_load_kcal_h * stepHours;
    b.transmissionLoad += s.transmission_load_kcal_h * stepHours;
    if (s.compressor_status === "ON") {
      b.stepsOn += 1;
      b.energyKwh += s.equipment_power_kw * stepHours;
    }
    if (s.is_defrost_step) b.defrostHours += stepHours;
    if (s.frost_kg) b.frostKg += s.frost_kg;
  }

  const days = Array.from(byDay.values()).map((b) => ({
    ...b,
    tAvg: b.tAvg / b.stepsTotal,
    tExt_avg: b.tExt_avg / b.stepsTotal,
    loadAvg: b.loadAvg / b.stepsTotal,
    runtimePct: (b.stepsOn / b.stepsTotal) * 100,
  }));
  return days;
}

function buildPeriodNarrative(
  result: ColdRoomSimulationResult,
  setpoint: number | undefined,
  differential: number | undefined,
) {
  const days = aggregateByDay(result.timeline);
  const periodDays = result.summary.simulation_period_days;
  if (!days.length)
    return { periodDays, narrative: "Sem dados temporais suficientes para análise.", hottestDays: [], coldestDays: [], worstDays: [], driftDays: [] };

  // Dias mais quentes externamente
  const sortedHot = [...days].sort((a, b) => b.tExt_max - a.tExt_max).slice(0, 3);
  const sortedCold = [...days].sort((a, b) => a.tExt_min - b.tExt_min).slice(0, 3);

  // Dias com pior performance (maior tMax interno ou maior pico de carga)
  const setpointRef = setpoint ?? days[0].tAvg;
  const tolerance = (differential ?? 2) + 1;
  const worstDays = [...days]
    .map((d) => ({ ...d, deviation: d.tMax - setpointRef }))
    .sort((a, b) => b.deviation - a.deviation)
    .slice(0, 5);

  // Dias com tendência de "drift" (temperatura média subindo dia a dia)
  const driftDays: { day: string; tAvg: number; trend: number }[] = [];
  for (let i = 1; i < days.length; i++) {
    const trend = days[i].tAvg - days[i - 1].tAvg;
    if (trend > 0.5) driftDays.push({ day: days[i].day, tAvg: days[i].tAvg, trend });
  }

  // Estatísticas mensais (se anual)
  const isAnnual = periodDays >= 90;
  let monthlySummary = "";
  if (isAnnual) {
    const byMonth = new Map<string, { tExtAvg: number; tIntAvg: number; loadAvg: number; energy: number; n: number }>();
    for (const d of days) {
      const m = d.day.slice(0, 7);
      const cur = byMonth.get(m) ?? { tExtAvg: 0, tIntAvg: 0, loadAvg: 0, energy: 0, n: 0 };
      cur.tExtAvg += d.tExt_avg;
      cur.tIntAvg += d.tAvg;
      cur.loadAvg += d.loadAvg;
      cur.energy += d.energyKwh;
      cur.n += 1;
      byMonth.set(m, cur);
    }
    const monthlyRows = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([m, v]) =>
          `  - ${m}: T_ext_média=${(v.tExtAvg / v.n).toFixed(1)}°C, T_int_média=${(v.tIntAvg / v.n).toFixed(1)}°C, carga_média=${(v.loadAvg / v.n).toFixed(0)} kcal/h, consumo=${v.energy.toFixed(0)} kWh`,
      )
      .join("\n");
    monthlySummary = `\n### Comportamento mês a mês (${byMonth.size} meses)\n${monthlyRows}`;
  }

  const hottestDays = sortedHot.map(
    (d) =>
      `  - ${d.day}: T_ext=${d.tExt_max.toFixed(1)}°C / T_int_max=${d.tMax.toFixed(1)}°C / pico_carga=${d.loadPeak.toFixed(0)} kcal/h / runtime=${d.runtimePct.toFixed(0)}%`,
  );
  const coldestDays = sortedCold.map(
    (d) =>
      `  - ${d.day}: T_ext_min=${d.tExt_min.toFixed(1)}°C / T_int=${d.tAvg.toFixed(1)}°C / runtime=${d.runtimePct.toFixed(0)}%`,
  );
  const worstFormatted = worstDays.map(
    (d) =>
      `  - ${d.day}: T_int_max=${d.tMax.toFixed(1)}°C (Δ vs setpoint=${d.deviation.toFixed(1)}°C) — entrada de produto=${d.productLoad.toFixed(0)} kcal · portas=${d.doorLoad.toFixed(0)} kcal · transmissão=${d.transmissionLoad.toFixed(0)} kcal`,
  );

  const driftFormatted = driftDays
    .slice(0, 8)
    .map((d) => `  - ${d.day}: subiu ${d.trend.toFixed(2)}°C vs dia anterior (T_média=${d.tAvg.toFixed(1)}°C)`);

  // Verificar se há tendência sustentada (acúmulo)
  const firstWeek = days.slice(0, Math.min(7, days.length));
  const lastWeek = days.slice(-Math.min(7, days.length));
  const drift =
    lastWeek.reduce((s, d) => s + d.tAvg, 0) / lastWeek.length -
    firstWeek.reduce((s, d) => s + d.tAvg, 0) / firstWeek.length;

  const narrative = `
### Visão geral do período (${periodDays} dias / ${days.length} dias com dados)
- Drift de temperatura entre primeira e última semana: ${drift.toFixed(2)}°C ${drift > 0.5 ? "⚠️ acúmulo térmico ao longo do tempo" : drift < -0.5 ? "⚠️ super-resfriamento progressivo" : "✓ estável"}
- Dias com tendência crescente (>0.5°C vs dia anterior): ${driftDays.length}

### 3 dias mais quentes (estresse máximo do equipamento)
${hottestDays.join("\n")}

### 3 dias mais frios (oportunidade de economia)
${coldestDays.join("\n")}

### 5 piores dias por desvio de temperatura interna
${worstFormatted.join("\n")}

### Dias com tendência crescente significativa (acúmulo dia-a-dia)
${driftFormatted.length ? driftFormatted.join("\n") : "  (nenhum)"}
${monthlySummary}
`;

  return { periodDays, narrative, hottestDays, coldestDays, worstDays, driftDays };
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
      // Tenta inferir setpoint/differential a partir da timeline (média da janela de OFF)
      const offSteps = result.timeline.filter((s) => s.compressor_status === "OFF");
      const inferredSetpoint = offSteps.length
        ? offSteps.reduce((s, x) => s + x.room_temperature_c, 0) / offSteps.length
        : undefined;

      const period = buildPeriodNarrative(result, inferredSetpoint, undefined);

      // Clamp dias críticos ao período simulado (não permite 31 dias críticos em 30 dias)
      const simDays = Math.max(1, Math.round(summary.simulation_period_days));
      const daysDeficit = Math.min(summary.days_with_thermal_deficit ?? 0, simDays);
      const daysTargetMissed = Math.min(summary.days_product_target_not_reached ?? 0, simDays);

      const isShort = period.periodDays <= 2;
      const isWeek = period.periodDays > 2 && period.periodDays <= 14;
      const isMonth = period.periodDays > 14 && period.periodDays <= 60;
      const isAnnual = period.periodDays > 60;

      const horizonGuidance = isShort
        ? "O período simulado é CURTO (1–2 dias). Foque em eventos pontuais: pico de carga em horário de pico, abertura de portas, entrada de produto e tempo de pulldown. NÃO extrapole para acúmulo anual."
        : isWeek
          ? "O período é SEMANAL. Avalie consistência dia-a-dia e se há tendência de acúmulo entre os dias (drift). Comente o ciclo operacional típico."
          : isMonth
            ? "O período é MENSAL. Analise variação semanal, dias críticos do mês e se o equipamento sustenta a operação em sequências consecutivas de carga alta."
            : "O período é ANUAL. Você DEVE analisar o comportamento mês a mês (verão vs inverno), identificar meses críticos, validar se o equipamento dá conta de todo o ciclo anual de carga e produto, e estimar consumo energético sazonal.";

      const question = `Você é um engenheiro especialista em refrigeração industrial fazendo a **Análise de Comportamento Térmico-Operacional** do módulo **Simulação Dinâmica de Comportamento da Câmara**, que rodou por **${period.periodDays} dias** com passo de tempo curto, considerando: clima horário real, entrada/saída diária de produto, ciclos de abertura de porta, ciclos de degelo e curva polinomial real do equipamento. Refira-se ao módulo SEMPRE como "Simulação Dinâmica de Comportamento da Câmara" — nunca como "cálculo de carga", "simulação de carga" ou "carga térmica estática".

## Contexto temporal
${horizonGuidance}

## Resumo consolidado do período inteiro
- Período: ${summary.simulation_period_days} dias (${summary.simulation_steps_total} passos de simulação)
- Temp. interna: média ${summary.average_room_temperature_c.toFixed(1)}°C / mín ${summary.min_room_temperature_c.toFixed(1)}°C / máx ${summary.max_room_temperature_c.toFixed(1)}°C
- Horas fora da faixa: ${summary.temperature_out_of_range_hours.toFixed(1)} h
- Pico de carga: ${summary.peak_load_kcal_h.toFixed(0)} kcal/h em ${summary.peak_load_timestamp} (T_ext no pico: ${summary.peak_external_temp_c.toFixed(1)}°C)
- Carga total acumulada: ${summary.total_cooling_load_kcal.toFixed(0)} kcal · Capacidade entregue: ${summary.total_cooling_capacity_kcal.toFixed(0)} kcal
- Consumo elétrico do período: ${summary.total_energy_kwh.toFixed(1)} kWh · COP médio: ${summary.average_cop.toFixed(2)}
- Compressor ligado: ${summary.compressor_runtime_hours.toFixed(1)} h (${summary.compressor_runtime_pct.toFixed(1)}% do período)
- Utilização máx do equipamento: ${summary.max_equipment_utilization_pct.toFixed(1)}%
- Capacidade adequada para o período? ${summary.capacity_adequate ? "Sim" : "NÃO"} (mín. recomendado: ${summary.recommended_min_capacity_kcal_h.toFixed(0)} kcal/h)

### Portas (acumulado do período)
- Total de aberturas: ${summary.total_door_openings}
- Carga total por portas: ${summary.total_door_infiltration_load_kcal.toFixed(0)} kcal (${summary.door_infiltration_pct_of_total.toFixed(1)}% da carga total do período)

### Gelo / Degelo
- Risco de gelo: ${summary.ice_risk_level} · Acúmulo total: ${summary.total_frost_kg.toFixed(1)} kg (${summary.frost_kg_per_day.toFixed(2)} kg/dia)
- Carga latente: ${summary.latent_load_pct.toFixed(1)}% · Downtime de degelo: ${summary.defrost_downtime_hours_per_day.toFixed(2)} h/dia (${summary.machine_downtime_hours_total.toFixed(1)} h no período)
- Ciclos de degelo configurados: ${summary.defrost_cycles_per_day}/dia · Recomendado: ${summary.recommended_defrost_cycles}/dia

### Estado térmico acumulativo (movimentação de produto)
- Produto total que entrou no período: ${summary.total_product_inlet_kg.toLocaleString("pt-BR")} kg
- Estoque final na câmara: ${summary.final_stored_mass_kg.toLocaleString("pt-BR")} kg @ ${summary.final_average_product_temperature_c.toFixed(1)}°C
- Tempo médio de pulldown (entrada → atingir target): ${summary.average_pulldown_hours.toFixed(1)} h
- Dias com déficit térmico (carga > capacidade): ${summary.days_with_thermal_deficit}
- Dias em que o produto NÃO atingiu o target: ${summary.days_product_target_not_reached}
- Déficit térmico acumulado total: ${summary.total_thermal_deficit_kcal.toLocaleString("pt-BR")} kcal

## Recortes temporais relevantes (use estes dados para fundamentar a análise)
${period.narrative}

## O que você DEVE fazer
Responda em **Português** e em **Markdown**, raciocinando sobre o comportamento do sistema **ao longo de TODO o período simulado** — não apenas em valores médios. Sua análise precisa ser sensível ao horizonte:

1. **Comportamento ao longo do período (${period.periodDays} dias)** — Como o sistema evoluiu? Há acúmulo térmico (a câmara não recupera entre dias)? Em quais dias/meses específicos isso aconteceu? Cite as datas dos recortes acima.
2. **Resposta a eventos diários** — Como o equipamento respondeu à entrada diária de produto? O pulldown acontece dentro do dia (a câmara baixa antes do próximo lote chegar)? Há acúmulo de carga por produtos sucessivos?
3. **Impacto da variação climática externa** — ${isAnnual ? "Compare verão vs inverno mês a mês. O equipamento atende a demanda nos meses críticos?" : "Como a oscilação dia/noite e dia-a-dia afeta a operação?"} Use os dias mais quentes e mais frios listados.
4. **Portas e degelo no contexto do período** — A frequência atual de aberturas é sustentável? O ciclo de degelo é suficiente para o acúmulo de gelo previsto no período?
5. **Veredito de seleção** — Considerando o período inteiro (${period.periodDays} dias), o equipamento está dimensionado adequadamente, ou há risco de não atender em condições extremas? Recomende ajustes específicos (capacidade, número de aberturas/dia, ciclos de degelo, setpoint).

⚠️ Regras críticas:
- Diferencie claramente "comportamento típico" vs "comportamento em dias críticos".
- Se o período é ${period.periodDays} dias, NUNCA fale como se fosse outro horizonte.
- Use números e datas concretas dos recortes acima — não generalize.
- Se houver drift (temperatura subindo dia a dia), trate como sinal de subdimensionamento mesmo que a média esteja boa.`;

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
          <h3 className="font-semibold">Análise de Comportamento Térmico-Operacional</h3>
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
          <span className="text-sm font-medium">
            A IA está analisando o comportamento térmico ao longo do período…
          </span>
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
