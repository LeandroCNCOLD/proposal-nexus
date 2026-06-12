import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRoster } from "@/hooks/use-team-roster";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TransferLeadDialog({
  open, onOpenChange, leadId,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadId: string }) {
  const { data: sdrs = [] } = useTeamRoster("sdr");
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    const { error } = await supabase.rpc("transfer_sdr_lead", { _lead_id: leadId, _new_sdr_id: target });
    setSaving(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Lead transferido");
    qc.invalidateQueries({ queryKey: ["sdr-leads-for"] });
    qc.invalidateQueries({ queryKey: ["my-wallet"] });
    qc.invalidateQueries({ queryKey: ["proposal-bank"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Transferir lead SDR</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Novo SDR</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {sdrs.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? s.email ?? s.user_id}</SelectItem>
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
