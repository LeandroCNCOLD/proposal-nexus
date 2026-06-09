import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type CloseStatus = "perdida" | "cancelada";

const LABEL: Record<CloseStatus, string> = { perdida: "Perdida", cancelada: "Cancelada" };

export function CloseSdrLeadProposalDialog({
  open, onOpenChange, leadId, leadLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  leadLabel?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<CloseStatus>("perdida");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const justification = reason.trim();
    if (justification.length < 5) {
      toast.error("Descreva o motivo (mínimo 5 caracteres).");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("sdr_leads").update({
        proposal_status: LABEL[status],
        sdr_status: status === "perdida" ? "Perdido (com motivo)" : "Kill / Arquivar",
      } as never).eq("id", leadId);
      if (error) throw error;

      const fullName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? user?.email ?? null;
      await supabase.from("sdr_lead_tratativas").insert({
        lead_id: leadId,
        body: `Proposta marcada como ${LABEL[status]}. Motivo: ${justification}`,
        channel: "outro",
        created_by: user?.id ?? null,
        created_by_name: fullName,
      } as never);

      toast.success(`Lead marcado como ${LABEL[status]}.`);
      qc.invalidateQueries({ queryKey: ["sdr-lead", leadId] });
      qc.invalidateQueries({ queryKey: ["sdr-lead-tratativas", leadId] });
      qc.invalidateQueries({ queryKey: ["sdr-leads"] });
      qc.invalidateQueries({ queryKey: ["my-wallet"] });
      onOpenChange(false);
      setReason("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar proposta do lead</DialogTitle>
          <DialogDescription>
            {leadLabel ? `"${leadLabel}" · ` : ""}Justifique a perda ou cancelamento. A justificativa fica registrada nas tratativas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Novo status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CloseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="perdida">Perdida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Justificativa *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Cliente fechou com concorrente; sem verba; projeto cancelado…"
              rows={4}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || reason.trim().length < 5}>
            {saving ? "Salvando…" : "Confirmar encerramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
