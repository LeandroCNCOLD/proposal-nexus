import * as React from "react";
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
  Brush,
} from "recharts";
import { Calendar, Filter } from "lucide-react";
import type { ColdRoomSimulationTimeStep } from "../types/coldRoomSimulation.types";

interface SimulationChartPanelProps {
  chartData: ColdRoomSimulationTimeStep[];
  setpoint: number;
}

type TimeRange = "all" | "last_24h" | "last_7d" | "last_30d";

export function SimulationChartPanel({ chartData, setpoint }: SimulationChartPanelProps) {
  const [timeRange, setTimeRange] = React.useState<TimeRange>("all");

  const filteredData = React.useMemo(() => {
    if (timeRange === "all" || chartData.length === 0) return chartData;
    
    const lastTimestamp = new Date(chartData[chartData.length - 1].timestamp).getTime();
    let msToSubtract = 0;
    
    if (timeRange === "last_24h") msToSubtract = 24 * 60 * 60 * 1000;
    if (timeRange === "last_7d") msToSubtract = 7 * 24 * 60 * 60 * 1000;
    if (timeRange === "last_30d") msToSubtract = 30 * 24 * 60 * 60 * 1000;
    
    const cutoff = lastTimestamp - msToSubtract;
    return chartData.filter(d => new Date(d.timestamp).getTime() >= cutoff);
  }, [chartData, timeRange]);

  const formattedData = React.useMemo(() => {
    return filteredData.map(d => {
      const date = new Date(d.timestamp);
      return {
        ...d,
        time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        dateLabel: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        fullDate: date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
        compressorNum: d.compressor_status === "ON" ? 1 : d.compressor_status === "DEFROST" ? 0.5 : 0,
      };
    });
  }, [filteredData]);

  if (!chartData || chartData.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border bg-background p-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtro de Período</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeRange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            Completo
          </button>
          <button
            onClick={() => setTimeRange("last_30d")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === "last_30d" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            30 Dias
          </button>
          <button
            onClick={() => setTimeRange("last_7d")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === "last_7d" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            7 Dias
          </button>
          <button
            onClick={() => setTimeRange("last_24h")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${timeRange === "last_24h" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
          >
            24 Horas
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <h4 className="mb-4 text-sm font-semibold">Oscilação de Temperatura</h4>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="fullDate" tick={{ fontSize: 10 }} minTickGap={50} />
            <YAxis tick={{ fontSize: 10 }} unit="°C" domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ fontSize: 12, borderRadius: '8px', border: '1px solid #e2e8f0' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
              formatter={(value: number) => [`${value.toFixed(1)}°C`]}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
            <ReferenceLine y={setpoint} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "Setpoint", position: "insideTopLeft", fontSize: 11, fill: "#22c55e" }} />
            <Line type="monotone" name="Temp. Interna" dataKey="room_temperature_c" stroke="#3b82f6" dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
            <Line type="monotone" name="Temp. Externa" dataKey="external_temperature_c" stroke="#f97316" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
            <Brush dataKey="fullDate" height={30} stroke="#8884d8" fill="#f8fafc" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h4 className="mb-4 text-sm font-semibold">Carga vs. Capacidade</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10 }} width={45} />
              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [`${Math.round(value)} kcal/h`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" name="Carga Total" dataKey="total_load_kcal_h" stroke="#ef4444" fill="#ef444420" dot={false} strokeWidth={2} />
              <Area type="step" name="Capacidade (Eq.)" dataKey="equipment_capacity_kcal_h" stroke="#22c55e" fill="#22c55e10" dot={false} strokeWidth={1.5} strokeDasharray="3 3" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-background p-4">
          <h4 className="mb-4 text-sm font-semibold">Ciclos do Compressor & Degelo</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10 }} ticks={[0, 0.5, 1]} tickFormatter={(val) => val === 1 ? 'ON' : val === 0.5 ? 'DEF' : 'OFF'} width={40} />
              <Tooltip 
                contentStyle={{ fontSize: 11 }} 
                formatter={(value: number) => [value === 1 ? 'Ligado' : value === 0.5 ? 'Degelo' : 'Desligado', 'Status']} 
              />
              <Area type="step" name="Status" dataKey="compressorNum" stroke="#8b5cf6" fill="#8b5cf630" dot={false} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
