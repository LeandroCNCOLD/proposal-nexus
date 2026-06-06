import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { FileText, Database, Flame, DollarSign, Layers, Thermometer } from "lucide-react";

export const Route = createFileRoute("/app/dashboard-geral")({
  component: DashboardGeral,
});

type Proposal = {
  id: string; title: string; status: string; temperature: string | null;
  total_value: number | null; closed_value: number | null; created_at: string;
  closed_at: string | null;
};
type Lead = {
  id: string; lead_code: string; client_name: string; sdr_status: string;
  temperature: string; priority: string; value: number; created_at: string;
  state: string | null; sdr_name: string | null; closer_name: string | null;
  last_contact_at: string | null; next_contact_at: string | null;
  meeting_scheduled: boolean | null; meeting_date: string | null;
  expected_closing: string | null; probability_pct: number | null;
};

const TEMP_COLORS: Record<string, string> = {
  "Frio": "hsl(210 80% 55%)",
  "Morno": "hsl(40 90% 55%)",
  "Quente": "hsl(20 85% 55%)",
  "Muito Quente": "hsl(0 80% 55%)",
};
const PROP_TEMP_MAP: Record<string, string> = {
  fria: "Frio", morna: "Morno", quente: "Quente", muito_quente: "Muito Quente",
};

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgoISO(d: number) {
  const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10);
}

