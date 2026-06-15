import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ExternalLink, FileText, AlertCircle, CheckCircle2, MessageSquare,
  ThumbsUp, HelpCircle, Phone,
} from "lucide-react";
import { brl, dateBR, dateTimeBR } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type HandoffLead = {
  id: string; lead_code: string; client_name: string; razao_social: string | null;
  contact_name: string | null; value: number | null; transferred_at: string | null;
  nomus_updated_at: string | null; proposal_title: string | null; proposal_status: string | null;
  handoff_status: string | null; handoff_notes: string | null;
  transferred_to_seller_name: string | null;
  sdr_name: string | null;
  bant_budget: string | null; bant_authority: string | null;
  bant_need: string | null; bant_timeline: string | null;
  bant_score: number | null;
};

const BANT_BUDGET_LABEL: Record<string, string> = {
  sim: "✅ Aprovado", parcial: "⚠️ Parcial", nao: "❌ Sem verba",
};
const BANT_TIMELINE_LABEL: Record<string, string> = {
  este_mes: "Este mês", "1_3_meses": "1 a 3 meses", "3_6_meses": "3 a 6 meses",
  "6_meses_mais": "Mais de 6 meses", indefinido: "Indefinido",
};


type HistoryRow = { fonte: string; data: string | null; resultado: string | null; observacao: string | null; autor: string | null };

