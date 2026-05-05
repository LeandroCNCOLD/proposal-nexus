/**
 * ABA DE RELATÓRIO FINAL CONSOLIDADO — ColdPro
 * Exibida após a aba "Simulação Dinâmica" no wizard ColdPro.
 * Consolida o cálculo estático + simulação dinâmica em um memorial técnico completo.
 */

import * as React from "react";
import {
  BarChart3,
  CheckCircle,
  Download,
  FileText,
  Snowflake,
  Thermometer,
  Zap,
  Activity,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { ColdRoomSimulationResult } from "../types/coldRoomSimulation.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, d = 1): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// ─── Seção de tabela ──────────────────────────────────────────────────────────

function ReportSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="text-primary">{icon}</div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1.5 text-sm ${highlight ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t" />;
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ColdRoomFinalReportTabProps {
  environment: any;
  calculationResult: any;
  simulationResult: ColdRoomSimulationResult | null;
  projectName?: string;
}

export function ColdRoomFinalReportTab({
  environment,
  calculationResult,
  simulationResult,
  projectName,
}: ColdRoomFinalReportTabProps) {
  const hasCalc = !!calculationResult;
  const hasSim = !!simulationResult;
  const now = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Extrair dados do cálculo estático
  const totalKcalH = Number(
    calculationResult?.total_kcal_h ??
    calculationResult?.total_load_kcal_h ??
    0
  );
  const totalKw = totalKcalH / 860;
  const totalTr = totalKw / 3.517;
  const selectedCapacity = Number(
    calculationResult?.selected_capacity_kcal_h ??
    calculationResult?.equipment_capacity_kcal_h ??
    0
  );
  const technicalMargin = selectedCapacity > 0 && totalKcalH > 0
    ? ((selectedCapacity - totalKcalH) / totalKcalH) * 100
    : null;

  // Dados do ambiente
  const envName = environment?.name ?? "Câmara";
  const envType = environment?.environment_type ?? "cold_room";
  const length = Number(environment?.length_m ?? environment?.length ?? 0);
  const width = Number(environment?.width_m ?? environment?.width ?? 0);
  const height = Number(environment?.height_m ?? environment?.height ?? 0);
  const volume = length * width * height;

  return (
    <div className="space-y-4 p-1">
      {/* Cabeçalho */}
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-primary" />
              Memorial de Cálculo — Relatório Final
            </h3>
            <p className="text-sm text-muted-foreground">
              Consolidação completa do cálculo estático de carga térmica e da Simulação Dinâmica de Comportamento da Câmara.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="font-medium">{projectName ?? "Projeto ColdPro"}</div>
            <div>{now}</div>
          </div>
        </div>
      </div>

      {/* Aviso se não há cálculo */}
      {!hasCalc && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          Realize o cálculo de carga térmica na aba "Resultado" para gerar o relatório completo.
        </div>
      )}

      {/* 1. Dados do Ambiente */}
      <ReportSection title="1. Dados do Ambiente" icon={<Snowflake className="h-4 w-4" />}>
        <DataRow label="Nome do ambiente" value={envName} />
        <DataRow label="Tipo de aplicação" value={envType} />
        <DataRow label="Dimensões (C × L × A)" value={`${fmt(length)} × ${fmt(width)} × ${fmt(height)} m`} />
        <DataRow label="Volume interno" value={`${fmt(volume)} m³`} />
        <DataRow label="Temperatura interna" value={`${fmt(Number(environment?.internal_temp_c ?? environment?.target_temp_c))} °C`} />
        <DataRow label="Temperatura externa de projeto" value={`${fmt(Number(environment?.external_temp_c ?? environment?.ambient_temp_c ?? 35))} °C`} />
        <DataRow label="Umidade relativa interna" value={`${fmt(Number(environment?.internal_rh_pct ?? 85), 0)} %`} />
      </ReportSection>

      {/* 2. Cálculo Estático de Carga Térmica */}
      {hasCalc && (
        <ReportSection title="2. Cálculo Estático de Carga Térmica (ASHRAE)" icon={<BarChart3 className="h-4 w-4" />}>
          <DataRow label="Transmissão pelas paredes" value={`${fmtInt(calculationResult?.transmission_load_kcal_h ?? calculationResult?.transmission_kcal_h)} kcal/h`} />
          <DataRow label="Carga do produto" value={`${fmtInt(calculationResult?.product_load_kcal_h ?? calculationResult?.product_kcal_h)} kcal/h`} />
          <DataRow label="Infiltração de ar" value={`${fmtInt(calculationResult?.infiltration_load_kcal_h ?? calculationResult?.infiltration_kcal_h)} kcal/h`} />
          <DataRow label="Cargas internas" value={`${fmtInt(calculationResult?.internal_loads_kcal_h ?? calculationResult?.internal_load_kcal_h)} kcal/h`} />
          <DataRow label="Embalagem" value={`${fmtInt(calculationResult?.packaging_load_kcal_h ?? 0)} kcal/h`} />
          <Divider />
          <DataRow label="Subtotal" value={`${fmtInt(calculationResult?.subtotal_kcal_h ?? totalKcalH / (1 + (calculationResult?.safety_factor ?? 0.1)))} kcal/h`} />
          <DataRow label={`Fator de segurança (${fmt((calculationResult?.safety_factor ?? 0.1) * 100, 0)}%)`} value={`${fmtInt(calculationResult?.safety_load_kcal_h ?? totalKcalH * (calculationResult?.safety_factor ?? 0.1))} kcal/h`} />
          <Divider />
          <DataRow label="TOTAL" value={`${fmtInt(totalKcalH)} kcal/h`} highlight />
          <DataRow label="" value={`${fmt(totalKw)} kW  ·  ${fmt(totalTr)} TR`} highlight />
        </ReportSection>
      )}

      {/* 3. Equipamento Selecionado */}
      {hasCalc && (
        <ReportSection title="3. Equipamento Selecionado" icon={<Snowflake className="h-4 w-4" />}>
          <DataRow label="Modelo" value={calculationResult?.selected_equipment_model ?? calculationResult?.equipment_model ?? "—"} />
          <DataRow label="Capacidade nominal" value={`${fmtInt(selectedCapacity)} kcal/h  ·  ${fmt(selectedCapacity / 860)} kW`} />
          <DataRow label="Potência elétrica" value={`${fmt(calculationResult?.equipment_power_kw)} kW`} />
          <DataRow label="COP nominal" value={fmt(calculationResult?.cop ?? calculationResult?.equipment_cop)} />
          <DataRow label="Refrigerante" value={calculationResult?.refrigerant ?? "R404A"} />
          {technicalMargin !== null && (
            <DataRow
              label="Sobra técnica"
              value={`${fmt(technicalMargin, 1)} %`}
              highlight={technicalMargin < 5 || technicalMargin > 30}
            />
          )}
        </ReportSection>
      )}

      {/* 4. Resultados da Simulação Dinâmica */}
      {hasSim && (
        <ReportSection title="4. Diagnóstico de Comportamento da Câmara" icon={<Activity className="h-4 w-4" />}>
          <DataRow label="Período simulado" value={`${simulationResult.summary.simulation_period_days} dia(s)`} />
          <DataRow label="Temperatura máxima interna" value={`${fmt(simulationResult.summary.max_room_temperature_c)} °C`} />
          <DataRow label="Temperatura média interna" value={`${fmt(simulationResult.summary.average_room_temperature_c)} °C`} />
          <DataRow label="Temperatura mínima interna" value={`${fmt(simulationResult.summary.min_room_temperature_c)} °C`} />
          <Divider />
          <DataRow label="Carga térmica dinâmica no período (pico)" value={`${fmtInt(simulationResult.summary.peak_load_kcal_h)} kcal/h (${simulationResult.summary.worst_hour})`} />
          <DataRow label="Capacidade mínima recomendada" value={`${fmtInt(simulationResult.summary.recommended_min_capacity_kcal_h)} kcal/h`} />
          <DataRow label="Capacidade adequada" value={simulationResult.summary.capacity_adequate ? "Sim ✓" : "Não — subdimensionado!"} highlight={!simulationResult.summary.capacity_adequate} />
          <Divider />
          <DataRow label="Tempo compressor ligado" value={`${fmt(simulationResult.summary.compressor_runtime_pct, 0)}% · ${fmt(simulationResult.summary.compressor_runtime_hours)} h`} />
          <DataRow label="Consumo elétrico total" value={`${fmtInt(simulationResult.summary.total_energy_kwh)} kWh`} />
          <DataRow label="COP médio real" value={fmt(simulationResult.summary.average_cop)} />
          <DataRow label="Horas fora do range de temperatura" value={`${fmt(simulationResult.summary.temperature_out_of_range_hours)} h`} highlight={simulationResult.summary.temperature_out_of_range_hours > 0} />
        </ReportSection>
      )}

      {/* 5. Alertas e Recomendações */}
      {hasSim && simulationResult.alerts.length > 0 && (
        <ReportSection title="5. Alertas e Recomendações" icon={<AlertTriangle className="h-4 w-4" />}>
          <div className="space-y-2">
            {simulationResult.alerts.slice(0, 8).map((alert, i) => {
              const colors = {
                critical: "text-red-700 dark:text-red-400",
                warning: "text-yellow-700 dark:text-yellow-400",
                info: "text-blue-700 dark:text-blue-400",
              };
              const icons = {
                critical: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
                warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
                info: <Info className="h-3.5 w-3.5 shrink-0" />,
              };
              return (
                <div key={i} className={`flex items-start gap-2 text-sm ${colors[alert.severity]}`}>
                  {icons[alert.severity]}
                  <span>{alert.message}</span>
                </div>
              );
            })}
          </div>
        </ReportSection>
      )}

      {/* 6. Conclusão */}
      {hasCalc && (
        <ReportSection title="6. Conclusão Técnica" icon={<CheckCircle className="h-4 w-4" />}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              A carga térmica total calculada pelo método ASHRAE para o ambiente <strong>{envName}</strong> é de{" "}
              <strong>{fmtInt(totalKcalH)} kcal/h</strong> ({fmt(totalKw)} kW / {fmt(totalTr)} TR),
              incluindo fator de segurança.
            </p>
            {selectedCapacity > 0 && (
              <p>
                O equipamento selecionado possui capacidade nominal de{" "}
                <strong>{fmtInt(selectedCapacity)} kcal/h</strong>
                {technicalMargin !== null && `, representando uma sobra técnica de ${fmt(technicalMargin, 1)}%`}.
              </p>
            )}
            {hasSim && (
              <p>
                A simulação dinâmica confirmou que a temperatura interna se manteve entre{" "}
                {fmt(simulationResult!.summary.min_room_temperature_c)}°C e{" "}
                {fmt(simulationResult!.summary.max_room_temperature_c)}°C, com o compressor operando{" "}
                {fmt(simulationResult!.summary.compressor_runtime_pct, 0)}% do tempo e consumo estimado de{" "}
                {fmtInt(simulationResult!.summary.total_energy_kwh)} kWh no período simulado.
              </p>
            )}
            {!hasSim && (
              <p className="text-yellow-700 dark:text-yellow-400">
                Execute a simulação dinâmica na aba anterior para obter a análise de comportamento temporal da câmara.
              </p>
            )}
          </div>
        </ReportSection>
      )}

      {/* Rodapé */}
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Gerado pelo ColdPro — Sistema de Cálculo de Carga Térmica</span>
          <span>{now}</span>
        </div>
        <div className="mt-1">
          Metodologia: ASHRAE Refrigeration Handbook · Simulação dinâmica por balanço de energia em intervalos de tempo
        </div>
      </div>
    </div>
  );
}
