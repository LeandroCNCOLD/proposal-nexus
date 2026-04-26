import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart, PieChart, TrendingUp, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart as RePieChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend as ChartLegend, LinearScale, LineElement, PointElement, Tooltip as ChartTooltip } from "chart.js";
import { Bar as ChartBar, Doughnut, Line as ChartLine } from "react-chartjs-2";
import ReactECharts from "echarts-for-react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { Card as TremorCard, Metric, Text, BarList, DonutChart, AreaChart as TremorAreaChart } from "@tremor/react";
import { PageHeader } from "@/components/PageHeader";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, ChartTooltip, ChartLegend);

export const Route = createFileRoute("/app/relatorios")({ component: ReportsPage });

const chartVars = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const chartHex = ["#2f6fed", "#14b8a6", "#f59e0b", "#a855f7", "#ef4444"];

const funnelData = [
  { name: "Lead", value: 42, amount: 820000 },
  { name: "Orçamento", value: 31, amount: 640000 },
  { name: "Negociação", value: 18, amount: 480000 },
  { name: "Aprovado", value: 9, amount: 310000 },
  { name: "Perdido", value: 7, amount: 120000 },
];

const monthData = [
  { month: "Jan", propostas: 18, vendas: 7, receita: 180 },
  { month: "Fev", propostas: 24, vendas: 9, receita: 240 },
  { month: "Mar", propostas: 21, vendas: 8, receita: 215 },
  { month: "Abr", propostas: 29, vendas: 13, receita: 330 },
  { month: "Mai", propostas: 34, vendas: 16, receita: 420 },
  { month: "Jun", propostas: 31, vendas: 14, receita: 390 },
];

const loadData = [
  { component: "Produto", kcal: 19710 },
  { component: "Infiltração", kcal: 5382 },
  { component: "Transmissão", kcal: 824 },
  { component: "Degelo", kcal: 488 },
  { component: "Motores", kcal: 860 },
];

const radarData = [
  { subject: "Preço", atual: 82, meta: 75 },
  { subject: "Prazo", atual: 68, meta: 80 },
  { subject: "Margem", atual: 74, meta: 78 },
  { subject: "Conversão", atual: 61, meta: 70 },
  { subject: "Follow-up", atual: 88, meta: 82 },
];

const nivoPieData = funnelData.map((item) => ({ id: item.name, label: item.name, value: item.value }));
const nivoLineData = [
  { id: "Receita", data: monthData.map((item) => ({ x: item.month, y: item.receita })) },
  { id: "Vendas", data: monthData.map((item) => ({ x: item.month, y: item.vendas * 20 })) },
];

