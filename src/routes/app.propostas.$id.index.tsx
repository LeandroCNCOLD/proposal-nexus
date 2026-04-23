import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2, Clock, FileText, Send, Download, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { ALL_STATUSES, STATUS_LABELS, TEMPERATURE_LABELS, type ProposalStatus } from "@/lib/proposal";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { nomusCreatePedido, generateProposalFile, sendProposalFile } from "@/integrations/nomus/server.functions";
import { NomusProposalDetail } from "@/components/NomusProposalDetail";

export const Route = createFileRoute("/app/propostas/$id/")({ component: ProposalDetail });

function ProposalDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [aiLoadingTask, setAiLoadingTask] = useState<"resumo" | "proximo_passo" | null>(null);

  const { data: p, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals")
        .select("*, clients(name, segment, document, city, state), client_contacts(name, email, phone, role)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const isNomus = !!p?.nomus_proposal_id;

  const { data: timeline = [] } = useQuery({
    queryKey: ["proposal-timeline", id],
    queryFn: async () => {
      const { data } = await supabase.from("proposal_timeline_events")
        .select("*").eq("proposal_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createPedido = useServerFn(nomusCreatePedido);
  const generateFile = useServerFn(generateProposalFile);
  const sendFile = useServerFn(sendProposalFile);

  const { data: versions = [] } = useQuery({
    queryKey: ["proposal-versions", id],
    queryFn: async () => {
      const { data } = await supabase.from("proposal_send_versions")
        .select("*").eq("proposal_id", id).order("version_number", { ascending: false });
      return data ?? [];
    },
  });

  const { data: sendEvents = [] } = useQuery({
    queryKey: ["proposal-send-events", id],
    queryFn: async () => {
      const { data } = await supabase.from("proposal_send_events")
        .select("*").eq("proposal_id", id).order("sent_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["proposal-insights", id],
    queryFn: async () => {
      const { data } = await supabase.from("ai_insights")
        .select("id, insight_type, content, created_at, metadata")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const latestResumo = insights.find((i: any) => i.insight_type === "resumo");
  const latestProx = insights.find((i: any) => i.insight_type === "proximo_passo");

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ recipient: "", subject: "", message: "", channel: "email" });

  const handleGenerate = async () => {
    setGenerating(true);
    toast.loading("Gerando PDF…", { id: "gen-pdf" });
    try {
      const res = await generateFile({ data: { proposalId: id } });
      toast.dismiss("gen-pdf");
      if (res.ok) {
        toast.success(`Versão ${res.version_number} gerada`);
        await supabase.from("proposal_timeline_events").insert({
          proposal_id: id, event_type: "observacao",
          description: `Arquivo gerado — versão ${res.version_number}`,
          user_id: user?.id,
        });
        qc.invalidateQueries({ queryKey: ["proposal-versions", id] });
        qc.invalidateQueries({ queryKey: ["proposal-timeline", id] });
      } else {
        toast.error(`Falha ao gerar PDF: ${res.error}`);
      }
    } catch (e) {
      toast.dismiss("gen-pdf");
      toast.error(e instanceof Error ? e.message : "Erro ao gerar PDF");
    } finally { setGenerating(false); }
  };

  const handleDownload = async (path: string) => {
    const { data, error } = await supabase.storage.from("proposal-files").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Falha ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  const openSendDialog = () => {
    const current = (versions as Array<{ is_current: boolean }>).find((v) => v.is_current);
    if (!current) return toast.error("Gere o PDF antes de enviar.");
    const contactEmail = (p?.client_contacts as { email?: string } | null)?.email ?? "";
    setSendForm({ recipient: contactEmail, subject: `Proposta ${p?.number} — ${p?.title}`, message: "", channel: "email" });
    setSendOpen(true);
  };

  const handleSend = async () => {
    const current = (versions as Array<{ id: string; is_current: boolean }>).find((v) => v.is_current);
    if (!current) return toast.error("Nenhuma versão atual disponível.");
    setSending(true);
    try {
      const res = await sendFile({ data: {
        proposalId: id, versionId: current.id, channel: sendForm.channel,
        recipient: sendForm.recipient || undefined,
        subject: sendForm.subject || undefined,
        message: sendForm.message || undefined,
      }});
      if (res.ok) {
        toast.success("Proposta enviada");
        if ("nomus_push" in res && res.nomus_push && "ok" in res.nomus_push) {
          if (res.nomus_push.ok) toast.message("Evento replicado no Nomus");
          else if ("error" in res.nomus_push) toast.message(`Nomus: ${res.nomus_push.error}`);
        }
        setSendOpen(false);
        qc.invalidateQueries({ queryKey: ["proposal", id] });
        qc.invalidateQueries({ queryKey: ["proposal-timeline", id] });
        qc.invalidateQueries({ queryKey: ["proposal-send-events", id] });
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    } finally { setSending(false); }
  };

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
          toast.message(`Pedido já existente no Nomus: ${res.pedido_id}`);
          await supabase.from("proposal_timeline_events").insert({
            proposal_id: id, event_type: "observacao",
            description: `Pedido já existente no Nomus: ${res.pedido_id}`,
            user_id: user?.id,
          });
        } else {
          toast.success(`Pedido criado no Nomus: ${res.pedido_id}`);
          await supabase.from("proposal_timeline_events").insert({
            proposal_id: id, event_type: "observacao",
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
    setAiLoadingTask(task);
    try {
      const { data, error } = await supabase.functions.invoke("ai-proposal-insight", {
        body: { proposal_id: id, task },
      });
      if (error) throw error;
      toast.success(data?.cached ? "Insight recuperado do cache" : "Insight gerado");
      qc.invalidateQueries({ queryKey: ["proposal-insights", id] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao gerar insight");
    } finally { setAiLoadingTask(null); }
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
        subtitle={(<span className="font-mono text-xs">{p.number}</span>) as any}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({ to: "/app/propostas/$id/editor", params: { id } })}
            >
              <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar documento
            </Button>
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
              Gerar PDF
            </Button>
            <Button size="sm" onClick={openSendDialog} disabled={sending || versions.length === 0}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
            </Button>
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
              <h2 className="text-sm font-semibold">Resumo comercial</h2>
              <StatusBadge status={p.status as ProposalStatus} />
            </div>
            <dl className="grid gap-4 text-sm md:grid-cols-2">
              {!isNomus && <Item label="Cliente" value={(p.clients as any)?.name ?? "—"} />}
              <Item label="Segmento" value={p.segment ?? (p.clients as any)?.segment ?? "—"} />
              <Item label="Região" value={p.region ?? "—"} />
              <Item label="Temperatura" value={p.temperature ? TEMPERATURE_LABELS[p.temperature] : "—"} />
              <Item label="Valor total" value={brl(Number(p.total_value ?? 0))} highlight />
              <Item label="Probabilidade" value={p.win_probability != null ? `${p.win_probability}%` : "—"} />
              {!isNomus && <Item label="Validade" value={dateBR(p.valid_until)} />}
              <Item label="Próximo follow-up" value={dateBR(p.next_followup_at)} />
              <Item label="Enviada em" value={dateBR(p.sent_at)} />
              {!isNomus && <Item label="Criada em" value={dateBR(p.created_at)} />}
            </dl>
            {p.commercial_notes && (
              <div className="mt-4 rounded-md border bg-secondary/30 p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Observações comerciais</div>
                {p.commercial_notes}
              </div>
            )}
          </div>

          {p.nomus_proposal_id && (
            <NomusProposalDetail
              nomusProposalId={p.nomus_proposal_id}
              localContact={(p.client_contacts as { name?: string; email?: string; phone?: string; role?: string } | null) ?? null}
              localClient={(p.clients as { name?: string; document?: string; city?: string; state?: string } | null) ?? null}
            />
          )}

          <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-sm)]">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Inteligência artificial</h2>
              <span className="text-[11px] text-muted-foreground">Baseada nos dados reais da proposta</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InsightBlock
                title="Resumo executivo"
                insight={latestResumo}
                loading={aiLoadingTask === "resumo"}
                disabled={aiLoadingTask !== null}
                onRun={() => runAI("resumo")}
                ctaLabel="Gerar resumo"
              />
              <InsightBlock
                title="Próximo passo"
                insight={latestProx}
                loading={aiLoadingTask === "proximo_passo"}
                disabled={aiLoadingTask !== null}
                onRun={() => runAI("proximo_passo")}
                ctaLabel="Sugerir próximo passo"
              />
            </div>
          </div>
        </div>

        <Tabs defaultValue="timeline" className="rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
          <TabsList className="w-full">
            <TabsTrigger value="timeline" className="flex-1">Timeline</TabsTrigger>
            <TabsTrigger value="versions" className="flex-1">Versões</TabsTrigger>
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
          <TabsContent value="versions" className="mt-4 space-y-3">
            {versions.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma versão gerada.</div>
            ) : (
              versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">v{v.version_number} {v.is_current && <span className="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success">atual</span>}</div>
                    <div className="text-[11px] text-muted-foreground">{dateTimeBR(v.generated_at)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(v.pdf_storage_path)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
            {sendEvents.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Envios</div>
                {sendEvents.map((e: any) => (
                  <div key={e.id} className="text-xs py-1">
                    <span className="font-medium">{e.channel}</span>
                    {e.recipient && <span className="text-muted-foreground"> → {e.recipient}</span>}
                    <span className="text-muted-foreground"> · {dateTimeBR(e.sent_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="tasks" className="mt-4">
            <div className="py-8 text-center text-sm text-muted-foreground">
              Módulo de tarefas — em breve nesta proposta.
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={sendForm.channel} onValueChange={(v) => setSendForm((f) => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="manual">Manual / outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Destinatário</Label>
              <Input value={sendForm.recipient} onChange={(e) => setSendForm((f) => ({ ...f, recipient: e.target.value }))} placeholder="email@cliente.com" />
            </div>
            <div>
              <Label className="text-xs">Assunto</Label>
              <Input value={sendForm.subject} onChange={(e) => setSendForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={sendForm.message} onChange={(e) => setSendForm((f) => ({ ...f, message: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSendOpen(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function InsightBlock({
  title, insight, loading, disabled, onRun, ctaLabel,
}: {
  title: string;
  insight: any | undefined;
  loading: boolean;
  disabled: boolean;
  onRun: () => void;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-md border bg-secondary/20 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold">{title}</div>
        <Button size="sm" variant={insight ? "ghost" : "outline"} onClick={onRun} disabled={disabled}>
          {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          {insight ? "Atualizar" : ctaLabel}
        </Button>
      </div>
      {insight ? (
        <>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{insight.content}</div>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" /> Gerado em {dateTimeBR(insight.created_at)}
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">
          Ainda não gerado. Clique em "{ctaLabel}" para a IA analisar a proposta com base nos dados reais (cliente, itens, timeline e envios).
        </div>
      )}
    </div>
  );
}
