import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, User } from "lucide-react";

type SellerSuggestion = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  active_count: number;
};

export function TransferToSellerDialog({
  open, onOpenChange, leadId, leadLabel,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadId: string; leadLabel?: string }) {
  const [target, setTarget] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const { data: sellers = [] } = useQuery({
    queryKey: ["seller-suggestions"],
    enabled: open,
    staleTime: 60_000,
    queryFn: async (): Promise<SellerSuggestion[]> => {
      const { data, error } = await supabase.rpc("suggest_seller_for_handoff" as never);
      if (error) throw error;
      return (data ?? []) as unknown as SellerSuggestion[];
    },
  });

  const lightest = useMemo(() => sellers[0]?.user_id ?? "", [sellers]);

  const applySuggestion = () => {
    if (lightest) {
      setTarget(lightest);
      toast.success("Sugestão aplicada: vendedor com menor carga");
    }
  };

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
    qc.invalidateQueries({ queryKey: ["seller-suggestions"] });
    onOpenChange(false);
    setTarget("");
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Vendedor</Label>
            {lightest && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={applySuggestion}>
                <Sparkles className="h-3 w-3" /> Sugerir (menor carga)
              </Button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {sellers.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">Sem vendedores cadastrados.</div>
            )}
            {sellers.map((s) => {
              const isSelected = target === s.user_id;
              const isLightest = s.user_id === lightest;
              return (
                <button
                  key={s.user_id}
                  type="button"
                  onClick={() => setTarget(s.user_id)}
                  className={`w-full text-left p-3 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-muted/50"}`}
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {s.full_name ?? s.email ?? s.user_id}
                      {isLightest && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />menor carga</Badge>}
                    </div>
                    {s.email && <div className="text-[11px] text-muted-foreground truncate">{s.email}</div>}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {s.active_count} {s.active_count === 1 ? "lead ativo" : "leads ativos"}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!target || saving}>{saving ? "Transferindo…" : "Transferir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
