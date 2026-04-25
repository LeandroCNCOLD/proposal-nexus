import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Download, Send, FileText, Loader2, MessageSquare } from "lucide-react";

function fmt(value: unknown, digits = 2) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(value ?? 0));
}

function loadRows(result: any): Array<[string, number]> {
  const rows: Array<[string, number]> = [
    ["Transmissão", Number(result?.transmission_kcal_h ?? 0)],
    ["Produto", Number(result?.product_kcal_h ?? 0)],
    ["Embalagem", Number(result?.packaging_kcal_h ?? 0)],
    ["Infiltração", Number(result?.infiltration_kcal_h ?? 0)],
    ["Pessoas", Number(result?.people_kcal_h ?? 0)],
    ["Iluminação", Number(result?.lighting_kcal_h ?? 0)],
    ["Motores", Number(result?.motors_kcal_h ?? 0)],
    ["Ventiladores", Number(result?.fans_kcal_h ?? 0)],
    ["Degelo", Number(result?.defrost_kcal_h ?? 0)],
    ["Outros", Number(result?.other_kcal_h ?? 0) + Number(result?.tunnel_internal_load_kcal_h ?? 0)],
  ];
  return rows.filter(([, value]) => value > 0);
}

function LoadChart({ result }: { result: any }) {
  const rows = loadRows(result);
  const max = Math.max(1, ...rows.map(([, value]) => value));
  if (!rows.length) return null;
  return <div className="rounded-lg border bg-muted/20 p-3"><div className="mb-3 text-sm font-semibold">Gráfico de cargas por componente</div><div className="space-y-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)_92px] items-center gap-2 text-xs"><div className="truncate text-muted-foreground">{label}</div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} /></div><div className="text-right font-medium">{fmt(value, 0)} kcal/h</div></div>)}</div></div>;
}

function TemperatureStrip({ env }: { env: any }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><div className="mb-2 text-sm font-semibold">Temperaturas de projeto</div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-md bg-background p-2"><div className="text-xs text-muted-foreground">Interna</div><div className="text-lg font-bold">{fmt(env.internal_temp_c)} °C</div></div><div className="rounded-md bg-background p-2"><div className="text-xs text-muted-foreground">Externa</div><div className="text-lg font-bold">{fmt(env.external_temp_c)} °C</div></div></div></div>;
}

type Props = {
  project: any;
  environments: any[];
  results: any[];
  selections: any[];
  products: any[];
  advancedProcesses?: any[];
  onPushToProposal?: () => void;
  isPushing?: boolean;
  onGeneratePdf?: (aiAnalysis?: string | null) => void;
  onAnalyze?: (question: string, previousAnalysis?: string | null) => Promise<string | null>;
  isGeneratingPdf?: boolean;
  isAnalyzing?: boolean;
  lastPdfUrl?: string | null;
};

