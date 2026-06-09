import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckSquare, ListChecks, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { dateBR } from "@/lib/format";

export const Route = createFileRoute("/app/produtividade")({ component: ProdutividadePage });

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function endOfToday() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}
function endOfWeek() {
  const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(23, 59, 59, 999); return d;
}

function ProdutividadePage() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data: tasks = [] } = useQuery({
    queryKey: ["prod-tasks", uid],
    queryFn: async () =>
      (await supabase
        .from("proposal_tasks")
        .select("*, proposals(id, number, title)")
        .order("due_date", { ascending: true, nullsFirst: false })).data ?? [],
    enabled: !!uid,
  });

  const { data: agenda = [] } = useQuery({
    queryKey: ["prod-agenda", uid],
    queryFn: async () => {
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = endOfWeek();
      return (await supabase
        .from("crm_agenda")
        .select("*")
        .gte("data_hora", from.toISOString())
        .lte("data_hora", to.toISOString())
        .order("data_hora", { ascending: true })).data ?? [];
    },
    enabled: !!uid,
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["prod-ativ", uid],
    queryFn: async () =>
      (await supabase
        .from("crm_activities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)).data ?? [],
    enabled: !!uid,
  });

  const now = new Date();
  const tStart = startOfToday().getTime();
  const tEnd = endOfToday().getTime();

  const pendentes = tasks.filter((t: any) => t.status !== "concluida");
  const atrasadas = pendentes.filter((t: any) => t.due_date && new Date(t.due_date).getTime() < tStart);
  const hoje = pendentes.filter((t: any) => t.due_date && new Date(t.due_date).getTime() >= tStart && new Date(t.due_date).getTime() <= tEnd);
  const proximas = pendentes.filter((t: any) => !t.due_date || new Date(t.due_date).getTime() > tEnd);

  const reunHoje = agenda.filter((a: any) => {
    const d = new Date(a.data_hora).getTime();
    return d >= tStart && d <= tEnd;
  });
  const reunSemana = agenda.filter((a: any) => new Date(a.data_hora).getTime() > tEnd);

  const ativHoje = atividades.filter((a: any) => new Date(a.created_at).getTime() >= tStart);

  return (
    <div className="space-y-4 p-3">
      <PageHeader
        title="Painel de Produtividade"
        subtitle="Visão consolidada de agenda, tarefas e atividades — gestão de tempo e foco"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Atrasadas" value={atrasadas.length} icon={AlertCircle} tone="danger" />
        <KpiCard label="Tarefas hoje" value={hoje.length} icon={CheckSquare} tone="warning" />
        <KpiCard label="Reuniões hoje" value={reunHoje.length} icon={Calendar} tone="info" />
        <KpiCard label="Atividades hoje" value={ativHoje.length} icon={ListChecks} tone="success" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-red-600" /> Atrasadas
              <Badge variant="destructive" className="ml-1">{atrasadas.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/app/tarefas">Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {atrasadas.slice(0, 6).map((t: any) => (
              <TaskRow key={t.id} t={t} overdue />
            ))}
            {atrasadas.length === 0 && <Empty text="Sem tarefas atrasadas 🎉" />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-amber-600" /> Para hoje
              <Badge variant="secondary" className="ml-1">{hoje.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/app/tarefas">Ver todas <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {hoje.slice(0, 6).map((t: any) => <TaskRow key={t.id} t={t} />)}
            {hoje.length === 0 && <Empty text="Nada agendado para hoje." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-blue-600" /> Reuniões da semana
              <Badge variant="secondary" className="ml-1">{reunHoje.length + reunSemana.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/app/agenda">Abrir agenda <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {[...reunHoje, ...reunSemana].slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded border bg-card px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.titulo || a.cliente || "Reunião"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(a.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
                <Badge variant="outline" className="ml-2">{a.tipo || "reunião"}</Badge>
              </div>
            ))}
            {reunHoje.length + reunSemana.length === 0 && <Empty text="Nenhuma reunião nos próximos 7 dias." />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-emerald-600" /> Atividades recentes
              <Badge variant="secondary" className="ml-1">{atividades.length}</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/app/atividades">Ver tudo <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {atividades.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded border bg-card px-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">{a.titulo || a.tipo || "Atividade"}</div>
                  <div className="text-[10px] text-muted-foreground">{dateBR(a.created_at)}</div>
                </div>
                <Badge variant="outline" className="ml-2">{a.tipo}</Badge>
              </div>
            ))}
            {atividades.length === 0 && <Empty text="Sem atividades registradas." />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximas tarefas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {proximas.slice(0, 10).map((t: any) => <TaskRow key={t.id} t={t} />)}
          {proximas.length === 0 && <Empty text="Sem tarefas futuras." />}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "danger" | "warning" | "info" | "success" }) {
  const tones = {
    danger: "text-red-600 bg-red-50",
    warning: "text-amber-600 bg-amber-50",
    info: "text-blue-600 bg-blue-50",
    success: "text-emerald-600 bg-emerald-50",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ t, overdue }: { t: any; overdue?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border bg-card px-2 py-1.5 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium">{t.title || t.description || "Tarefa"}</div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t.due_date ? dateBR(t.due_date) : "Sem prazo"}
          {t.proposals?.number ? ` · Proposta ${t.proposals.number}` : ""}
        </div>
      </div>
      <Badge variant={overdue ? "destructive" : "outline"} className="ml-2">{t.status || "pendente"}</Badge>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded border-2 border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">{text}</div>;
}
