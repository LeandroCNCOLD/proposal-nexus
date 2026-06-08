import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExternalLink, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { brl, dateBR } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type HandoffLead = {
  id: string; lead_code: string; client_name: string; razao_social: string | null;
  contact_name: string | null; value: number | null; transferred_at: string | null;
  nomus_updated_at: string | null; proposal_title: string | null; proposal_status: string | null;
};

export function HandoffLeadsForSeller({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [popupLead, setPopupLead] = useState<HandoffLead | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["my-handoff-leads", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sdr_leads")
        .select("id, lead_code, client_name, razao_social, contact_name, value, transferred_at, nomus_updated_at, proposal_title, proposal_status")
        .eq("transferred_to_seller_id", userId)
        .eq("handoff_status", "transferred")
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

  const markUpdated = async (leadId: string) => {
    setConfirming(true);
    const { error } = await supabase.rpc("mark_lead_nomus_updated", { _lead_id: leadId } as never);
    setConfirming(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Proposta marcada como atualizada no Nomus");
    qc.invalidateQueries({ queryKey: ["my-handoff-leads", userId] });
    setPopupLead(null);
  };

  return (
    <>
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-[#0F2D5E]">Leads recebidos do SDR</h2>
            <p className="text-xs text-muted-foreground">
              {pending.length > 0
                ? `${pending.length} lead(s) aguardando atualização no Nomus`
                : "Todos os leads transferidos foram atualizados no Nomus"}
            </p>
          </div>
          {pending.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 gap-1">
              <AlertCircle className="h-3 w-3" /> Pendente: {pending.length}
            </Badge>
          )}
        </div>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="rounded-md border bg-background p-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-[10px]">{l.lead_code}</Badge>
                  <span className="font-semibold text-sm truncate">{l.client_name}</span>
                  {l.nomus_updated_at ? (
                    <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]"><CheckCircle2 className="h-3 w-3" />Nomus atualizado</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Atualizar Nomus</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  <span>{brl(Number(l.value ?? 0))}</span>
                  {l.contact_name && <span>· {l.contact_name}</span>}
                  {l.transferred_at && <span>· Recebido {dateBR(l.transferred_at)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/app/sdr/leads/$id" params={{ id: l.id }} className="text-xs underline text-primary inline-flex items-center gap-1">
                  Histórico <ExternalLink className="h-3 w-3" />
                </Link>
                {!l.nomus_updated_at && (
                  <Button size="sm" onClick={() => setPopupLead(l)} className="gap-1">
                    <FileText className="h-3 w-3" /> Atualizar no Nomus
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!popupLead} onOpenChange={(v) => !v && setPopupLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-600" />Atualize a proposta no Nomus</DialogTitle>
            <DialogDescription>
              O lead <strong>{popupLead?.client_name}</strong> ({popupLead?.lead_code}) foi transferido para sua carteira pelo SDR.
              <br /><br />
              Antes de conduzir o atendimento, abra a proposta no <strong>Nomus</strong>, atualize os dados (cliente, escopo, valores, prazos) e depois confirme aqui para que o fluxo passe a ser conduzido por <strong>Propostas</strong>.
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
    </>
  );
}