export function ColdProReport({
  project,
  environments,
  results,
  selections,
  products,
  advancedProcesses = [],
  onPushToProposal,
  isPushing,
  onGeneratePdf,
  onAnalyze,
  isGeneratingPdf,
  isAnalyzing,
  lastPdfUrl,
}: Props) {
  const handlePrint = () => window.print();
  const [aiQuestion, setAiQuestion] = React.useState("");
  const [aiAnalysis, setAiAnalysis] = React.useState<string | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);

  async function runAiAnalysis(question = aiQuestion) {
    if (!onAnalyze) return;
    setAiError(null);
    const analysis = await onAnalyze(question, aiAnalysis);
    if (analysis) setAiAnalysis(analysis);
    else setAiError("A IA não respondeu dentro do tempo seguro. Tente uma pergunta mais objetiva ou gere o PDF sem o laudo de IA.");
  }

  const totals = environments.reduce(
    (acc, env) => {
      const r = results.find((x: any) => x.environment_id === env.id);
      acc.kcal += Number(r?.total_required_kcal_h ?? 0);
      acc.kw += Number(r?.total_required_kw ?? 0);
      acc.tr += Number(r?.total_required_tr ?? 0);
      return acc;
    },
    { kcal: 0, kw: 0, tr: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg font-semibold">Relatório técnico</h2>
          <p className="text-sm text-muted-foreground">
            Memorial de cálculo consolidado dos ambientes do projeto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onGeneratePdf ? (
            <button
              type="button"
              onClick={() => onGeneratePdf(aiAnalysis)}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {isGeneratingPdf ? "Gerando PDF completo..." : "Gerar memorial PDF completo"}
            </button>
          ) : null}
          {lastPdfUrl ? (
            <a
              href={lastPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Baixar último PDF completo
            </a>
          ) : (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Imprimir versão completa
            </button>
          )}
          {onPushToProposal ? (
            <button
              type="button"
              onClick={onPushToProposal}
              disabled={isPushing || !project?.proposal_id}
              title={!project?.proposal_id ? "Vincule este projeto a uma proposta primeiro" : undefined}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {isPushing ? "Enviando..." : "Enviar para proposta"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-background p-4 shadow-sm print:hidden">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
          <div>
            <h3 className="text-base font-semibold">Agente técnico avançado de IA</h3>
            <p className="text-sm text-muted-foreground">Peça validações sobre carga térmica, infiltração, umidade, gelo, degelo e seleção; depois gere o PDF usando esta análise como laudo final.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <textarea value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="Ex.: avalie se a sobra técnica está adequada, explique os pontos críticos de temperatura e recomende ajustes." className="min-h-20 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30" />
          <div className="flex min-w-52 flex-col gap-2">
            <button type="button" onClick={() => runAiAnalysis()} disabled={!onAnalyze || isAnalyzing} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              {isAnalyzing ? "Analisando..." : "Perguntar à IA"}
            </button>
            <button type="button" onClick={() => runAiAnalysis("Gerar laudo técnico objetivo para o memorial PDF. Inclua: conclusão executiva, premissas críticas, infiltração/umidade/gelo, degelo, comparação carga requerida x ofertada, riscos e recomendação final. Limite a resposta em até 900 palavras.")} disabled={!onAnalyze || isAnalyzing} className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Gerar laudo completo</button>
          </div>
        </div>
        {aiError ? <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{aiError}</div> : null}
        {aiAnalysis ? <div className="prose prose-sm mt-4 max-w-none rounded-lg border bg-muted/20 p-4 text-foreground"><ReactMarkdown>{aiAnalysis}</ReactMarkdown></div> : null}
        {aiAnalysis && onGeneratePdf ? <div className="mt-3 text-xs text-muted-foreground">O próximo PDF completo usará esta análise como laudo final.</div> : null}
      </div>

      <div id="coldpro-report-print" className="min-w-0 space-y-6 rounded-2xl border bg-background p-3 sm:p-6 print:border-0 print:p-0">
        <header className="border-b pb-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">CN ColdPro · Memorial de cálculo</div>
          <h1 className="mt-1 text-2xl font-bold">{project?.name ?? "Projeto"}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            Aplicação: {project?.application_type} · Revisão {project?.revision} · Status {project?.status}
          </div>
        </header>

        <section>
          <h2 className="mb-3 text-base font-semibold">Resumo do projeto</h2>
           <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Carga total</div>
              <div className="text-xl font-bold">{fmt(totals.kcal)} kcal/h</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Potência total</div>
              <div className="text-xl font-bold">{fmt(totals.kw)} kW</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">Toneladas refrigeração</div>
              <div className="text-xl font-bold">{fmt(totals.tr)} TR</div>
            </div>
          </div>
        </section>

        {environments.map((env: any, idx: number) => {
          const result = results.find((r: any) => r.environment_id === env.id);
          const selection = selections.find((s: any) => s.environment_id === env.id);
          const envProducts = products.filter((p: any) => p.environment_id === env.id);
          const envAdvancedProcesses = advancedProcesses.filter((p: any) => p.environment_id === env.id);
          return (
            <section key={env.id} className="space-y-3 border-t pt-4">
              <h2 className="text-base font-semibold">
                {idx + 1}. {env.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">({env.environment_type})</span>
              </h2>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                <div>Dimensões: <b>{fmt(env.length_m)} × {fmt(env.width_m)} × {fmt(env.height_m)} m</b></div>
                <div>Volume: <b>{fmt(env.volume_m3)} m³</b></div>
                <div>Temp. interna: <b>{fmt(env.internal_temp_c)} °C</b></div>
                <div>Temp. externa: <b>{fmt(env.external_temp_c)} °C</b></div>
                <div>Painel parede: <b>{fmt(env.wall_thickness_mm)} mm</b></div>
                <div>Compressor: <b>{fmt(env.compressor_runtime_hours_day)} h/dia</b></div>
              </div>

              {envProducts.length > 0 ? (
                <div>
                  <div className="mb-1 text-sm font-semibold">Produtos</div>
                  <div className="max-w-full overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="border px-2 py-1 text-left">Produto</th>
                        <th className="border px-2 py-1 text-right">kg/dia</th>
                        <th className="border px-2 py-1 text-right">Entrada °C</th>
                        <th className="border px-2 py-1 text-right">Final °C</th>
                        <th className="border px-2 py-1 text-right">Tempo (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envProducts.map((p: any) => (
                        <tr key={p.id}>
                          <td className="border px-2 py-1">{p.product_name}</td>
                          <td className="border px-2 py-1 text-right">{fmt(p.mass_kg_day)}</td>
                          <td className="border px-2 py-1 text-right">{fmt(p.inlet_temp_c)}</td>
                          <td className="border px-2 py-1 text-right">{fmt(p.outlet_temp_c)}</td>
                          <td className="border px-2 py-1 text-right">{fmt(p.process_time_h)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : null}

              {result ? (
                <div>
                  <div className="mb-1 text-sm font-semibold">Decomposição da carga térmica</div>
                  <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <LoadChart result={result} />
                    <TemperatureStrip env={env} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                    <div>Transmissão: <b>{fmt(result.transmission_kcal_h)} kcal/h</b></div>
                    <div>Produto: <b>{fmt(result.product_kcal_h)} kcal/h</b></div>
                    <div>Embalagem: <b>{fmt(result.packaging_kcal_h)} kcal/h</b></div>
                    <div>Infiltração: <b>{fmt(result.infiltration_kcal_h)} kcal/h</b></div>
                    <div>Pessoas: <b>{fmt(result.people_kcal_h)} kcal/h</b></div>
                    <div>Iluminação: <b>{fmt(result.lighting_kcal_h)} kcal/h</b></div>
                    <div>Motores: <b>{fmt(result.motors_kcal_h)} kcal/h</b></div>
                    <div>Ventiladores: <b>{fmt(result.fans_kcal_h)} kcal/h</b></div>
                    <div>Degelo: <b>{fmt(result.defrost_kcal_h)} kcal/h</b></div>
                    <div>Outros: <b>{fmt(result.other_kcal_h)} kcal/h</b></div>
                    <div>Subtotal: <b>{fmt(result.subtotal_kcal_h)} kcal/h</b></div>
                    <div>Segurança ({fmt(result.safety_factor_percent)}%): <b>{fmt(result.safety_kcal_h)} kcal/h</b></div>
                  </div>
                  <div className="mt-2 rounded-md bg-primary/5 p-3 text-sm">
                    <b>Total requerido:</b> {fmt(result.total_required_kcal_h)} kcal/h ·{" "}
                    {fmt(result.total_required_kw)} kW · {fmt(result.total_required_tr)} TR
                  </div>
                  {result.calculation_breakdown?.infiltration_technical ? (
                    <div className="mt-3 grid gap-2 rounded-md border bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                      {(() => { const inf: any = result.calculation_breakdown.infiltration_technical; const deg: any = result.calculation_breakdown.defrost_suggestion; return <>
                        <div><b>Infiltração sensível:</b><br />{fmt(inf.sensibleKcalH)} kcal/h</div>
                        <div><b>Infiltração latente:</b><br />{fmt(inf.latentKcalH)} kcal/h</div>
                        <div><b>Gelo formado:</b><br />{fmt(inf.iceKgDay)} kg/dia</div>
                        <div><b>Degelo sugerido:</b><br />{fmt(deg?.defrostKcalH)} kcal/h</div>
                      </>; })()}
                    </div>
                  ) : null}
                  {Array.isArray(result.calculation_breakdown?.transmission_faces) && result.calculation_breakdown.transmission_faces.length ? (
                    <div className="mt-3">
                      <div className="mb-1 text-sm font-semibold">Transmissão por face</div>
                      <div className="mb-2 text-xs text-muted-foreground">
                        Total transmissão: <b>{fmt(result.calculation_breakdown?.transmission_summary?.total_w)} W</b> · <b>{fmt(result.calculation_breakdown?.transmission_summary?.total_kw)} kW</b> · <b>{fmt(result.calculation_breakdown?.transmission_summary?.total_kcal_h)} kcal/h</b> · <b>{fmt(result.calculation_breakdown?.transmission_summary?.total_tr)} TR</b>
                      </div>
                      <div className="max-w-full overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse text-xs">
                        <thead className="bg-muted/40">
                          <tr><th className="border px-2 py-1 text-left">Face</th><th className="border px-2 py-1 text-right">Área opaca m²</th><th className="border px-2 py-1 text-right">Vidro m²</th><th className="border px-2 py-1 text-right">ΔT</th><th className="border px-2 py-1 text-right">Painel W</th><th className="border px-2 py-1 text-right">Vidro W</th><th className="border px-2 py-1 text-right">Solar W</th><th className="border px-2 py-1 text-right">Total W</th><th className="border px-2 py-1 text-right">kcal/h</th></tr>
                        </thead>
                        <tbody>
                          {result.calculation_breakdown.transmission_faces.map((face: any) => (
                            <tr key={face.local}><td className="border px-2 py-1">{face.local}</td><td className="border px-2 py-1 text-right">{fmt(face.insulated_area_m2 ?? face.area_m2)}</td><td className="border px-2 py-1 text-right">{fmt(face.glass_area_m2)}</td><td className="border px-2 py-1 text-right">{fmt(face.delta_t_c)}</td><td className="border px-2 py-1 text-right">{fmt(face.panel_transmission_w)}</td><td className="border px-2 py-1 text-right">{fmt(face.glass_transmission_w)}</td><td className="border px-2 py-1 text-right">{fmt(face.glass_solar_w)}</td><td className="border px-2 py-1 text-right">{fmt(face.transmission_w)}</td><td className="border px-2 py-1 text-right">{fmt(face.transmission_kcal_h)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Cálculo não realizado.</div>
              )}

              {envAdvancedProcesses.length ? (
                <div>
                  <div className="mb-1 text-sm font-semibold">Processos Especiais</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                    {envAdvancedProcesses.map((item: any) => (
                      <React.Fragment key={item.id}>
                        <div>Tipo: <b>{item.advanced_process_type}</b></div>
                        <div>Carga adicional: <b>{fmt(item.calculation_result?.total_additional_kcal_h)} kcal/h</b></div>
                        <div>Status: <b>{item.calculation_result?.status ?? "—"}</b></div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : null}

              {selection ? (
                <div>
                  <div className="mb-1 text-sm font-semibold">Equipamento selecionado</div>
                  <div className="grid gap-4 rounded-lg border bg-muted/20 p-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border bg-background">
                      {selection.equipment_image_url ? <img src={selection.equipment_image_url} alt={`Equipamento selecionado ${selection.model}`} className="h-full w-full object-contain" /> : <span className="px-4 text-center text-xs text-muted-foreground">Foto do equipamento não cadastrada</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                      <div>Modelo: <b>{selection.model}</b></div>
                      <div>Quantidade: <b>{fmt(selection.quantity)}</b></div>
                      <div>Capacidade total: <b>{fmt(selection.capacity_total_kcal_h)} kcal/h</b></div>
                      <div>Vazão de ar: <b>{fmt(selection.air_flow_total_m3_h)} m³/h</b></div>
                      <div>Trocas/h: <b>{fmt(selection.air_changes_hour)}</b></div>
                      <div>Sobra técnica: <b>{fmt(selection.surplus_percent)}%</b></div>
                      <div>Potência estimada: <b>{selection.total_power_kw ? `${fmt(selection.total_power_kw)} kW` : "—"}</b></div>
                      <div>COP: <b>{selection.cop ? fmt(selection.cop) : "—"}</b></div>
                    </div>
                  </div>
                  {selection.notes ? <div className="mt-2 text-xs text-muted-foreground">{selection.notes}</div> : null}
                </div>
              ) : null}
            </section>
          );
        })}

        <footer className="border-t pt-3 text-xs text-muted-foreground">
          Documento gerado por CN ColdPro em {new Date().toLocaleString("pt-BR")}.
        </footer>
      </div>
    </div>
  );
}
