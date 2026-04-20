import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2, Clock, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { ALL_STATUSES, STATUS_LABELS, TEMPERATURE_LABELS, type ProposalStatus } from "@/lib/proposal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { nomusCreatePedido } from "@/integrations/nomus/server.functions";

export const Route = createFileRoute("/app/propostas/$id")({ component: ProposalDetail });

function ProposalDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const { data: p, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals")
        .select("*, clients(name, segment), client_contacts(name, email)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["proposal-timeline", id],
    queryFn: async () => {
      const { data } = await supabase.from("proposal_timeline_events")
        .select("*").eq("proposal_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createPedido = useServerFn(nomusCreatePedido);

  const tryAutoCreatePedido = async () => {
    // 1) Checa configuração
    const { data: settings } = await supabase
      .from("nomus_settings")
      .select("auto_create_pedido_on_won, is_enabled")
      .maybeSingle();
    const enabled = settings?.is_enabled ?? false;
    const autoCreate = settings?.auto_create_pedido_on_won ?? false;
    if (!enabled || !autoCreate) return;

    // 2) Checa vínculo com Nomus e idempotência
    if (!p?.nomus_id) {
      toast.message("Proposta sem vínculo com o Nomus — pedido não criado automaticamente.");
      return;
    }
    if (p?.nomus_pedido_id) {
      toast.message(`Pedido já existente no Nomus: ${p.nomus_pedido_id}`);
      return;
    }

    toast.loading("Criando pedido no Nomus…", { id: "create-pedido" });
    try {
      const res = await createPedido({ data: { proposalId: id } });
      toast.dismiss("create-pedido");
      if (res.ok) {
        if (res.already_existed) {
          toast.success(`Pedido já existente: ${res.pedido_id}`);
        } else {
          toast.success(`Pedido criado no Nomus: ${res.pedido_id}`);
          await supabase.from("proposal_timeline_events").insert({
            proposal_id: id, event_type: "ganha",
            description: `Pedido criado no Nomus: ${res.pedido_id}`,
            user_id: user?.id,
          });
        }
      } else {
        toast.error(`Falha ao criar pedido no Nomus: ${res.error}`);
        await supabase.from("proposal_timeline_events").insert({
          proposal_id: id, event_type: "observacao",
          description: `Falha ao criar pedido no Nomus: ${res.error}`,
          user_id: user?.id,
        });
      }
    } catch (e) {
      toast.dismiss("create-pedido");
      const msg = e instanceof Error ? e.message : "Erro inesperado";
      toast.error(`Falha ao criar pedido no Nomus: ${msg}`);
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: id, event_type: "observacao",
        description: `Falha ao criar pedido no Nomus: ${msg}`,
        user_id: user?.id,
      });
    }
  };

  const updateStatus = async (newStatus: ProposalStatus) => {
    const { error } = await supabase.from("proposals").update({ status: newStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("proposal_timeline_events").insert({
      proposal_id: id, event_type: "observacao",
      description: `Status alterado para ${STATUS_LABELS[newStatus]}`, user_id: user?.id,
    });
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["proposal", id] });
    qc.invalidateQueries({ queryKey: ["proposal-timeline", id] });

    // Se virou "ganha", tenta criar pedido no Nomus (respeita config)
    if (newStatus === "ganha") {
      await tryAutoCreatePedido();
      qc.invalidateQueries({ queryKey: ["proposal", id] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", id] });
    }
  };

  const runAI = async (task: "resumo" | "proximo_passo") => {
    setAiLoading(true); setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-proposal-insight", {
        body: { proposal_id: id, task },
      });
      if (error) throw error;
      setAiResult(data.content);
      toast.success("Insight gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar insight");
    } finally { setAiLoading(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!p) return <div className="text-muted-foreground">Proposta não encontrada.</div>;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/propostas" })} className="mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
      </Button>

      <PageHeader
        title={p.title}
        subtitle={<span className="font-mono text-xs">{p.number}</span> as any}
        actions={
          <>
            <Select value={p.status} onValueChange={(v) => updateStatus(v as ProposalStatus)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Resumo</h2>
              <StatusBadge status={p.status as ProposalStatus} />
            </div>
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              <Item label="Cliente" value={(p.clients as any)?.name ?? "—"} />
              <Item label="Segmento" value={p.segment ?? "—"} />
              <Item label="Região" value={p.region ?? "—"} />
              <Item label="Temperatura" value={p.temperature ? TEMPERATURE_LABELS[p.temperature] : "—"} />
              <Item label="Valor total" value={brl(Number(p.total_value ?? 0))} highlight />
              <Item label="Probabilidade" value={p.win_probability != null ? `${p.win_probability}%` : "—"} />
              <Item label="Validade" value={dateBR(p.valid_until)} />
              <Item label="Próximo follow-up" value={dateBR(p.next_followup_at)} />
              <Item label="Enviada em" value={dateBR(p.sent_at)} />
              <Item label="Criada em" value={dateBR(p.created_at)} />
            </dl>
            {p.commercial_notes && (
              <div className="mt-4 rounded-md border bg-secondary/30 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Observações comerciais</div>
                {p.commercial_notes}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Inteligência artificial</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => runAI("resumo")} disabled={aiLoading}>
                  {aiLoading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Resumir proposta
                </Button>
                <Button size="sm" variant="outline" onClick={() => runAI("proximo_passo")} disabled={aiLoading}>
                  Sugerir próximo passo
                </Button>
              </div>
            </div>
            {aiResult ? (
              <div className="rounded-md border bg-secondary/30 p-4 text-sm whitespace-pre-wrap">{aiResult}</div>
            ) : (
              <div className="text-xs text-muted-foreground">Use a IA para gerar resumos, sugestões de próximo passo ou análises de perda/ganho.</div>
            )}
          </div>
        </div>

        <Tabs defaultValue="timeline" className="rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
          <TabsList className="w-full">
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1">Tarefas</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline" className="mt-4">
            {timeline.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sem eventos registrados.</div>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {timeline.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" />
                    <div className="text-xs font-medium text-foreground">{ev.description ?? ev.event_type}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {dateTimeBR(ev.created_at)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <div className="py-8 text-center text-sm text-muted-foreground">
              Módulo de tarefas — em breve nesta proposta.
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Item({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={"mt-0.5 " + (highlight ? "text-base font-semibold tabular-nums" : "")}>{value}</dd>
    </div>
  );
}
