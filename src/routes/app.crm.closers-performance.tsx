import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BarChart3, Target, Trophy, TrendingUp, Calendar, FileText,
  CheckCircle2, DollarSign, Pencil, Award, Users,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell,
} from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import {
  fetchClosersPerfData,
  monthStartISO,
  pct,
  type Meta,
} from "@/lib/closers-performance-data";

export const Route = createFileRoute("/app/crm/closers-performance")({
  component: ClosersPerformancePage,
});

// ============== component ==============
function ClosersPerformancePage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(monthStartISO());
  const [selectedCloser, setSelectedCloser] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["closers-perf", mes],
    queryFn: () => fetchClosersPerfData(mes),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // monta lista de closers a partir de roles=vendedor + agenda + propostas
  const closers = useMemo(() => {
    if (!data) return [] as { nome: string; userId: string | null }[];
    const map = new Map<string, { nome: string; userId: string | null }>();
    data.profiles.forEach((p) => {
      if (data.closerIds.has(p.id) && p.full_name) {
        map.set(p.full_name, { nome: p.full_name, userId: p.id });
      }
    });
    data.agenda.forEach((a) => {
      if (a.closer_nome && !map.has(a.closer_nome)) {
        map.set(a.closer_nome, { nome: a.closer_nome, userId: null });
      }
    });
    data.proposals.forEach((p) => {
      const nome = p.nomus_seller_name?.trim();
      if (nome && !map.has(nome)) {
        map.set(nome, { nome, userId: p.sales_owner_id ?? null });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  // agregação por closer
  const stats = useMemo(() => {
    if (!data) return [];
    return closers.map((c) => {
      const ag = data.agenda.filter((x) => x.closer_nome === c.nome);
      const reunioes = ag.length;
      const realizadas = ag.filter((x) => x.status === "Realizado").length;
      const noShow = ag.filter((x) => x.status === "Cliente não compareceu").length;

      const props = data.proposals.filter(
        (p) =>
          (c.userId && p.sales_owner_id === c.userId) ||
          (p.nomus_seller_name && p.nomus_seller_name === c.nome),
      );
      const propostas = props.length;
      const ganhas = props.filter((p) => p.status === "ganha").length;
      const perdidas = props.filter((p) => p.status === "perdida").length;
      const receita = props
        .filter((p) => p.status === "ganha")
        .reduce((s, p) => s + Number(p.closed_value ?? p.total_value ?? 0), 0);
      const ticketMedio = ganhas > 0 ? receita / ganhas : 0;

      const meta = data.metas.find((m) => m.closer_nome === c.nome);

      return {
        ...c,
        reunioes,
        realizadas,
        noShow,
        propostas,
        ganhas,
        perdidas,
        receita,
        ticketMedio,
        conversao: pct(ganhas, propostas),
        showRate: pct(realizadas, reunioes),
        meta,
      };
    });
  }, [data, closers]);

  // filtro de acesso: closer só vê o seu, gestor vê tudo (sem role local — RLS protege escrita)
  const visibleStats = useMemo(() => {
    if (!data?.me) return stats;
    const myProfile = data.profiles.find((p) => p.id === data.me);
    const isManagerLike = !data.closerIds.has(data.me);
    if (isManagerLike) return stats;
    return stats.filter((s) => s.userId === data.me || s.nome === myProfile?.full_name);
  }, [stats, data]);

  const totals = useMemo(() => {
    return visibleStats.reduce(
      (acc, s) => ({
        reunioes: acc.reunioes + s.reunioes,
        propostas: acc.propostas + s.propostas,
        ganhas: acc.ganhas + s.ganhas,
        receita: acc.receita + s.receita,
      }),
      { reunioes: 0, propostas: 0, ganhas: 0, receita: 0 },
    );
  }, [visibleStats]);

  const ranking = useMemo(() => [...visibleStats].sort((a, b) => b.receita - a.receita), [visibleStats]);
  const detail = selectedCloser ? visibleStats.find((s) => s.nome === selectedCloser) : null;

  // mutation: salvar meta
  const saveMeta = useMutation({
    mutationFn: async (payload: {
      closer_nome: string;
      user_id: string | null;
      meta_reunioes: number;
      meta_propostas: number;
      meta_ganhas: number;
      meta_receita: number;
    }) => {
      const { error: err } = await supabase
        .from("crm_closer_metas")
        .upsert(
          { ...payload, mes },
          { onConflict: "closer_nome,mes" },
        );
      if (err) throw err;
    },
    onSuccess: () => {
      toast.success("Meta salva");
      qc.invalidateQueries({ queryKey: ["closers-perf"] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" /> Desempenho dos Closers
          </h1>
          <p className="text-sm text-muted-foreground">
            Métricas, ranking, funil de conversão e metas mensais
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-xs">Mês de referência</Label>
            <Input
              type="month"
              value={mes.slice(0, 7)}
              onChange={(e) => setMes(`${e.target.value}-01`)}
              className="h-9 w-44"
            />
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 text-red-800 text-sm">
            Erro ao carregar dados: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* KPIs consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Calendar} label="Reuniões" value={totals.reunioes} color="bg-blue-100 text-blue-700" />
        <Kpi icon={FileText} label="Propostas" value={totals.propostas} color="bg-violet-100 text-violet-700" />
        <Kpi icon={CheckCircle2} label="Ganhas" value={totals.ganhas} color="bg-green-100 text-green-700" />
        <Kpi icon={DollarSign} label="Receita" value={brl(totals.receita)} color="bg-amber-100 text-amber-700" />
      </div>

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList>
          <TabsTrigger value="ranking"><Trophy className="h-4 w-4 mr-1" /> Ranking</TabsTrigger>
          <TabsTrigger value="funil"><BarChart3 className="h-4 w-4 mr-1" /> Funil</TabsTrigger>
          <TabsTrigger value="metas"><Target className="h-4 w-4 mr-1" /> Metas</TabsTrigger>
        </TabsList>

        {/* RANKING */}
        <TabsContent value="ranking" className="space-y-4 mt-4">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="text-base">Receita por Closer</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={ranking}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="nome" />
                      <YAxis />
                      <Tooltip formatter={(v: number) => brl(v)} />
                      <Bar dataKey="receita" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Ranking detalhado</CardTitle></CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="p-3">#</th>
                        <th className="p-3">Closer</th>
                        <th className="p-3 text-right">Reuniões</th>
                        <th className="p-3 text-right">Show-rate</th>
                        <th className="p-3 text-right">Propostas</th>
                        <th className="p-3 text-right">Ganhas</th>
                        <th className="p-3 text-right">Conv. %</th>
                        <th className="p-3 text-right">Ticket Médio</th>
                        <th className="p-3 text-right">Receita</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((s, i) => (
                        <tr key={s.nome} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            {i === 0 && <Award className="h-4 w-4 text-amber-500 inline" />}
                            {i > 0 && <span className="text-muted-foreground">{i + 1}</span>}
                          </td>
                          <td className="p-3 font-medium">{s.nome}</td>
                          <td className="p-3 text-right">{s.reunioes}</td>
                          <td className="p-3 text-right">
                            <Badge variant={s.showRate >= 70 ? "default" : "secondary"}>{s.showRate}%</Badge>
                          </td>
                          <td className="p-3 text-right">{s.propostas}</td>
                          <td className="p-3 text-right text-green-700 font-semibold">{s.ganhas}</td>
                          <td className="p-3 text-right">
                            <Badge variant={s.conversao >= 30 ? "default" : "secondary"}>{s.conversao}%</Badge>
                          </td>
                          <td className="p-3 text-right">{brl(s.ticketMedio)}</td>
                          <td className="p-3 text-right font-bold text-blue-700">{brl(s.receita)}</td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedCloser(s.nome)}>
                              Detalhe
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {ranking.length === 0 && (
                        <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* FUNIL */}
        <TabsContent value="funil" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {visibleStats.map((s) => {
              const funnelData = [
                { name: "Reuniões", value: s.reunioes || 0, fill: "#3b82f6" },
                { name: "Realizadas", value: s.realizadas || 0, fill: "#8b5cf6" },
                { name: "Propostas", value: s.propostas || 0, fill: "#f59e0b" },
                { name: "Ganhas", value: s.ganhas || 0, fill: "#10b981" },
              ].filter((d) => d.value > 0);
              return (
                <Card key={s.nome}>
                  <CardHeader><CardTitle className="text-base">{s.nome}</CardTitle></CardHeader>
                  <CardContent>
                    {funnelData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <FunnelChart>
                          <Tooltip />
                          <Funnel dataKey="value" data={funnelData} isAnimationActive>
                            <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                            {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Funnel>
                        </FunnelChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">Sem dados</div>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs mt-2 pt-2 border-t">
                      <div><div className="text-muted-foreground">Show-rate</div><div className="font-semibold">{s.showRate}%</div></div>
                      <div><div className="text-muted-foreground">Conversão</div><div className="font-semibold">{s.conversao}%</div></div>
                      <div><div className="text-muted-foreground">No-show</div><div className="font-semibold">{s.noShow}</div></div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* METAS */}
        <TabsContent value="metas" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-3">
            {visibleStats.map((s) => (
              <MetaCard key={s.nome} stat={s} onSave={(payload) => saveMeta.mutate(payload)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detalhe individual */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setSelectedCloser(null)}>
        <DialogContent className="max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> {detail.nome}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Kpi icon={Calendar} label="Reuniões" value={detail.reunioes} color="bg-blue-100 text-blue-700" />
                  <Kpi icon={FileText} label="Propostas" value={detail.propostas} color="bg-violet-100 text-violet-700" />
                  <Kpi icon={CheckCircle2} label="Ganhas" value={detail.ganhas} color="bg-green-100 text-green-700" />
                  <Kpi icon={DollarSign} label="Receita" value={brl(detail.receita)} color="bg-amber-100 text-amber-700" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Row label="Reuniões realizadas" value={`${detail.realizadas} (${detail.showRate}%)`} />
                  <Row label="Cliente não compareceu" value={String(detail.noShow)} />
                  <Row label="Propostas perdidas" value={String(detail.perdidas)} />
                  <Row label="Taxa de conversão" value={`${detail.conversao}%`} />
                  <Row label="Ticket médio" value={brl(detail.ticketMedio)} />
                </div>
                {detail.meta && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4"/> Metas do mês</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <GoalLine label="Reuniões" current={detail.reunioes} target={detail.meta.meta_reunioes} />
                      <GoalLine label="Propostas" current={detail.propostas} target={detail.meta.meta_propostas} />
                      <GoalLine label="Ganhas" current={detail.ganhas} target={detail.meta.meta_ganhas} />
                      <GoalLine label="Receita" current={detail.receita} target={detail.meta.meta_receita} money />
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============== sub components ==============
function Kpi({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg grid place-items-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function GoalLine({ label, current, target, money }: { label: string; current: number; target: number; money?: boolean }) {
  const p = pct(current, target);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">
          {money ? brl(current) : current} / {money ? brl(target) : target} ({p}%)
        </span>
      </div>
      <Progress value={Math.min(p, 100)} className="h-1.5" />
    </div>
  );
}

function MetaCard({
  stat,
  onSave,
}: {
  stat: ReturnType<typeof Object> & { nome: string; userId: string | null; meta?: Meta; reunioes: number; propostas: number; ganhas: number; receita: number };
  onSave: (p: { closer_nome: string; user_id: string | null; meta_reunioes: number; meta_propostas: number; meta_ganhas: number; meta_receita: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mr, setMr] = useState(stat.meta?.meta_reunioes ?? 0);
  const [mp, setMp] = useState(stat.meta?.meta_propostas ?? 0);
  const [mg, setMg] = useState(stat.meta?.meta_ganhas ?? 0);
  const [mrc, setMrc] = useState(Number(stat.meta?.meta_receita ?? 0));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{stat.nome}</span>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost"><Pencil className="h-3 w-3 mr-1" /> Editar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Metas — {stat.nome}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Meta de Reuniões" value={mr} onChange={setMr} />
                <Field label="Meta de Propostas" value={mp} onChange={setMp} />
                <Field label="Meta de Ganhas" value={mg} onChange={setMg} />
                <Field label="Meta de Receita (R$)" value={mrc} onChange={setMrc} step="0.01" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => {
                  onSave({ closer_nome: stat.nome, user_id: stat.userId, meta_reunioes: mr, meta_propostas: mp, meta_ganhas: mg, meta_receita: mrc });
                  setOpen(false);
                }}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <GoalLine label="Reuniões" current={stat.reunioes} target={stat.meta?.meta_reunioes ?? 0} />
        <GoalLine label="Propostas" current={stat.propostas} target={stat.meta?.meta_propostas ?? 0} />
        <GoalLine label="Ganhas" current={stat.ganhas} target={stat.meta?.meta_ganhas ?? 0} />
        <GoalLine label="Receita" current={stat.receita} target={Number(stat.meta?.meta_receita ?? 0)} money />
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={step ?? "1"} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
