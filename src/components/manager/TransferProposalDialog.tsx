import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRoster } from "@/hooks/use-team-roster";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TransferProposalDialog({
  open,
  onOpenChange,
  proposalId,
  kind = "sales",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposalId: string;
  kind?: "sales" | "technical";
}) {
  const { data: sellers = [] } = useTeamRoster(kind === "sales" ? "vendedor" : undefined);
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    const { error } = await supabase.rpc("transfer_proposal_owner", {
      _proposal_id: proposalId,
      _new_user_id: target,
      _kind: kind,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha na transferência: " + error.message);
      return;
    }
    toast.success("Transferência registrada");
    qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
    qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
    qc.invalidateQueries({ queryKey: ["seller-wallet-for"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir {kind === "sales" ? "vendedor" : "responsável técnico"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Novo responsável</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {sellers.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>
                  {s.full_name ?? s.email ?? s.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!target || saving}>{saving ? "Transferindo…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
