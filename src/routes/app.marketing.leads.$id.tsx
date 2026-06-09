import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getMarketingLead, updateMarketingLeadStatus, assignMarketingLead,
  discardMarketingLead, convertMarketingLead, listMarketingAssignees, markMarketingFirstResponse,
  claimMarketingLead, updateMarketingLeadNote,
} from "@/lib/marketing-leads.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRightCircle, UserPlus, Trash2, PhoneCall, Hand, Save, ArrowLeft, Mail, Phone, MapPin, MessageSquare, Building2, Info } from "lucide-react";

export const Route = createFileRoute("/app/marketing/leads/$id")({
  component: MarketingLeadDetailPage,
});

// Friendly labels for origem_detalhe fields
const DETALHE_LABELS: Record<string, string> = {
  tipo_contato: "Tipo de contato",
  direcionado_para: "Direcionado para",
  status_original: "Status original",
  origem_planilha: "Origem (planilha)",
  sheet: "Aba/Planilha",
  data_acao: "Data da ação",
  referer: "Página de origem",
  user_agent: "Navegador",
  ip: "IP",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_term: "UTM Term",
  utm_content: "UTM Content",
};

function fmtDetalheValue(key: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (key === "data_acao" && typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function MarketingLeadDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const getOne = useServerFn(getMarketingLead);
  const updateStatus = useServerFn(updateMarketingLeadStatus);
  const assign = useServerFn(assignMarketingLead);
  const discard = useServerFn(discardMarketingLead);
  const convert = useServerFn(convertMarketingLead);
  const listAssignees = useServerFn(listMarketingAssignees);
  const markResp = useServerFn(markMarketingFirstResponse);
  const claim = useServerFn(claimMarketingLead);
  const updateNote = useServerFn(updateMarketingLeadNote);

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
  const [note, setNote] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);

  useEffect(() => {
    if (data?.lead && !noteDirty) setNote(data.lead.internal_note ?? "");
  }, [data?.lead, noteDirty]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;
  if (!data?.lead) return <div className="p-6">Lead não encontrado.</div>;
  const lead = data.lead;
  const now = Date.now();
  const lockExp = lead.lock_expires_at ? new Date(lead.lock_expires_at).getTime() : 0;
  const lockedByMe = lead.locked_by_sdr_id === user?.id && lockExp > now;
  const lockedByOther = !!lead.locked_by_sdr_id && lead.locked_by_sdr_id !== user?.id && lockExp > now;

  const refresh = () => qc.invalidateQueries({ queryKey: ["marketing"] });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  const detalheEntries = lead.origem_detalhe
    ? Object.entries(lead.origem_detalhe).filter(([, v]) => v !== null && v !== "")
    : [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/app/marketing/leads">
          <Button size="sm" variant="ghost"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        </Link>
        <span className="text-xs font-mono text-muted-foreground">{lead.lead_code}</span>
        <Badge>{lead.status}</Badge>
        {lockedByMe && <Badge className="bg-emerald-100 text-emerald-800">Na sua carteira</Badge>}
        {lockedByOther && <Badge variant="secondary">Com {lead.locked_by_sdr_name ?? "outro SDR"}</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Identificação */}
          <div className="bg-card border rounded-lg p-4">
            <h1 className="text-xl font-bold text-[#0F2D5E] flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {lead.client_name ?? lead.contact_name ?? "Sem nome"}
            </h1>
            {lead.contact_name && lead.client_name && (
              <div className="text-sm text-muted-foreground mt-0.5">Contato: {lead.contact_name}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">E-mail</div>
                  {lead.contact_email ? (
                    <a href={`mailto:${lead.contact_email}`} className="text-primary hover:underline">{lead.contact_email}</a>
                  ) : "—"}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Telefone</div>
                  {lead.contact_phone ? (
                    <a href={`tel:${lead.contact_phone}`} className="text-primary hover:underline">{lead.contact_phone}</a>
                  ) : "—"}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Cidade/UF</div>
                  {[lead.city, lead.state].filter(Boolean).join("/") || "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Origem</div>
                <span className="capitalize">{lead.origem}</span>
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Segmento</div>
                {lead.segmento ?? "—"}
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Aplicação</div>
                {lead.aplicacao ?? "—"}
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">Recebido</div>
                {new Date(lead.received_at).toLocaleString("pt-BR")}
              </div>
              <div>
                <div className="text-[11px] uppercase text-muted-foreground">1ª resposta</div>
                {lead.first_response_at ? new Date(lead.first_response_at).toLocaleString("pt-BR") : "—"}
              </div>
            </div>
          </div>

          {/* Mensagem / pedido do cliente */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-amber-900">O que o cliente pediu</h2>
            </div>
            {lead.mensagem ? (
              <p className="text-sm whitespace-pre-wrap text-amber-950">{lead.mensagem}</p>
            ) : (
              <p className="text-sm text-amber-900/70 italic">Sem mensagem enviada pelo cliente.</p>
            )}
          </div>

          {/* Detalhes adicionais (origem_detalhe) */}
          {detalheEntries.length > 0 && (
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-[#0F2D5E]">Detalhes da origem</h2>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {detalheEntries.map(([k, v]) => (
                  <div key={k} className="border-b border-border/40 pb-1">
                    <dt className="text-[11px] uppercase text-muted-foreground">{DETALHE_LABELS[k] ?? k}</dt>
                    <dd className="break-words">{fmtDetalheValue(k, v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Observações internas */}
          <div className="bg-card border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-[#0F2D5E] mb-2">Observações internas</h2>
            <Textarea
              rows={5}
              value={note}
              onChange={(e) => { setNote(e.target.value); setNoteDirty(true); }}
              placeholder="Anote aqui o que conversou, o que o cliente busca, próximos passos, dúvidas para qualificação…"
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                disabled={!noteDirty}
                onClick={() => run(async () => {
                  await updateNote({ data: { id: lead.id, internal_note: note.trim() || null } });
                  setNoteDirty(false);
                }, "Observações salvas")}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" /> Salvar observações
              </Button>
            </div>
          </div>

          {/* Linha do tempo */}
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
          {/* Pegar / qualificar */}
          {!lockedByMe && !lockedByOther && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold text-blue-900">Pegar este lead</h3>
              <p className="text-[11px] text-blue-900/80">Trava por 7 dias na sua carteira para tratar e qualificar.</p>
              <Button size="sm" className="w-full" onClick={() => run(() => claim({ data: { lead_id: lead.id } }), "Lead na sua carteira")}>
                <Hand className="w-3.5 h-3.5 mr-1.5" /> Pegar pra mim
              </Button>
            </div>
          )}

          <div className="bg-card border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#0F2D5E]">Tratamento & Qualificação</h3>

            <Button size="sm" className="w-full" variant="outline"
              onClick={() => run(() => markResp({ data: { lead_id: lead.id } }), "1ª resposta registrada")}>
              <PhoneCall className="w-3.5 h-3.5 mr-1.5" /> Registrei 1ª resposta
            </Button>

            <div>
              <label className="text-xs text-muted-foreground">Status</label>
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
            <h3 className="text-sm font-semibold text-emerald-900">Converter em lead qualificado (SDR)</h3>
            <p className="text-[11px] text-emerald-900/80">Cria um lead na carteira de vendas com prioridade 0. Opcionalmente já direcione a um SDR.</p>
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
    </div>
  );
}
