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
import { STATUS_LABELS } from "@/lib/proposal";

type CloseStatus = "perdida" | "cancelada";

export function CloseProposalDialog({
  open, onOpenChange, proposalId, proposalLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  proposalLabel?: string | null;
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
      const { error } = await supabase.from("proposals").update({
        status,
        loss_reason: justification,
        closed_at: new Date().toISOString(),
      }).eq("id", proposalId);
      if (error) throw error;

      await supabase.from("proposal_timeline_events").insert({
        proposal_id: proposalId,
        event_type: "observacao",
        description: `Proposta marcada como ${STATUS_LABELS[status]}. Motivo: ${justification}`,
        user_id: user?.id,
        metadata: { status, loss_reason: justification } as never,
      });

      toast.success(`Proposta marcada como ${STATUS_LABELS[status]}.`);
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
      qc.invalidateQueries({ queryKey: ["seller-proposals"] });
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
          <DialogTitle>Encerrar proposta</DialogTitle>
          <DialogDescription>
            {proposalLabel ? `"${proposalLabel}" · ` : ""}Justifique a perda ou cancelamento. A justificativa fica registrada no histórico.
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
              placeholder="Ex.: Cliente fechou com concorrente XYZ por preço; projeto adiado para 2027; sem orçamento aprovado…"
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
