import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, User, MessageSquare, Phone, Calendar as CalendarIcon } from "lucide-react";
import { brl, dateTimeBR } from "@/lib/format";

type SellerSuggestion = { user_id: string; full_name: string | null; email: string | null; active_count: number };
type LeadSummary = {
  client_name: string; value: number | null; temperature: string | null;
  sdr_status: string | null; last_contact_at: string | null;
};
type HistoryRow = { fonte: string; data: string | null; resultado: string | null; observacao: string | null; autor: string | null };

const TEMP_COLORS: Record<string, string> = {
  "Muito Quente": "bg-red-100 text-red-800",
  "Quente": "bg-orange-100 text-orange-800",
  "Morno": "bg-amber-100 text-amber-800",
  "Frio": "bg-blue-100 text-blue-800",
};

export function TransferToSellerDialog({
  open, onOpenChange, leadId, leadLabel,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadId: string; leadLabel?: string }) {
  const [target, setTarget] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [notesError, setNotesError] = useState(false);
  const [hasMeeting, setHasMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  // BANT
  const [bantBudget, setBantBudget] = useState<"" | "sim" | "parcial" | "nao">("");
  const [bantAuthority, setBantAuthority] = useState("");
  const [bantNeed, setBantNeed] = useState("");
  const [bantTimeline, setBantTimeline] = useState<"" | "este_mes" | "1_3_meses" | "3_6_meses" | "6_meses_mais" | "indefinido">("");

  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setTarget(""); setNotes(""); setNotesError(false);
      setHasMeeting(false); setMeetingDate(""); setMeetingTime("09:00");
      setBantBudget(""); setBantAuthority(""); setBantNeed(""); setBantTimeline("");
    }
  }, [open]);

  const bantScore =
    (bantBudget ? 1 : 0) +
    (bantAuthority.trim() ? 1 : 0) +
    (bantNeed.trim() ? 1 : 0) +
    (bantTimeline ? 1 : 0);


  const { data: sellers = [] } = useQuery({
    queryKey: ["seller-suggestions"], enabled: open, staleTime: 60_000,
    queryFn: async (): Promise<SellerSuggestion[]> => {
      const { data, error } = await supabase.rpc("suggest_seller_for_handoff" as never);
      if (error) throw error;
      return (data ?? []) as unknown as SellerSuggestion[];
    },
  });

  const { data: lead } = useQuery({
    queryKey: ["lead-summary", leadId], enabled: open && !!leadId,
    queryFn: async (): Promise<LeadSummary | null> => {
      const { data, error } = await supabase
        .from("sdr_leads")
        .select("client_name, value, temperature, sdr_status, last_contact_at")
        .eq("id", leadId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as LeadSummary | null;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["lead-history", leadId], enabled: open && !!leadId,
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase.rpc("sdr_lead_history" as never, { _lead_id: leadId } as never);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
  });

  const lightest = useMemo(() => sellers[0]?.user_id ?? "", [sellers]);
  const applySuggestion = () => { if (lightest) { setTarget(lightest); toast.success("Sugestão aplicada: vendedor com menor carga"); } };

  const daysSince = (iso: string | null) => {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  };

  const canSubmit = !!target && notes.trim().length >= 20 && (!hasMeeting || !!meetingDate) && bantScore >= 3;

  const submit = async () => {
    if (notes.trim().length < 20) { setNotesError(true); return; }
    if (!target) return;
    if (bantScore < 3) {
      toast.error(`Preencha mais ${3 - bantScore} campo(s) BANT para proteger o tempo do Closer`);
      return;
    }

    let meetingAt: string | null = null;
    if (hasMeeting && meetingDate) {
      meetingAt = new Date(`${meetingDate}T${meetingTime || "09:00"}:00`).toISOString();
    }

    setSaving(true);

    // 1) Save BANT fields first
    const { error: bantErr } = await supabase
      .from("sdr_leads")
      .update({
        bant_budget: bantBudget || null,
        bant_authority: bantAuthority.trim() || null,
        bant_need: bantNeed.trim() || null,
        bant_timeline: bantTimeline || null,
      } as never)
      .eq("id", leadId);
    if (bantErr) { setSaving(false); return toast.error("Falha ao salvar BANT: " + bantErr.message); }

    // 2) Handoff
    const { error } = await supabase.rpc("handoff_lead_to_seller" as never, {
      _lead_id: leadId,
      _seller_id: target,
      _handoff_notes: notes.trim(),
      _meeting_at: meetingAt,
    } as never);
    setSaving(false);
    if (error) return toast.error("Falha: " + error.message);

    const closerName = sellers.find(s => s.user_id === target)?.full_name ?? "Closer";
    toast.success(`Lead transferido para ${closerName}! ✓`);
    qc.invalidateQueries({ queryKey: ["proposal-bank"] });
    qc.invalidateQueries({ queryKey: ["sdr-lead", leadId] });
    qc.invalidateQueries({ queryKey: ["my-handoff-leads"] });
    qc.invalidateQueries({ queryKey: ["seller-suggestions"] });
    qc.invalidateQueries({ queryKey: ["sdr-wallet"] });
    onOpenChange(false);
  };


  const days = daysSince(lead?.last_contact_at ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transferir para Closer</DialogTitle>
          <DialogDescription>
            {leadLabel ? <><strong>{leadLabel}</strong>{lead?.value ? <> · {brl(Number(lead.value))}</> : null}</> : "Selecione o closer."}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do lead */}
        {lead && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {lead.temperature && (
                <Badge className={TEMP_COLORS[lead.temperature] ?? "bg-secondary"}>{lead.temperature}</Badge>
              )}
              {lead.sdr_status && <Badge variant="outline">{lead.sdr_status}</Badge>}
              <span className="text-muted-foreground">
                {days === null ? "Sem contato registrado" : days === 0 ? "Contato hoje" : `${days} dia${days > 1 ? "s" : ""} sem contato`}
              </span>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Últimos eventos</div>
              {history.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nenhuma ligação ou tratativa registrada</div>
              ) : (
                <ul className="space-y-1">
                  {history.slice(0, 3).map((h, i) => (
                    <li key={i} className="text-xs flex gap-2">
                      <Phone className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground">{h.data ? dateTimeBR(h.data) : "—"}</span>
                        {h.resultado && <span className="ml-2 font-medium">{h.resultado}</span>}
                        {h.observacao && <div className="text-muted-foreground truncate">{h.observacao}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* BANT */}
        <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/30 p-3">
          <div>
            <div className="text-sm font-semibold text-[#0F2D5E]">Qualificação antes de transferir</div>
            <div className="text-[11px] text-muted-foreground">Preencha pelo menos 3 de 4 campos para proteger o tempo do Closer.</div>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">B — Budget (verba) <span className="text-red-600">*</span></Label>
              <Select value={bantBudget} onValueChange={(v) => setBantBudget(v as typeof bantBudget)}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">✅ Sim — verba aprovada</SelectItem>
                  <SelectItem value="parcial">⚠️ Parcial — verba em aprovação</SelectItem>
                  <SelectItem value="nao">❌ Não — sem verba definida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">T — Timeline (prazo)</Label>
              <Select value={bantTimeline} onValueChange={(v) => setBantTimeline(v as typeof bantTimeline)}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="este_mes">Este mês</SelectItem>
                  <SelectItem value="1_3_meses">1 a 3 meses</SelectItem>
                  <SelectItem value="3_6_meses">3 a 6 meses</SelectItem>
                  <SelectItem value="6_meses_mais">Mais de 6 meses</SelectItem>
                  <SelectItem value="indefinido">Indefinido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">A — Authority (decisor)</Label>
            <Input
              value={bantAuthority}
              onChange={(e) => setBantAuthority(e.target.value)}
              placeholder='Ex: "João Silva — Diretor de Operações"'
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">N — Need (necessidade)</Label>
            <Textarea
              value={bantNeed}
              onChange={(e) => setBantNeed(e.target.value)}
              placeholder="Qual o projeto específico? Câmara fria? Túnel? Rack? Qual capacidade?"
              rows={2}
            />
          </div>

          {/* Indicador de progresso */}
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0,1,2,3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded ${
                    i < bantScore
                      ? (bantScore === 4 ? "bg-emerald-500" : bantScore === 3 ? "bg-amber-500" : "bg-red-500")
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {bantScore} de 4 campos preenchidos
              {bantScore < 3 && (
                <span className="text-red-600 font-medium"> · preencha mais {3 - bantScore} para liberar a transferência</span>
              )}
            </div>
          </div>
        </div>

        {/* Closer */}
        <div className="space-y-2">

          <div className="flex items-center justify-between">
            <Label>Closer responsável</Label>
            {lightest && (
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={applySuggestion}>
                <Sparkles className="h-3 w-3" /> Sugerir (menor carga)
              </Button>
            )}
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
            {sellers.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Sem closers cadastrados.</div>}
            {sellers.map((s) => {
              const isSelected = target === s.user_id;
              const isLightest = s.user_id === lightest;
              return (
                <button
                  key={s.user_id} type="button" onClick={() => setTarget(s.user_id)}
                  className={`w-full text-left p-2.5 flex items-center gap-3 transition-colors ${isSelected ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-muted/50"}`}
                >
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {s.full_name ?? s.email ?? s.user_id}
                      {isLightest && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />menor carga</Badge>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">{s.active_count} {s.active_count === 1 ? "lead" : "leads"}</Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Contexto */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Contexto para o Closer <span className="text-red-600">*</span></Label>
          <Textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); if (e.target.value.trim().length >= 20) setNotesError(false); }}
            placeholder="Qual a dor principal? O que mais interessou? Melhor horário? Há concorrentes no processo?"
            rows={4}
            className={notesError ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          <div className="flex justify-between text-[11px]">
            <span className={notes.trim().length < 20 ? "text-red-600" : "text-muted-foreground"}>
              Mínimo 20 caracteres
            </span>
            <span className="text-muted-foreground">{notes.trim().length}/20</span>
          </div>
        </div>

        {/* Reunião */}
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 cursor-pointer" htmlFor="has-meeting">
              <CalendarIcon className="h-3.5 w-3.5" /> Reunião tem data definida?
            </Label>
            <Switch id="has-meeting" checked={hasMeeting} onCheckedChange={setHasMeeting} />
          </div>
          {hasMeeting && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Data</Label>
                <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Hora</Label>
                <Input type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit || saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? "Transferindo…" : "Transferir agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