function ReportsPage() {
  const chartJsData = {
    labels: monthData.map((item) => item.month),
    datasets: [
      { label: "Propostas", data: monthData.map((item) => item.propostas), backgroundColor: chartHex[0] },
      { label: "Vendas", data: monthData.map((item) => item.vendas), backgroundColor: chartHex[1] },
    ],
  };

  const doughnutData = {
    labels: funnelData.map((item) => item.name),
    datasets: [{ data: funnelData.map((item) => item.value), backgroundColor: chartHex }],
  };

  const echartsOption = {
    color: chartHex,
    tooltip: { trigger: "axis" },
    legend: { data: ["Propostas", "Receita"] },
    xAxis: { type: "category", data: monthData.map((item) => item.month) },
    yAxis: [{ type: "value" }, { type: "value" }],
    series: [
      { name: "Propostas", type: "bar", data: monthData.map((item) => item.propostas) },
      { name: "Receita", type: "line", yAxisIndex: 1, data: monthData.map((item) => item.receita) },
    ],
  };

  return (
    <>
      <PageHeader title="Relatórios & Analytics" subtitle="Bibliotecas de gráficos instaladas e prontas para relatórios comerciais, Nomus, CRM e ColdPro." />
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <Kpi icon={<FileBarChart className="h-5 w-5" />} label="Bibliotecas" value="5" detail="Recharts, Chart.js, ECharts, Nivo e Tremor" />
          <Kpi icon={<PieChart className="h-5 w-5" />} label="Tipos base" value="9" detail="Pizza, barras, linha, área, radar e KPIs" />
          <Kpi icon={<TrendingUp className="h-5 w-5" />} label="Uso recomendado" value="Recharts" detail="Padrão leve para relatórios internos" />
          <Kpi icon={<Users className="h-5 w-5" />} label="Pronto para" value="CRM" detail="Funil, propostas, vendas e clientes" />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Recharts — barras, pizza, linha, área e radar" description="Opção padrão recomendada para dashboards do sistema.">
            <div className="grid gap-4 lg:grid-cols-2">
              <MiniChart><ResponsiveContainer><BarChart data={monthData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="propostas" fill="var(--chart-1)" /><Bar dataKey="vendas" fill="var(--chart-2)" /></BarChart></ResponsiveContainer></MiniChart>
              <MiniChart><ResponsiveContainer><RePieChart><Pie data={funnelData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78}>{funnelData.map((_, i) => <Cell key={i} fill={chartVars[i % chartVars.length]} />)}</Pie><Tooltip /><Legend /></RePieChart></ResponsiveContainer></MiniChart>
              <MiniChart><ResponsiveContainer><LineChart data={monthData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Line type="monotone" dataKey="receita" stroke="var(--chart-1)" strokeWidth={2} /></LineChart></ResponsiveContainer></MiniChart>
              <MiniChart><ResponsiveContainer><RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="subject" /><Radar dataKey="atual" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} /></RadarChart></ResponsiveContainer></MiniChart>
            </div>
          </ChartCard>

          <ChartCard title="Chart.js — gráficos clássicos" description="Boa alternativa para visual tradicional em relatórios gerenciais.">
            <div className="grid gap-4 lg:grid-cols-2">
              <MiniChart><ChartBar data={chartJsData} options={{ maintainAspectRatio: false, responsive: true }} /></MiniChart>
              <MiniChart><Doughnut data={doughnutData} options={{ maintainAspectRatio: false, responsive: true }} /></MiniChart>
              <div className="lg:col-span-2"><MiniChart><ChartLine data={{ labels: monthData.map((item) => item.month), datasets: [{ label: "Receita", data: monthData.map((item) => item.receita), borderColor: chartHex[0], backgroundColor: chartHex[0] }] }} options={{ maintainAspectRatio: false, responsive: true }} /></MiniChart></div>
            </div>
          </ChartCard>

          <ChartCard title="ECharts — BI avançado" description="Mais poderoso para dashboards densos, zoom, combinações e análises grandes.">
            <div className="h-[360px]"><ReactECharts option={echartsOption} style={{ height: "100%", width: "100%" }} /></div>
          </ChartCard>

          <ChartCard title="Nivo — visual premium" description="Boa opção para relatórios visuais com rosca, barras e linhas responsivas.">
            <div className="grid gap-4 lg:grid-cols-2">
              <MiniChart><ResponsivePie data={nivoPieData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }} innerRadius={0.55} padAngle={1} colors={chartHex} enableArcLinkLabels={false} /></MiniChart>
              <MiniChart><ResponsiveBar data={loadData} keys={["kcal"]} indexBy="component" margin={{ top: 20, right: 20, bottom: 70, left: 56 }} colors={[chartHex[0]]} axisBottom={{ tickRotation: -35 }} /></MiniChart>
              <div className="lg:col-span-2"><MiniChart><ResponsiveLine data={nivoLineData} margin={{ top: 20, right: 20, bottom: 50, left: 50 }} colors={chartHex} axisBottom={{ tickRotation: 0 }} enablePoints /></MiniChart></div>
            </div>
          </ChartCard>

          <ChartCard title="Tremor — componentes rápidos de dashboard" description="Cards, listas e gráficos prontos para relatórios executivos.">
            <div className="grid gap-4 lg:grid-cols-2">
              <TremorCard><Text>Receita prevista</Text><Metric>R$ 420 mil</Metric><Text>Pipeline ativo no funil</Text></TremorCard>
              <TremorCard><Text>Distribuição por etapa</Text><DonutChart data={funnelData} category="value" index="name" colors={["blue", "teal", "amber", "purple", "rose"]} className="mt-4 h-40" /></TremorCard>
              <TremorCard><Text>Top etapas</Text><BarList data={funnelData.map((item) => ({ name: item.name, value: item.amount }))} className="mt-4" /></TremorCard>
              <TremorCard><Text>Evolução</Text><TremorAreaChart data={monthData} index="month" categories={["receita"]} colors={["blue"]} className="mt-4 h-44" /></TremorCard>
            </div>
          </ChartCard>
        </section>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="rounded-xl border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between text-muted-foreground"><span className="text-xs font-medium uppercase tracking-wide">{label}</span>{icon}</div><div className="text-2xl font-semibold">{value}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-4 shadow-sm"><div className="mb-4"><h2 className="text-base font-semibold">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>{children}</section>;
}

function MiniChart({ children }: { children: React.ReactNode }) {
  return <div className="h-64 min-w-0 rounded-lg border bg-background p-3">{children}</div>;
}