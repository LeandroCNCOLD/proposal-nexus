import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getMarketingLead, updateMarketingLeadStatus, assignMarketingLead,
  discardMarketingLead, convertMarketingLead, listMarketingAssignees, markMarketingFirstResponse,
} from "@/lib/marketing-leads.functions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRightCircle, UserPlus, Trash2, PhoneCall } from "lucide-react";

export const Route = createFileRoute("/app/marketing/leads/$id")({
  component: MarketingLeadDetailPage,
});

function MarketingLeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getOne = useServerFn(getMarketingLead);
  const updateStatus = useServerFn(updateMarketingLeadStatus);
  const assign = useServerFn(assignMarketingLead);
  const discard = useServerFn(discardMarketingLead);
  const convert = useServerFn(convertMarketingLead);
  const listAssignees = useServerFn(listMarketingAssignees);
  const markResp = useServerFn(markMarketingFirstResponse);

  const { data, isLoading } = useQuery({
    queryKey: ["marketing", "lead", id],
    queryFn: () => getOne({ data: { id } }),
  });
  const { data: people } = useQuery({
    queryKey: ["marketing", "assignees"],
    queryFn: () => listAssignees({ data: undefined as never }),
    staleTime: 5 * 60_000,
  });

  const [discardReason, setDiscardReason] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [sdrForConvert, setSdrForConvert] = useState<string>("");

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!data?.lead) return <div className="p-6">Lead não encontrado.</div>;
  const lead = data.lead;

  const refresh = () => qc.invalidateQueries({ queryKey: ["marketing"] });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-muted-foreground">{lead.lead_code}</div>
              <h1 className="text-xl font-bold text-[#0F2D5E]">{lead.client_name ?? lead.contact_name ?? "Sem nome"}</h1>
              <div className="text-sm text-muted-foreground">{lead.contact_name}</div>
            </div>
            <Badge>{lead.status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div><span className="text-muted-foreground">E-mail:</span> {lead.contact_email ?? "—"}</div>
            <div><span className="text-muted-foreground">Telefone:</span> {lead.contact_phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Cidade/UF:</span> {[lead.city, lead.state].filter(Boolean).join("/") || "—"}</div>
            <div><span className="text-muted-foreground">Origem:</span> <span className="capitalize">{lead.origem}</span></div>
            <div><span className="text-muted-foreground">Segmento:</span> {lead.segmento ?? "—"}</div>
            <div><span className="text-muted-foreground">Aplicação:</span> {lead.aplicacao ?? "—"}</div>
            <div><span className="text-muted-foreground">1ª resposta:</span> {lead.first_response_at ? new Date(lead.first_response_at).toLocaleString("pt-BR") : "—"}</div>
            <div><span className="text-muted-foreground">Recebido:</span> {new Date(lead.received_at).toLocaleString("pt-BR")}</div>
          </div>
          {lead.mensagem && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase">Mensagem</div>
              <p className="text-sm whitespace-pre-wrap mt-1">{lead.mensagem}</p>
            </div>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[#0F2D5E] mb-3">Linha do tempo</h2>
          <ul className="space-y-2 text-sm">
            {data.events.map((ev) => (
              <li key={ev.id} className="border-l-2 border-primary/40 pl-3">
                <div className="text-xs font-semibold uppercase text-muted-foreground">{ev.event_type}</div>
                {ev.actor_name && <div className="text-[11px] text-muted-foreground">por {ev.actor_name}</div>}
                <div className="text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString("pt-BR")}</div>
                {ev.payload != null && (
                  <pre className="text-[11px] mt-1 text-muted-foreground whitespace-pre-wrap">{JSON.stringify(ev.payload, null, 2)}</pre>
                )}
              </li>
            ))}
            {data.events.length === 0 && <li className="text-muted-foreground text-xs">Sem eventos.</li>}
          </ul>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[#0F2D5E]">Ações</h3>

          <Button size="sm" className="w-full" variant="outline"
            onClick={() => run(() => markResp({ data: { lead_id: lead.id } }), "1ª resposta registrada")}>
            <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Registrei 1ª resposta
          </Button>

          <div>
            <label className="text-xs text-muted-foreground">Mudar status</label>
            <Select value={lead.status} onValueChange={(v) => run(() => updateStatus({ data: { id: lead.id, status: v as never } }), "Status atualizado")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="tentando_contato">Tentando contato</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Atribuir a</label>
            <div className="flex gap-2 mt-1">
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {(people ?? []).map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? p.email} ({p.roles.join(",")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!assigneeId}
                onClick={() => run(() => assign({ data: { lead_id: lead.id, user_id: assigneeId } }), "Atribuído")}>
                <UserPlus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-emerald-900">Converter em lead comercial (SDR)</h3>
          <p className="text-[11px] text-emerald-900/80">Cria um lead na carteira com prioridade 0. Opcionalmente já direcione a um SDR.</p>
          <Select value={sdrForConvert} onValueChange={setSdrForConvert}>
            <SelectTrigger><SelectValue placeholder="Sem SDR (fila do gestor)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem SDR (gestor distribui)</SelectItem>
              {(people ?? []).filter(p => p.roles.includes("sdr")).map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name ?? p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="w-full bg-emerald-700 hover:bg-emerald-800"
            onClick={() => run(async () => {
              const res = await convert({ data: { lead_id: lead.id, sdr_id: sdrForConvert || null } });
              setTimeout(() => navigate({ to: "/app/sdr/leads/$id", params: { id: (res as { sdr_lead_id: string }).sdr_lead_id } }), 800);
            }, "Convertido com sucesso")}>
            <ArrowRightCircle className="w-3.5 h-3.5 mr-1.5" /> Converter para SDR
          </Button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold text-red-900">Descartar lead</h3>
          <Textarea rows={3} placeholder="Motivo (obrigatório, mín. 3 chars)" value={discardReason} onChange={(e) => setDiscardReason(e.target.value)} />
          <Button size="sm" variant="destructive" className="w-full" disabled={discardReason.trim().length < 3}
            onClick={() => run(() => discard({ data: { lead_id: lead.id, reason: discardReason.trim() } }), "Lead descartado")}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Descartar
          </Button>
        </div>
      </div>
    </div>
  );
}
