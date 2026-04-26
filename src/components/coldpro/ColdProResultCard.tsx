import * as React from "react";
import { BarChart3, Calculator, ChevronDown, Droplets, Gauge, Snowflake } from "lucide-react";
import { fmtColdPro } from "./ColdProFormPrimitives";
import { normalizeColdProResult } from "@/modules/coldpro/core/resultNormalizer";
import { LoadDistributionPieChart } from "@/modules/coldpro/components/results/LoadDistributionPieChart";
import { LoadBreakdownBarChart } from "@/modules/coldpro/components/results/LoadBreakdownBarChart";
import { EquipmentCapacityChart } from "@/modules/coldpro/components/results/EquipmentCapacityChart";
import { TunnelValidationCharts } from "@/modules/coldpro/components/results/TunnelValidationCharts";
import { TemperatureProfileLineChart } from "@/modules/coldpro/components/results/TemperatureProfileLineChart";
import { ResultConsistencyAudit } from "@/modules/coldpro/components/results/ResultConsistencyAudit";
import { ColdProAIInsightPanel } from "@/modules/coldpro/components/results/ColdProAIInsightPanel";

function n(value: unknown) {
  return Number(value ?? 0);
}

function Kpi({ label, value, unit, icon, note }: { label: string; value: unknown; unit: string; icon: React.ReactNode; note?: string }) {
  return (
    <div className="min-w-0 rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <div className="break-words text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{fmtColdPro(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{unit}{note ? ` · ${note}` : ""}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-current" />
      {label}
    </label>
  );
}

function Details({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="rounded-xl border bg-background p-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        {title}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </summary>
      <div className="mt-4 border-t pt-4">{children}</div>
    </details>
  );
}

function Group({ title, rows }: { title: string; rows: { label: string; value: unknown }[] }) {
  const subtotal = rows.reduce((sum, row) => sum + n(row.value), 0);
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{fmtColdPro(subtotal)} kcal/h</span>
      </div>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{row.label}</span>
            <b className="tabular-nums">{fmtColdPro(row.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  result: any;
  selection?: any | null;
  environment?: any | null;
  products?: any[];
  onAnalyze?: (question: string, previousAnalysis?: string | null) => Promise<string | null>;
  isAnalyzing?: boolean;
};

export function ColdProResultCard({ result, selection, environment, products = [], onAnalyze, isAnalyzing }: Props) {
  const [compact, setCompact] = React.useState(false);
  const [showAudit, setShowAudit] = React.useState(true);
  const [showCharts, setShowCharts] = React.useState(true);
  const [showAI, setShowAI] = React.useState(true);
  const [showTables, setShowTables] = React.useState(false);

  if (!result) return <div className="rounded-xl border border-dashed bg-background p-6 text-sm text-muted-foreground">Nenhum cálculo realizado. Preencha as etapas anteriores e clique em calcular carga térmica.</div>;

  const normalized = normalizeColdProResult(result, selection, environment, products);
  const breakdown = result.calculation_breakdown ?? {};
  const transmissionFaces = Array.isArray(breakdown.transmission_faces) ? breakdown.transmission_faces : [];
  const productBreakdown = Array.isArray(breakdown.products) ? breakdown.products : [];
  const advancedProcesses = Array.isArray(breakdown.advanced_processes) ? breakdown.advanced_processes : [];
  const seed = breakdown.seed_dehumidification;
  const frost = normalized.iceAndDefrost;

  return (
    <div className="min-w-0 rounded-xl border bg-background p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resultado do cálculo</h3>
          <p className="mt-1 text-sm text-muted-foreground">Dashboard técnico da carga térmica, consistência, túnel, equipamento e laudo orientado por dados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle checked={compact} onChange={setCompact} label="Visualização resumida" />
          <Toggle checked={showCharts} onChange={setShowCharts} label="Gráficos" />
          <Toggle checked={showAudit} onChange={setShowAudit} label="Auditoria" />
          <Toggle checked={showAI} onChange={setShowAI} label="IA" />
          <Toggle checked={showTables} onChange={setShowTables} label="Tabelas" />
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Carga requerida" value={normalized.summary.requiredKcalH} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
        <Kpi label="Potência" value={normalized.summary.requiredKW} unit="kW" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Capacidade" value={normalized.summary.requiredTR} unit="TR" icon={<Snowflake className="h-4 w-4" />} />
        <Kpi label="Segurança" value={normalized.summary.safetyKcalH} unit="kcal/h" note={`${fmtColdPro(normalized.summary.safetyFactorPercent)}%`} icon={<BarChart3 className="h-4 w-4" />} />
        <Kpi label="Status" value={normalized.summary.status} unit="dimensionamento" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Sobra técnica" value={normalized.equipment.surplusPercent} unit="%" icon={<Gauge className="h-4 w-4" />} />
        <Kpi label="Equipamento" value={normalized.equipment.selectedModel ?? "—"} unit={normalized.equipment.quantity ? `${fmtColdPro(normalized.equipment.quantity, 0)} unidade(s)` : "seleção"} icon={<Snowflake className="h-4 w-4" />} />
        <Kpi label="Capacidade selecionada" value={normalized.equipment.totalCapacityKcalH} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
      </section>

      {showCharts ? (
        <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LoadDistributionPieChart normalized={normalized} />
          <LoadBreakdownBarChart normalized={normalized} />
        </section>
      ) : null}

      {showAudit ? <section className="mt-5"><ResultConsistencyAudit normalized={normalized} /></section> : null}

      {!compact ? (
        <>
          <section className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <EquipmentCapacityChart normalized={normalized} />
            <TemperatureProfileLineChart normalized={normalized} />
          </section>
          <section className="mt-5"><TunnelValidationCharts normalized={normalized} /></section>

          <section className="mt-5 rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center gap-2"><Snowflake className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Análise de gelo, umidade e degelo</h4></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Gelo por dia" value={frost.frostKgDay} unit="kg/dia" icon={<Droplets className="h-4 w-4" />} />
              <Kpi label="Perda rendimento" value={frost.efficiencyLossPercent} unit="%" icon={<Gauge className="h-4 w-4" />} />
              <Kpi label="Carga adicional" value={frost.additionalLoadKcalH} unit="kcal/h" icon={<Calculator className="h-4 w-4" />} />
              <Kpi label="Degelo preventivo" value={frost.recommendedDefrostIntervalH} unit="h" icon={<Snowflake className="h-4 w-4" />} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg bg-muted/30 p-3">Operação normal: <b>{frost.normalBlockHours ? `${fmtColdPro(frost.normalBlockHours)} h` : "sem bloqueio estimado"}</b></div>
              <div className="rounded-lg bg-muted/30 p-3">Operação arriscada: <b>{frost.riskyBlockHours ? `${fmtColdPro(frost.riskyBlockHours)} h` : "sem bloqueio estimado"}</b></div>
              <div className="rounded-lg bg-muted/30 p-3">Operação complexa: <b>{frost.complexBlockHours ? `${fmtColdPro(frost.complexBlockHours)} h` : "sem bloqueio estimado"}</b></div>
            </div>
          </section>

          {showAI ? <section className="mt-5"><ColdProAIInsightPanel normalized={normalized} onAnalyze={onAnalyze} isAnalyzing={isAnalyzing} /></section> : null}
        </>
      ) : null}

      <div className="mt-5 space-y-3">
        <Details title="Decomposição técnica consolidada" defaultOpen={showTables}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Group title="Ambiente" rows={[{ label: "Transmissão", value: normalized.loadDistribution.environmentKcalH }]} />
            <Group title="Produtos e processo" rows={[{ label: "Produto direto", value: normalized.loadDistribution.productKcalH }, { label: "Túnel/processo", value: normalized.loadDistribution.tunnelProcessKcalH }, { label: "Embalagem", value: normalized.loadDistribution.packagingKcalH }, { label: "Respiração", value: normalized.loadDistribution.respirationKcalH }]} />
            <Group title="Ar e umidade" rows={[{ label: "Infiltração", value: normalized.loadDistribution.infiltrationKcalH }, { label: "Desumidificação", value: normalized.loadDistribution.dehumidificationKcalH }]} />
            <Group title="Cargas internas" rows={[{ label: "Pessoas", value: normalized.loadDistribution.peopleKcalH }, { label: "Iluminação", value: normalized.loadDistribution.lightingKcalH }, { label: "Motores", value: normalized.loadDistribution.motorsKcalH }, { label: "Ventiladores", value: normalized.loadDistribution.fansKcalH }]} />
            <Group title="Degelo, gelo e outros" rows={[{ label: "Degelo", value: normalized.loadDistribution.defrostKcalH }, { label: "Impacto gelo", value: normalized.loadDistribution.iceImpactKcalH }, { label: "Outras", value: normalized.loadDistribution.otherKcalH }]} />
            <Group title="Fechamento" rows={[{ label: "Subtotal", value: normalized.summary.subtotalKcalH }, { label: "Segurança", value: normalized.summary.safetyKcalH }, { label: "Total requerido", value: normalized.summary.requiredKcalH }]} />
          </div>
        </Details>

        {seed?.applies ? (
          <Details title="Controle de umidade — sementes" defaultOpen={showTables}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
              <div>W externo: <b>{fmtColdPro(seed.external_absolute_humidity_kg_kg, 5)} kg/kg</b></div>
              <div>W interno: <b>{fmtColdPro(seed.internal_absolute_humidity_kg_kg, 5)} kg/kg</b></div>
              <div>ΔW: <b>{fmtColdPro(seed.delta_w_kg_kg, 5)} kg/kg</b></div>
              <div>Vazão ar: <b>{fmtColdPro(seed.air_flow_m3_h)} m³/h</b></div>
              <div>Água do ar: <b>{fmtColdPro(seed.water_removed_air_kg_h, 2)} kg/h</b></div>
              <div>Água semente: <b>{fmtColdPro(seed.water_removed_seed_kg_h, 2)} kg/h</b></div>
              <div>Total: <b>{fmtColdPro(seed.total_kcal_h)} kcal/h</b></div>
            </div>
          </Details>
        ) : null}

        {advancedProcesses.length ? (
          <Details title="Processos especiais" defaultOpen={showTables}>
            <div className="space-y-3">
              {advancedProcesses.map((item: any, index: number) => <div key={`${item.advanced_process_type}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm"><b>{item.advanced_process_type}</b> · {item.status}</div>)}
            </div>
          </Details>
        ) : null}

        {productBreakdown.length ? (
          <Details title="Base da carga de produto" defaultOpen={showTables}>
            <div className="space-y-3">
              {productBreakdown.map((product: any, index: number) => (
                <div key={`${product.product_name}-${index}`} className="rounded-lg bg-muted/30 p-3 text-sm">
                  <div className="mb-2 font-semibold">{product.product_name}</div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-4">
                    <div>Modo: <b>{product.product_load_mode}</b></div>
                    <div>Massa/dia: <b>{fmtColdPro(product.mass_kg_day)} kg</b></div>
                    <div>Equivalente: <b>{fmtColdPro(product.hourly_movement_kg)} kg/h</b></div>
                    <div>Carga: <b>{fmtColdPro(product.total_kcal_h)} kcal/h</b></div>
                  </div>
                </div>
              ))}
            </div>
          </Details>
        ) : null}

        {transmissionFaces.length ? (
          <Details title="Transmissão por face" defaultOpen={showTables}>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="py-2 text-left font-medium">Face</th><th className="py-2 text-right font-medium">Área m²</th><th className="py-2 text-right font-medium">U painel</th><th className="py-2 text-right font-medium">ΔT °C</th><th className="py-2 text-right font-medium">Total W</th><th className="py-2 text-right font-medium">kcal/h</th><th className="py-2 text-right font-medium">TR</th></tr></thead>
                <tbody>{transmissionFaces.map((face: any) => <tr key={face.local} className="border-b last:border-0"><td className="py-2 font-medium">{face.local}</td><td className="py-2 text-right tabular-nums">{fmtColdPro(face.insulated_area_m2 ?? face.area_m2)}</td><td className="py-2 text-right tabular-nums">{fmtColdPro(face.u_value_w_m2k, 3)}</td><td className="py-2 text-right tabular-nums">{fmtColdPro(face.delta_t_c)}</td><td className="py-2 text-right tabular-nums">{fmtColdPro(face.transmission_w)}</td><td className="py-2 text-right font-semibold tabular-nums">{fmtColdPro(face.transmission_kcal_h)}</td><td className="py-2 text-right tabular-nums">{fmtColdPro(face.transmission_tr, 3)}</td></tr>)}</tbody>
              </table>
            </div>
          </Details>
        ) : null}
      </div>
    </div>
  );
}
