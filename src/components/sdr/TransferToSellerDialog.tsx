import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRoster } from "@/hooks/use-team-roster";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TransferToSellerDialog({
  open, onOpenChange, leadId, leadLabel,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadId: string; leadLabel?: string }) {
  const { data: sellers = [] } = useTeamRoster("vendedor");
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    const { error } = await supabase.rpc("handoff_lead_to_seller", { _lead_id: leadId, _seller_id: target } as never);
    setSaving(false);
    if (error) return toast.error("Falha: " + error.message);
    toast.success("Lead enviado para a carteira do vendedor");
    qc.invalidateQueries({ queryKey: ["proposal-bank"] });
    qc.invalidateQueries({ queryKey: ["sdr-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["my-handoff-leads"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir para vendedor</DialogTitle>
          <DialogDescription>
            {leadLabel ? <>O lead <strong>{leadLabel}</strong> sairá do banco de leads e entrará na <strong>Minha Carteira</strong> do vendedor selecionado.</> : "Selecione o vendedor que vai assumir este lead."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Vendedor</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
            <SelectContent>
              {sellers.map((s) => (
                <SelectItem key={s.user_id} value={s.user_id}>{s.full_name ?? s.email ?? s.user_id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!target || saving}>{saving ? "Transferindo…" : "Transferir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
