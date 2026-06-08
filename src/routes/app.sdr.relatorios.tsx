import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart2, Flame, PieChart as PieIcon, ListChecks, ArrowUpRight } from "lucide-react";
import { CoberturaCarteira } from "@/modules/crm/components/CoberturaCarteira";

export const Route = createFileRoute("/app/sdr/relatorios")({
  component: SdrRelatoriosPage,
});

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function weekStartISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

async function fetchVisaoGeral() {
  const [leadsActive, leadsHot, callsWeek, callsToday] = await Promise.all([
    supabase.from("sdr_leads").select("id", { count: "exact", head: true }).not("locked_by_sdr_id", "is", null),
    supabase.from("sdr_leads").select("id", { count: "exact", head: true }).in("temperature", ["Quente", "Muito Quente"]),
    supabase.from("crm_call_logs").select("id", { count: "exact", head: true }).gte("call_date", weekStartISO()),
    supabase.from("crm_call_logs").select("id", { count: "exact", head: true }).eq("call_date", todayISO()),
  ]);
  return {
    leadsAtivos: leadsActive.count ?? 0,
    hotLeads: leadsHot.count ?? 0,
    ligacoesSemana: callsWeek.count ?? 0,
    ligacoesHoje: callsToday.count ?? 0,
  };
}

async function fetchFunil() {
  const { data } = await supabase.from("sdr_leads").select("sdr_status");
  const counts: Record<string, number> = {};
  for (const r of data ?? []) {
    const k = (r as any).sdr_status || "Sem status";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function VisaoGeralTab() {
  const { data, isLoading } = useQuery({ queryKey: ["sdr-relatorios-visao"], queryFn: fetchVisaoGeral });
  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiCard label="Leads ativos (carteira)" value={data.leadsAtivos} hint="Travados por algum SDR" />
        <KpiCard label="Hot Leads" value={data.hotLeads} hint="Quente + Muito Quente" />
        <KpiCard label="Ligações hoje" value={data.ligacoesHoje} />
        <KpiCard label="Ligações últimos 7 dias" value={data.ligacoesSemana} />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link to="/app/sdr/sdr-performance" className="contents">
          <Card className="cursor-pointer transition hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 font-semibold"><BarChart2 className="h-4 w-4" /> Desempenho dos SDRs</div>
                <p className="mt-1 text-xs text-muted-foreground">Metas, ligações, reuniões e hot leads por SDR</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/app/sdr/hot-deals" className="contents">
          <Card className="cursor-pointer transition hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 font-semibold"><Flame className="h-4 w-4" /> Hot Leads</div>
                <p className="mt-1 text-xs text-muted-foreground">Leads urgentes e críticos para abordagem</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/app/gestao/auditoria-sdr" className="contents">
          <Card className="cursor-pointer transition hover:shadow-md">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="flex items-center gap-2 font-semibold"><ListChecks className="h-4 w-4" /> Auditoria SDR</div>
                <p className="mt-1 text-xs text-muted-foreground">Tentativas, padrões e bloqueios</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function FunilTab() {
  const { data, isLoading } = useQuery({ queryKey: ["sdr-relatorios-funil"], queryFn: fetchFunil });
  const total = useMemo(() => (data ?? []).reduce((s, r) => s + r.count, 0), [data]);
  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sem dados de funil ainda.</p>;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Distribuição por status SDR</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.map((row) => {
          const pct = total ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.status} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{row.status}</span>
                <span className="text-muted-foreground">{row.count} ({pct}%)</span>
              </div>
              <div className="h-2 w-full rounded bg-secondary">
                <div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SdrRelatoriosPage() {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Relatórios SDR</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada da pré-venda: cobertura, desempenho, hot leads e funil.</p>
      </div>
      <Tabs defaultValue="visao" className="w-full">
        <TabsList>
          <TabsTrigger value="visao"><BarChart2 className="mr-1 h-4 w-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="cobertura"><PieIcon className="mr-1 h-4 w-4" />Cobertura</TabsTrigger>
          <TabsTrigger value="funil"><ListChecks className="mr-1 h-4 w-4" />Funil Pré-Venda</TabsTrigger>
          <TabsTrigger value="atalhos">Páginas completas</TabsTrigger>
        </TabsList>
        <TabsContent value="visao" className="mt-4"><VisaoGeralTab /></TabsContent>
        <TabsContent value="cobertura" className="mt-4"><CoberturaCarteira /></TabsContent>
        <TabsContent value="funil" className="mt-4"><FunilTab /></TabsContent>
        <TabsContent value="atalhos" className="mt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Button asChild variant="outline"><Link to="/app/sdr/sdr-performance">Desempenho dos SDRs</Link></Button>
            <Button asChild variant="outline"><Link to="/app/sdr/hot-deals">Hot Leads</Link></Button>
            <Button asChild variant="outline"><Link to="/app/cobertura">Cobertura de Carteira</Link></Button>
            <Button asChild variant="outline"><Link to="/app/sdr/war-room">War Room</Link></Button>
            <Button asChild variant="outline"><Link to="/app/sdr/bank">Banco de Leads</Link></Button>
            <Button asChild variant="outline"><Link to="/app/sdr/wallet">Minha Carteira (SDR)</Link></Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
