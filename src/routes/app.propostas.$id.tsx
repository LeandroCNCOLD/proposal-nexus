import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2, Clock } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { nomusCreatePedido } from "@/integrations/nomus/server.functions";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { ALL_STATUSES, STATUS_LABELS, TEMPERATURE_LABELS, type ProposalStatus } from "@/lib/proposal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const Route = createFileRoute("/app/propostas/$id")({ component: ProposalDetail });

function ProposalDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const createPedido = useServerFn(nomusCreatePedido);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, clients(name, segment), client_contacts(name, email)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["proposal-timeline", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("proposal_timeline_events")
        .select("*")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const insertTimeline = async (description: string) => {
    const { error } = await supabase.from("proposal_timeline_events").insert({
      proposal_id: id,
      event_type: "observacao",
      description,
      user_id: user?.id,
    });

    if (error) {
      console.error("Falha ao registrar timeline da proposta:", error);
    }
  };

  const updateStatus = async (newStatus: ProposalStatus) => {
    const previousStatus = p?.status as ProposalStatus | undefined;

    setStatusLoading(true);
    qc.setQueryData(["proposal", id], (current: any) =>
      current ? { ...current, status: newStatus } : current,
    );

    try {
      const { error } = await supabase.from("proposals").update({ status: newStatus }).eq("id", id);
      if (error) {
        qc.setQueryData(["proposal", id], (current: any) =>
          current && previousStatus ? { ...current, status: previousStatus } : current,
        );
        toast.error(error.message);
        return;
      }

      await insertTimeline(`Status alterado para ${STATUS_LABELS[newStatus]}`);

      if (newStatus === "ganha") {
        const { data: settings, error: settingsError } = await supabase
          .from("nomus_settings")
          .select("auto_create_pedido_on_won")
          .maybeSingle();

        if (settingsError) {
          console.error("Erro ao consultar configurações Nomus:", settingsError);
        } else if (settings?.auto_create_pedido_on_won ?? true) {
          const result = await createPedido({ data: { proposalId: id } });

          if (result.ok) {
            await insertTimeline("Pedido criado no Nomus");
          } else {
            await insertTimeline("Falha ao criar pedido no Nomus");
            toast.error(result.error ?? "Falha ao criar pedido no Nomus.");
          }
        }
      }

      toast.success("Status atualizado");
    } catch (e: any) {
      qc.setQueryData(["proposal", id], (current: any) =>
        current && previousStatus ? { ...current, status: previousStatus } : current,
      );
      toast.error(e?.message ?? "Falha ao atualizar status");
    } finally {
      setStatusLoading(false);
      qc.invalidateQueries({ queryKey: ["proposal", id] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", id] });
    }
  };

  const runAI = async (task: "resumo" | "proximo_passo") => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-proposal-insight", {
        body: { proposal_id: id, task },
      });
      if (error) throw error;
      setAiResult(data.content);
      toast.success("Insight gerado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar insight");
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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
          <Select value={p.status} onValueChange={(v) => updateStatus(v as ProposalStatus)} disabled={statusLoading}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Observações comerciais
                </div>
                {p.commercial_notes}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Inteligência artificial
              </h2>
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
              <div className="whitespace-pre-wrap rounded-md border bg-secondary/30 p-4 text-sm">{aiResult}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Use a IA para gerar resumos, sugestões de próximo passo ou análises de perda/ganho.
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="timeline" className="rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
          <TabsList className="w-full">
            <TabsTrigger value="timeline" className="flex-1">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1">
              Tarefas
            </TabsTrigger>
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
