/**
 * ABA DE SIMULAÇÃO DINÂMICA — ColdPro
 * Exibida após a aba "Resultado" no wizard ColdPro.
 * Permite configurar e executar a simulação dinâmica por intervalo de tempo.
 */

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  DoorOpen,
  Droplets,
  Info,
  Play,
  RefreshCw,
  Snowflake,
  Thermometer,
  Timer,
  Zap,
} from "lucide-react";
import { useColdRoomSimulation, type SimulationConfig } from "../hooks/useColdRoomSimulation";
import type { ColdRoomSimulationResult, SimulationAlert, WeatherProfileType } from "../types/coldRoomSimulation.types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { SimulationChartPanel } from "../components/SimulationChartPanel";
import { SimulationAIInsightPanel } from "../components/SimulationAIInsightPanel";

// ─── Helpers de formatação ────────────────────────────────────────────────────

function fmt(value: number | undefined | null, decimals = 1): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtInt(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// ─── Componentes internos ─────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  icon,
  status,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  status?: "ok" | "warning" | "critical";
}) {
  const statusColors = {
    ok: "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30",
    warning: "border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/30",
    critical: "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30",
    undefined: "border-border bg-muted/20",
  };
  const colorClass = statusColors[status ?? "undefined"];

  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="rounded bg-primary/10 p-1.5 text-primary">{icon}</div>
      </div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

function AlertBadge({ alert }: { alert: SimulationAlert }) {
  const colors = {
    critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-300",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300",
    info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
  };
  const icons = {
    critical: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
    warning: <AlertTriangle className="h-3.5 w-3.5 shrink-0" />,
    info: <Info className="h-3.5 w-3.5 shrink-0" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${colors[alert.severity]}`}>
      {icons[alert.severity]}
      <span>{alert.message}</span>
    </div>
  );
}

// ─── Painel de configuração ───────────────────────────────────────────────────

const WEATHER_LABELS: Record<WeatherProfileType, string> = {
  hot_day: "Dia quente (38°C)",
  cold_day: "Dia frio (18°C)",
  rainy_day: "Dia chuvoso (24°C)",
  dry_day: "Dia seco (35°C)",
  humid_day: "Dia úmido (30°C)",
  annual: "Simulação anual",
  manual: "Personalizado",
};

function ConfigPanel({
  config,
  setConfig,
  onRun,
  isRunning,
}: {
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  onRun: () => void;
  isRunning: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Activity className="h-4 w-4 text-primary" />
        Configuração da Simulação
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Perfil climático */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Perfil Climático</label>
          <select
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={config.weather_profile_type}
            onChange={(e) =>
              setConfig((c) => ({ ...c, weather_profile_type: e.target.value as WeatherProfileType }))
            }
          >
            {(Object.keys(WEATHER_LABELS) as WeatherProfileType[]).map((k) => (
              <option key={k} value={k}>
                {WEATHER_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {/* Período */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Período</label>
          <select
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={config.simulation_days}
            onChange={(e) =>
              setConfig((c) => ({ ...c, simulation_days: Number(e.target.value) as 1 | 7 | 30 | 365 }))
            }
          >
            <option value={1}>1 dia</option>
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </div>

        {/* Passo de tempo */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Passo de tempo</label>
          <select
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={config.simulation_step_minutes}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                simulation_step_minutes: Number(e.target.value) as 5 | 10 | 15 | 30 | 60,
              }))
            }
          >
            <option value={5}>5 minutos</option>
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={60}>1 hora</option>
          </select>
        </div>

        {/* Setpoint */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Setpoint (°C)</label>
          <input
            type="number"
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={config.setpoint_c}
            step={0.5}
            onChange={(e) => setConfig((c) => ({ ...c, setpoint_c: Number(e.target.value) }))}
          />
        </div>

        {/* Diferencial */}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Diferencial (°C)</label>
          <input
            type="number"
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={config.differential_c}
            step={0.5}
            min={0.5}
            max={5}
            onChange={(e) => setConfig((c) => ({ ...c, differential_c: Number(e.target.value) }))}
          />
        </div>

        {/* Botão executar */}
        <div className="flex items-end">
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Simulando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Executar Simulação
              </>
            )}
          </button>
        </div>
      </div>

      {/* Configuração de Portas */}
      <div className="mt-4 border-t pt-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <DoorOpen className="h-3.5 w-3.5" /> Operação de Portas
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Aberturas / hora</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.door_openings_per_hour ?? 4}
              min={0} max={60} step={1}
              onChange={(e) => setConfig((c) => ({ ...c, door_openings_per_hour: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Duração por abertura (s)</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.door_duration_seconds ?? 30}
              min={5} max={300} step={5}
              onChange={(e) => setConfig((c) => ({ ...c, door_duration_seconds: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Horário ativo (início h)</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.door_active_start_hour ?? 8}
              min={0} max={23} step={1}
              onChange={(e) => setConfig((c) => ({ ...c, door_active_start_hour: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Horário ativo (fim h)</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.door_active_end_hour ?? 18}
              min={1} max={24} step={1}
              onChange={(e) => setConfig((c) => ({ ...c, door_active_end_hour: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>

      {/* Configuração de Degelo */}
      <div className="mt-4 border-t pt-4">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Snowflake className="h-3.5 w-3.5" /> Perfil de Degelo
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de degelo</label>
            <select
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.defrost_type ?? "none"}
              onChange={(e) => setConfig((c) => ({ ...c, defrost_type: e.target.value as any }))}
            >
              <option value="none">Sem degelo</option>
              <option value="electrical">Elétrico</option>
              <option value="hot_gas">Gás quente</option>
              <option value="air">A ar</option>
              <option value="water">Água</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ciclos / dia</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.defrost_cycles_per_day ?? 0}
              min={0} max={12} step={1}
              disabled={!config.defrost_type || config.defrost_type === "none"}
              onChange={(e) => setConfig((c) => ({ ...c, defrost_cycles_per_day: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Duração (min/ciclo)</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.defrost_duration_minutes ?? 30}
              min={5} max={120} step={5}
              disabled={!config.defrost_type || config.defrost_type === "none"}
              onChange={(e) => setConfig((c) => ({ ...c, defrost_duration_minutes: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">UR interna alvo (%)</label>
            <input
              type="number"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
              value={config.internal_rh_pct ?? 85}
              min={50} max={98} step={1}
              onChange={(e) => setConfig((c) => ({ ...c, internal_rh_pct: Number(e.target.value) }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Painel de resultados ─────────────────────────────────────────────────────

function ResultsPanel({ result, setpoint }: { result: ColdRoomSimulationResult; setpoint: number }) {
  const { summary, chart_data, alerts } = result;

  const chartDataFormatted = chart_data.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    "Temp. Interna (°C)": d.room_temperature_c,
    "Temp. Externa (°C)": d.external_temperature_c,
    "Carga Total (kcal/h)": d.total_load_kcal_h,
    "Capacidade (kcal/h)": d.equipment_capacity_kcal_h,
    "Potência (kW)": d.equipment_power_kw,
    compressor: d.compressor_status === "ON" ? 1 : 0,
  }));

  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const warningAlerts = alerts.filter((a) => a.severity === "warning");
  const infoAlerts = alerts.filter((a) => a.severity === "info");

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Alertas da Simulação ({alerts.length})
          </h3>
          <div className="space-y-1.5">
            {criticalAlerts.slice(0, 3).map((a, i) => <AlertBadge key={i} alert={a} />)}
            {warningAlerts.slice(0, 2).map((a, i) => <AlertBadge key={i} alert={a} />)}
            {infoAlerts.slice(0, 2).map((a, i) => <AlertBadge key={i} alert={a} />)}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        <KpiCard
          label="Temp. Máx. Interna"
          value={fmt(summary.max_room_temperature_c)}
          unit="°C"
          icon={<Thermometer className="h-3.5 w-3.5" />}
          status={summary.max_room_temperature_c > setpoint + 3 ? "critical" : "ok"}
        />
        <KpiCard
          label="Temp. Média Interna"
          value={fmt(summary.average_room_temperature_c)}
          unit="°C"
          icon={<Thermometer className="h-3.5 w-3.5" />}
          status={
            Math.abs(summary.average_room_temperature_c - setpoint) > 2 ? "warning" : "ok"
          }
        />
        <KpiCard
          label="Horas Fora do Range"
          value={fmt(summary.temperature_out_of_range_hours)}
          unit="horas"
          icon={<Clock className="h-3.5 w-3.5" />}
          status={summary.temperature_out_of_range_hours > 2 ? "critical" : summary.temperature_out_of_range_hours > 0 ? "warning" : "ok"}
        />
        <KpiCard
          label="Tempo Compressor Ligado"
          value={fmt(summary.compressor_runtime_pct, 0)}
          unit={`% · ${fmt(summary.compressor_runtime_hours)} h`}
          icon={<Activity className="h-3.5 w-3.5" />}
          status={summary.compressor_runtime_pct > 90 ? "critical" : summary.compressor_runtime_pct > 75 ? "warning" : "ok"}
        />
        <KpiCard
          label="Consumo Total"
          value={fmtInt(summary.total_energy_kwh)}
          unit="kWh"
          icon={<Zap className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="COP Médio"
          value={fmt(summary.average_cop)}
          unit="adimensional"
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          status={summary.average_cop < 1.5 ? "warning" : "ok"}
        />
        <KpiCard
          label="Pico de Carga"
          value={fmtInt(summary.peak_load_kcal_h)}
          unit={`kcal/h · ${summary.worst_hour}`}
          icon={<Activity className="h-3.5 w-3.5" />}
        />
        <KpiCard
          label="Capacidade Adequada"
          value={summary.capacity_adequate ? "Sim" : "Não"}
          unit={`Mín. recomendado: ${fmtInt(summary.recommended_min_capacity_kcal_h)} kcal/h`}
          icon={<CheckCircle className="h-3.5 w-3.5" />}
          status={summary.capacity_adequate ? "ok" : "critical"}
        />
      </div>

      {/* KPIs de Portas */}
      {summary.total_door_openings > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <DoorOpen className="h-3.5 w-3.5" /> Operação de Portas
          </h4>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <KpiCard
              label="Total de Aberturas"
              value={fmtInt(summary.total_door_openings)}
              unit="aberturas no período"
              icon={<DoorOpen className="h-3.5 w-3.5" />}
            />
            <KpiCard
              label="Infiltração por Portas"
              value={fmt(summary.door_infiltration_pct_of_total)}
              unit={`% da carga total · ${fmtInt(summary.total_door_infiltration_load_kcal)} kcal`}
              icon={<Droplets className="h-3.5 w-3.5" />}
              status={summary.door_infiltration_pct_of_total > 30 ? "warning" : "ok"}
            />
          </div>
        </div>
      )}

      {/* KPIs de Gelo e Degelo */}
      {(summary.defrost_cycles_per_day > 0 || summary.total_frost_kg > 0) && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Snowflake className="h-3.5 w-3.5" /> Gelo e Degelo
          </h4>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <KpiCard
              label="Risco de Formação de Gelo"
              value={summary.ice_risk_level === "n/a" ? "N/A" : summary.ice_risk_level.toUpperCase()}
              unit={`${fmt(summary.frost_kg_per_day)} kg/dia estimados`}
              icon={<Snowflake className="h-3.5 w-3.5" />}
              status={summary.ice_risk_level === "critical" ? "critical" : summary.ice_risk_level === "high" ? "warning" : "ok"}
            />
            <KpiCard
              label="Carga Latente (Umidade)"
              value={fmt(summary.latent_load_pct)}
              unit="% da carga de infiltração"
              icon={<Droplets className="h-3.5 w-3.5" />}
              status={summary.latent_load_pct > 50 ? "warning" : "ok"}
            />
            <KpiCard
              label="Máquina Parada (Degelo)"
              value={fmt(summary.defrost_downtime_hours_per_day)}
              unit={`h/dia · ${fmtInt(summary.machine_downtime_hours_total)}h no período`}
              icon={<Timer className="h-3.5 w-3.5" />}
              status={summary.defrost_downtime_hours_per_day > 3 ? "warning" : "ok"}
            />
            {summary.recommended_defrost_cycles > 0 && (
              <KpiCard
                label="Ciclos de Degelo"
                value={`${summary.defrost_cycles_per_day} / ${summary.recommended_defrost_cycles}`}
                unit="configurado / recomendado por dia"
                icon={<Activity className="h-3.5 w-3.5" />}
                status={summary.defrost_cycles_per_day < summary.recommended_defrost_cycles ? "warning" : "ok"}
              />
            )}
          </div>
        </div>
      )}

      {/* Gráfico de temperatura */}
      <div className="rounded-lg border bg-background p-4">
        <h4 className="mb-3 text-sm font-semibold">Temperatura Interna vs. Externa</h4>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartDataFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} unit="°C" />
            <Tooltip
              contentStyle={{ fontSize: 11 }}
              formatter={(v: any) => [`${fmt(v)}°C`]}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={setpoint} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Setpoint", fontSize: 10, fill: "#22c55e" }} />
            <Line
              type="monotone"
              dataKey="Temp. Interna (°C)"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="Temp. Externa (°C)"
              stroke="#f97316"
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de cargas */}
      <div className="rounded-lg border bg-background p-4">
        <h4 className="mb-3 text-sm font-semibold">Carga Térmica vs. Capacidade do Equipamento</h4>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartDataFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} unit=" kcal/h" width={80} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [fmtInt(v) + " kcal/h"]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area
              type="monotone"
              dataKey="Carga Total (kcal/h)"
              stroke="#ef4444"
              fill="#ef444420"
              dot={false}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Capacidade (kcal/h)"
              stroke="#22c55e"
              fill="#22c55e20"
              dot={false}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de potência */}
      <div className="rounded-lg border bg-background p-4">
        <h4 className="mb-3 text-sm font-semibold">Consumo Elétrico (kW)</h4>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartDataFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} unit=" kW" />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [fmt(v) + " kW"]} />
            <Area
              type="monotone"
              dataKey="Potência (kW)"
              stroke="#8b5cf6"
              fill="#8b5cf620"
              dot={false}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface ColdRoomSimulationTabProps {
  /** Dados do ambiente ColdPro (do banco de dados) */
  environment: any;
  /** Resultado do cálculo estático (do coldpro-calculation.engine) */
  calculationResult: any;
  /** Callback para análise via IA */
  onAnalyze?: (question: string) => Promise<string>;
}

export function ColdRoomSimulationTab({ environment, calculationResult, onAnalyze }: ColdRoomSimulationTabProps) {
  const { result, isRunning, error, config, setConfig, runSimulation, reset } =
    useColdRoomSimulation(environment, calculationResult);

  const hasData = !!environment && !!calculationResult;

  return (
    <div className="space-y-4 p-1">
      {/* Cabeçalho */}
      <div className="rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-primary" />
              Simulação Dinâmica
            </h3>
            <p className="text-sm text-muted-foreground">
              Simula o comportamento térmico da câmara ao longo do tempo, com variação de temperatura
              externa, entradas de produto e lógica de controle liga/desliga do compressor.
            </p>
          </div>
          {result && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Nova simulação
            </button>
          )}
        </div>
      </div>

      {/* Aviso se não há dados */}
      {!hasData && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-300">
          <AlertTriangle className="mb-1 inline h-4 w-4" />
          {" "}Realize o cálculo de carga térmica na aba "Resultado" antes de executar a simulação.
        </div>
      )}

      {/* Configuração */}
      {!result && hasData && (
        <ConfigPanel
          config={config}
          setConfig={setConfig}
          onRun={runSimulation}
          isRunning={isRunning}
        />
      )}

      {/* Erro */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isRunning && (
        <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/20 p-8">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Executando simulação dinâmica...</span>
        </div>
      )}

      {/* Resultados */}
      {result && !isRunning && (
        <>
          <ResultsPanel result={result} setpoint={config.setpoint_c} />

          {/* Gráficos interativos com filtro de período */}
          <SimulationChartPanel
            chartData={result.timeline}
            setpoint={config.setpoint_c}
          />

          {/* Análise de IA */}
          {onAnalyze && (
            <SimulationAIInsightPanel
              result={result}
              onAnalyze={onAnalyze}
            />
          )}
        </>
      )}
    </div>
  );
}
