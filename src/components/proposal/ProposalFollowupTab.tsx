import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { TEMPERATURE_LABELS } from "@/lib/proposal";

export function ProposalFollowupTab({
  proposalId,
  current,
}: {
  proposalId: string;
  current: {
    next_followup_at: string | null;
    temperature: string | null;
    win_probability: number | null;
    commercial_notes: string | null;
  };
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [nextFollowup, setNextFollowup] = useState(current.next_followup_at?.slice(0, 16) ?? "");
  const [temp, setTemp] = useState(current.temperature ?? "");
  const [prob, setProb] = useState<string>(current.win_probability != null ? String(current.win_probability) : "");
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const patch: any = {};
      if (nextFollowup) patch.next_followup_at = new Date(nextFollowup).toISOString();
      if (temp) patch.temperature = temp;
      if (prob !== "") patch.win_probability = Number(prob);
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("proposals").update(patch).eq("id", proposalId);
        if (error) throw error;
      }
      const desc = note.trim()
        ? `Follow-up: ${note.trim()}${nextFollowup ? ` (próximo: ${new Date(nextFollowup).toLocaleString("pt-BR")})` : ""}`
        : `Follow-up registrado${nextFollowup ? ` — próximo em ${new Date(nextFollowup).toLocaleString("pt-BR")}` : ""}`;
      await supabase.from("proposal_timeline_events").insert({
        proposal_id: proposalId,
        event_type: "observacao",
        description: desc,
        user_id: user?.id,
      });
    },
    onSuccess: () => {
      toast.success("Follow-up registrado");
      setNote("");
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposal-timeline", proposalId] });
      qc.invalidateQueries({ queryKey: ["seller-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Próximo follow-up</Label>
        <Input type="datetime-local" value={nextFollowup} onChange={(e) => setNextFollowup(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Temperatura</Label>
          <select value={temp} onChange={(e) => setTemp(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">—</option>
            {Object.entries(TEMPERATURE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Probabilidade (%)</Label>
          <Input type="number" min={0} max={100} value={prob} onChange={(e) => setProb(e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Nota / próximo passo</Label>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cliente pediu nova proposta com 5% de desconto até sexta" />
      </div>
      <Button size="sm" onClick={() => mut.mutate()} disabled={mut.isPending}>
        Registrar follow-up
      </Button>
    </div>
  );
}
