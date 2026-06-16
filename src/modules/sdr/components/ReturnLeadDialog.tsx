import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { unlockLead } from "@/modules/sdr/services";
import { insertFollowup } from "@/modules/sdr/followups";
import { toast } from "sonner";
import { Clock } from "lucide-react";

type LeadInfo = { id: string; client_name?: string | null; lead_code?: string | null } | null;

/**
 * Diálogo obrigatório ao devolver um lead: o SDR precisa agendar uma nova
 * atividade (data + nota) que vira um lembrete pop-up quando atingir o horário.
 */
export function ReturnLeadDialog({
  lead, open, onOpenChange, onDone,
}: {
  lead: LeadInfo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const sdrName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "SDR";

  const submit = async () => {
    if (!lead) return;
    if (!date) return toast.error("Informe a data e hora do retorno.");
    const scheduled = new Date(date);
    if (isNaN(scheduled.getTime())) return toast.error("Data inválida.");
    if (scheduled.getTime() < Date.now() - 60_000) return toast.error("A data precisa estar no futuro.");
    setSaving(true);
    try {
      await insertFollowup({
        lead_id: lead.id,
        sdr_id: user?.id ?? null,
        sdr_name: sdrName,
        scheduled_at: scheduled.toISOString(),
        note: note.trim() || "Retomar contato",
      });
      await unlockLead(lead.id);
      toast.success("Lead devolvido e atividade agendada.");
      onDone?.();
      onOpenChange(false);
      setNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao devolver lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Devolver lead e agendar retomada
          </DialogTitle>
          <DialogDescription>
            Defina quando você quer ser lembrado para retomar o contato. Um pop-up vai aparecer
            automaticamente nesse horário para você assumir o lead novamente ou tomar uma ação.
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-semibold">{lead.client_name ?? "Lead"}</div>
            {lead.lead_code && <div className="text-xs text-muted-foreground font-mono">{lead.lead_code}</div>}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ret-date">Data e hora do retorno *</Label>
            <Input
              id="ret-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {[
                { label: "+1 dia", h: 24 },
                { label: "+3 dias", h: 72 },
                { label: "+7 dias", h: 168 },
                { label: "+15 dias", h: 360 },
              ].map((p) => (
                <Button
                  key={p.label} variant="outline" size="sm" type="button"
                  className="h-6 text-[11px] px-2"
                  onClick={() => {
                    const d = new Date(Date.now() + p.h * 60 * 60 * 1000);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    setDate(d.toISOString().slice(0, 16));
                  }}
                >{p.label}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ret-note">Motivo / próximo passo</Label>
            <Textarea
              id="ret-note"
              placeholder="Ex.: Cliente pediu para retomar após orçamento aprovado."
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Devolver e agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