function LeadHistory({ leadId }: { leadId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["lead-history", leadId],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase.rpc("sdr_lead_history" as never, { _lead_id: leadId } as never);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });
  if (isLoading) return <div className="text-xs text-muted-foreground">Carregando…</div>;
  if (data.length === 0) return <div className="text-xs text-muted-foreground italic">Sem histórico</div>;
  return (
    <ul className="space-y-1.5">
      {data.map((h, i) => (
        <li key={i} className="text-xs flex gap-2">
          <Phone className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="text-muted-foreground">{h.data ? dateTimeBR(h.data) : "—"}</span>
            {h.resultado && <span className="ml-2 font-medium">{h.resultado}</span>}
            {h.autor && <span className="ml-2 text-muted-foreground">· {h.autor}</span>}
            {h.observacao && <div className="text-muted-foreground">{h.observacao}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HandoffLeadsForSeller({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [popupLead, setPopupLead] = useState<HandoffLead | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [askingLead, setAskingLead] = useState<HandoffLead | null>(null);
  const [question, setQuestion] = useState("");
  const [sendingQ, setSendingQ] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["my-handoff-leads", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sdr_leads")
        .select("id, lead_code, client_name, razao_social, contact_name, value, transferred_at, nomus_updated_at, proposal_title, proposal_status, handoff_status, handoff_notes, transferred_to_seller_name, sdr_name, bant_budget, bant_authority, bant_need, bant_timeline, bant_score")
        .eq("transferred_to_seller_id", userId)
        .in("handoff_status", ["transferred", "pendente", "aceito"])
        .order("transferred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as HandoffLead[];

    },
    refetchInterval: 60_000,
  });

  if (isLoading) return null;
  if (leads.length === 0) return null;

  const pending = leads.filter((l) => !l.nomus_updated_at);
  const isPending = (status: string | null) => status === "transferred" || status === "pendente";

  const markUpdated = async (leadId: string) => {
    setConfirming(true);
    const { error } = await supabase.rpc("mark_lead_nomus_updated", { _lead_id: leadId } as never);
    setConfirming(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Proposta marcada como atualizada no Nomus");
    qc.invalidateQueries({ queryKey: ["my-handoff-leads", userId] });
    setPopupLead(null);
  };

  const acceptLead = async (leadId: string) => {
    setAcceptingId(leadId);
    const { error } = await supabase.rpc("accept_handoff_lead" as never, { _lead_id: leadId } as never);
    setAcceptingId(null);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Lead aceito! ✓");
    qc.invalidateQueries({ queryKey: ["my-handoff-leads", userId] });
  };

  const sendQuestion = async () => {
    if (!askingLead || question.trim().length < 5) return;
    setSendingQ(true);
    const { error } = await supabase.rpc("request_handoff_info" as never, {
      _lead_id: askingLead.id, _question: question.trim(),
    } as never);
    setSendingQ(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Pergunta enviada ao SDR");
    setAskingLead(null); setQuestion("");
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-[#0F2D5E]">Leads recebidos do SDR</h2>
            <p className="text-xs text-muted-foreground">
              {pending.length > 0 ? `${pending.length} lead(s) aguardando ação` : "Todos os leads atualizados"}
            </p>
          </div>
          {pending.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 gap-1">
              <AlertCircle className="h-3 w-3" /> Pendentes: {pending.length}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {leads.map((l) => {
            const pendingHandoff = isPending(l.handoff_status);
            const accepted = l.handoff_status === "aceito";
            return (
              <div key={l.id} className={`rounded-md border p-3 space-y-2 ${pendingHandoff ? "bg-red-50/40 border-red-200" : "bg-background"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-mono text-[10px]">{l.lead_code}</Badge>
                      <span className="font-semibold text-sm truncate">{l.client_name}</span>
                      {pendingHandoff && (
                        <Badge className="bg-red-600 text-white gap-1 text-[10px]">
                          <AlertCircle className="h-3 w-3" /> Aguarda sua resposta
                        </Badge>
                      )}
                      {accepted && (
                        <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Aceito
                        </Badge>
                      )}
                      {l.nomus_updated_at && (
                        <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> Nomus atualizado
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                      <span>{brl(Number(l.value ?? 0))}</span>
                      {l.contact_name && <span>· {l.contact_name}</span>}
                      {l.sdr_name && <span>· De: {l.sdr_name}</span>}
                      {l.transferred_at && <span>· Recebido {dateBR(l.transferred_at)}</span>}
                    </div>
                  </div>
                  <Link to="/app/sdr/leads/$id" params={{ id: l.id }} className="text-xs underline text-primary inline-flex items-center gap-1 shrink-0">
                    Histórico <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                {l.handoff_notes && (
                  <div className="rounded-md bg-blue-50 border border-blue-200 p-2.5 flex gap-2">
                    <MessageSquare className="h-3.5 w-3.5 text-blue-700 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-blue-900 uppercase tracking-wide">
                        Contexto de {l.sdr_name ?? "SDR"}
                      </div>
                      <div className="text-xs text-blue-900 whitespace-pre-wrap mt-0.5">{l.handoff_notes}</div>
                    </div>
                  </div>
                )}

                <Accordion type="single" collapsible>
                  <AccordionItem value="hist" className="border-0">
                    <AccordionTrigger className="text-xs py-1.5 hover:no-underline">Ver histórico de ligações</AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <LeadHistory leadId={l.id} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="flex items-center gap-2 flex-wrap">
                  {pendingHandoff && (
                    <>
                      <Button size="sm" onClick={() => acceptLead(l.id)} disabled={acceptingId === l.id} className="bg-emerald-600 hover:bg-emerald-700 gap-1">
                        <ThumbsUp className="h-3 w-3" /> {acceptingId === l.id ? "Aceitando…" : "Aceitar lead"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAskingLead(l); setQuestion(""); }} className="gap-1">
                        <HelpCircle className="h-3 w-3" /> Pedir mais info
                      </Button>
                    </>
                  )}
                  {!l.nomus_updated_at && accepted && (
                    <Button size="sm" onClick={() => setPopupLead(l)} className="gap-1">
                      <FileText className="h-3 w-3" /> Atualizar no Nomus
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atualizar Nomus */}
      <Dialog open={!!popupLead} onOpenChange={(v) => !v && setPopupLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" />Atualize a proposta no Nomus</DialogTitle>
            <DialogDescription>
              O lead <strong>{popupLead?.client_name}</strong> ({popupLead?.lead_code}) está na sua carteira.
              Abra a proposta no <strong>Nomus</strong>, atualize os dados e confirme aqui.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPopupLead(null)}>Mais tarde</Button>
            <Button onClick={() => popupLead && markUpdated(popupLead.id)} disabled={confirming}>
              {confirming ? "Confirmando…" : "Já atualizei no Nomus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pedir mais info */}
      <Dialog open={!!askingLead} onOpenChange={(v) => !v && setAskingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir mais informações ao SDR</DialogTitle>
            <DialogDescription>
              Sua pergunta vai como notificação para <strong>{askingLead?.sdr_name ?? "o SDR"}</strong>.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="O que você precisa saber antes de aceitar?" rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAskingLead(null)}>Cancelar</Button>
            <Button onClick={sendQuestion} disabled={question.trim().length < 5 || sendingQ}>
              {sendingQ ? "Enviando…" : "Enviar pergunta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