function DashboardGeral() {
  const [allTime, setAllTime] = useState(true);
  const [start, setStart] = useState(daysAgoISO(90));
  const [end, setEnd] = useState(todayISO());

  const setPreset = (days: number) => {
    setAllTime(false);
    setStart(daysAgoISO(days)); setEnd(todayISO());
  };

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-geral", allTime ? "all" : `${start}|${end}`],
    queryFn: async () => {
      let propQ = supabase.from("proposals")
        .select("id,title,status,temperature,total_value,closed_value,created_at,closed_at")
        .eq("is_active", true);
      let leadQ = supabase.from("sdr_leads")
        .select("id,lead_code,client_name,sdr_status,temperature,priority,value,created_at,state,sdr_name,closer_name,last_contact_at,next_contact_at,meeting_scheduled,meeting_date,expected_closing,probability_pct");
      if (!allTime) {
        const startISO = `${start}T00:00:00`;
        const endISO = `${end}T23:59:59`;
        propQ = propQ.gte("created_at", startISO).lte("created_at", endISO);
        leadQ = leadQ.gte("created_at", startISO).lte("created_at", endISO);
      }
      const [props, leads] = await Promise.all([
        propQ.limit(5000),
        leadQ.limit(5000),
      ]);
      if (props.error) throw props.error;
      if (leads.error) throw leads.error;
      return { proposals: (props.data ?? []) as Proposal[], leads: (leads.data ?? []) as Lead[] };
    },
  });


  const proposals = data?.proposals ?? [];
  const leads = data?.leads ?? [];

  const stats = useMemo(() => {
    const totalPropValue = proposals.reduce((s, p) => s + Number(p.total_value ?? 0), 0);
    const wonValue = proposals.filter(p => p.status === "ganha")
      .reduce((s, p) => s + Number(p.closed_value ?? p.total_value ?? 0), 0);
    const lostValue = proposals.filter(p => p.status === "perdida")
      .reduce((s, p) => s + Number(p.total_value ?? 0), 0);
    const wonCount = proposals.filter(p => p.status === "ganha").length;
    const winRate = proposals.length ? Math.round((wonCount / proposals.length) * 100) : 0;
    const totalLeadValue = leads.reduce((s, l) => s + Number(l.value ?? 0), 0);
    const hotLeads = leads.filter(l => l.temperature === "Quente" || l.temperature === "Muito Quente").length;
    return { totalPropValue, wonValue, lostValue, wonCount, winRate, totalLeadValue, hotLeads };
  }, [proposals, leads]);

  const tempData = useMemo(() => {
    const buckets: Record<string, { temperature: string; leads: number; propostas: number; valorLeads: number; valorPropostas: number }> = {};
    const ensure = (t: string) => buckets[t] ??= { temperature: t, leads: 0, propostas: 0, valorLeads: 0, valorPropostas: 0 };
    for (const l of leads) {
      const b = ensure(l.temperature || "Morno");
      b.leads++; b.valorLeads += Number(l.value ?? 0);
    }
    for (const p of proposals) {
      const t = PROP_TEMP_MAP[p.temperature ?? "morna"] ?? "Morno";
      const b = ensure(t);
      b.propostas++; b.valorPropostas += Number(p.total_value ?? 0);
    }
    return ["Frio", "Morno", "Quente", "Muito Quente"].map(t => buckets[t] ?? ensure(t));
  }, [proposals, leads]);

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of proposals) map.set(p.status, (map.get(p.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [proposals]);

  const sdrStatusData = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const l of leads) {
      const cur = map.get(l.sdr_status) ?? { count: 0, value: 0 };
      cur.count++; cur.value += Number(l.value ?? 0);
      map.set(l.sdr_status, cur);
    }
    return Array.from(map.entries()).map(([status, v]) => ({ status, ...v }))
      .sort((a, b) => b.count - a.count);
  }, [leads]);

  const priorityData = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const l of leads) {
      const k = l.priority || "—";
      const cur = map.get(k) ?? { count: 0, value: 0 };
      cur.count++; cur.value += Number(l.value ?? 0);
      map.set(k, cur);
    }
    return ["Alta", "Média", "Baixa", "—"]
      .filter(k => map.has(k))
      .map(k => ({ priority: k, ...(map.get(k)!) }));
  }, [leads]);

  const stateData = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const l of leads) {
      const k = (l.state || "—").trim() || "—";
      const cur = map.get(k) ?? { count: 0, value: 0 };
      cur.count++; cur.value += Number(l.value ?? 0);
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([state, v]) => ({ state, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [leads]);

  const sdrRanking = useMemo(() => {
    const map = new Map<string, { count: number; value: number; hot: number; meetings: number }>();
    for (const l of leads) {
      const k = l.sdr_name || "Sem SDR";
      const cur = map.get(k) ?? { count: 0, value: 0, hot: 0, meetings: 0 };
      cur.count++; cur.value += Number(l.value ?? 0);
      if (l.temperature === "Quente" || l.temperature === "Muito Quente") cur.hot++;
      if (l.meeting_scheduled) cur.meetings++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([sdr, v]) => ({ sdr, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [leads]);

  const followupData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = { semContato: 0, atrasado: 0, hoje: 0, futuro: 0, agendado: 0 };
    for (const l of leads) {
      if (l.meeting_scheduled) buckets.agendado++;
      if (!l.last_contact_at && !l.next_contact_at) { buckets.semContato++; continue; }
      if (l.next_contact_at) {
        const d = new Date(l.next_contact_at); d.setHours(0, 0, 0, 0);
        const diff = (d.getTime() - today.getTime()) / 86400000;
        if (diff < 0) buckets.atrasado++;
        else if (diff === 0) buckets.hoje++;
        else buckets.futuro++;
      }
    }
    return [
      { label: "Sem contato", value: buckets.semContato, color: "hsl(220 10% 60%)" },
      { label: "Follow-up atrasado", value: buckets.atrasado, color: "hsl(0 80% 55%)" },
      { label: "Follow-up hoje", value: buckets.hoje, color: "hsl(40 90% 55%)" },
      { label: "Follow-up futuro", value: buckets.futuro, color: "hsl(140 60% 45%)" },
      { label: "Reunião agendada", value: buckets.agendado, color: "hsl(210 80% 55%)" },
    ];
  }, [leads]);

  const ageData = useMemo(() => {
    const today = new Date();
    const buckets = [
      { label: "0-7 dias", min: 0, max: 7, count: 0, value: 0 },
      { label: "8-30 dias", min: 8, max: 30, count: 0, value: 0 },
      { label: "31-90 dias", min: 31, max: 90, count: 0, value: 0 },
      { label: "90+ dias", min: 91, max: 99999, count: 0, value: 0 },
    ];
    for (const l of leads) {
      const days = Math.floor((today.getTime() - new Date(l.created_at).getTime()) / 86400000);
      const b = buckets.find(b => days >= b.min && days <= b.max);
      if (b) { b.count++; b.value += Number(l.value ?? 0); }
    }
    return buckets;
  }, [leads]);

  const PIE_COLORS = ["Frio","Morno","Quente","Muito Quente"].map(k => TEMP_COLORS[k]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Geral</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de Propostas Nomus + Banco de Leads SDR.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={start} disabled={allTime} onChange={e => { setAllTime(false); setStart(e.target.value); }} className="h-8 w-[140px]" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={end} disabled={allTime} onChange={e => { setAllTime(false); setEnd(e.target.value); }} className="h-8 w-[140px]" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={allTime ? "default" : "outline"} onClick={() => setAllTime(true)}>Tudo</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(7)}>7d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(30)}>30d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(90)}>90d</Button>
            <Button size="sm" variant="outline" onClick={() => setPreset(365)}>1a</Button>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Propostas" value={proposals.length} icon={<FileText className="h-4 w-4" />} accent="primary" />
        <StatCard label="Valor Propostas" value={fmtBRL(stats.totalPropValue)} icon={<DollarSign className="h-4 w-4" />} accent="primary" />
        <StatCard label="Ganhas" value={stats.wonCount} hint={`${stats.winRate}% conversão`} icon={<Layers className="h-4 w-4" />} accent="success" />
        <StatCard label="Valor Ganho" value={fmtBRL(stats.wonValue)} accent="success" />
        <StatCard label="Leads SDR" value={leads.length} icon={<Database className="h-4 w-4" />} accent="info" />
        <StatCard label="Valor Leads" value={fmtBRL(stats.totalLeadValue)} icon={<DollarSign className="h-4 w-4" />} accent="info" />
        <StatCard label="Leads Quentes" value={stats.hotLeads} icon={<Flame className="h-4 w-4" />} accent="destructive" />
      </div>

      <Tabs defaultValue="temperatura" className="space-y-3">
        <TabsList>
          <TabsTrigger value="temperatura"><Thermometer className="mr-1 h-3.5 w-3.5" />Temperatura</TabsTrigger>
          <TabsTrigger value="propostas">Propostas</TabsTrigger>
          <TabsTrigger value="leads">Banco de Leads</TabsTrigger>
        </TabsList>

        <TabsContent value="temperatura" className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Quantidade por Temperatura</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="temperature" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="leads" fill="hsl(210 80% 55%)" name="Leads SDR" />
                    <Bar dataKey="propostas" fill="hsl(265 75% 60%)" name="Propostas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Valor (R$) por Temperatura</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tempData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="temperature" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="valorLeads" fill="hsl(210 80% 55%)" name="Leads SDR" />
                    <Bar dataKey="valorPropostas" fill="hsl(265 75% 60%)" name="Propostas" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribuição de Leads</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tempData} dataKey="leads" nameKey="temperature" outerRadius={90} label={(e: any) => `${e.temperature}: ${e.leads}`}>
                      {tempData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribuição de Propostas</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tempData} dataKey="propostas" nameKey="temperature" outerRadius={90} label={(e: any) => `${e.temperature}: ${e.propostas}`}>
                      {tempData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="propostas" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Propostas por Status</CardTitle>
              <Button asChild size="sm" variant="outline"><Link to="/app/propostas">Ver todas</Link></Button>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumo Financeiro</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Pipeline Total" value={fmtBRL(stats.totalPropValue)} />
              <StatCard label="Ganho" value={fmtBRL(stats.wonValue)} accent="success" />
              <StatCard label="Perdido" value={fmtBRL(stats.lostValue)} accent="destructive" />
              <StatCard label="Taxa de Ganho" value={`${stats.winRate}%`} hint={`${stats.wonCount} de ${proposals.length}`} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Leads por Status SDR</CardTitle>
              <Button asChild size="sm" variant="outline"><Link to="/app/sdr/bank">Ver banco</Link></Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {sdrStatusData.map(s => (
                  <div key={s.status} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{s.count}</Badge>
                      <span>{s.status}</span>
                    </div>
                    <span className="tabular-nums text-muted-foreground">{fmtBRL(s.value)}</span>
                  </div>
                ))}
                {!sdrStatusData.length && <div className="py-8 text-center text-sm text-muted-foreground">Sem leads no período.</div>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {isLoading && <div className="text-center text-sm text-muted-foreground">Carregando…</div>}
    </div>
  );
}
