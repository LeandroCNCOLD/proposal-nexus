import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Phone, FileText, Calendar, ExternalLink, Thermometer, DollarSign, User, MapPin, Mail, Briefcase, History, UserPlus, CheckCircle2, Pencil } from 'lucide-react'
import { dateBR, dateTimeBR } from '@/lib/format'
import { TransferToSellerDialog } from '@/components/sdr/TransferToSellerDialog'
import { LeadEditDialog } from '@/components/sdr/LeadEditDialog'
import { LeadEditHistory } from '@/components/sdr/LeadEditHistory'
import { LeadActivitiesPanel } from '@/components/activities/LeadActivitiesPanel'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/app/sdr/leads/$id')({
  component: LeadDetailPage,
})

function fmtBRL(v: number | null | undefined) {
  return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function LeadDetailPage() {
  const { id } = Route.useParams()
  const { user, hasAnyRole } = useAuth()
  const [transferOpen, setTransferOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'all'>('30')

  const { data: lead, isLoading } = useQuery({
    queryKey: ['sdr-lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_leads').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
  })

  // Quando o closer abre o lead recebido pela 1ª vez, marca o timestamp
  useEffect(() => {
    if (!lead || !user?.id) return
    const isTransferredToMe = (lead as any).transferred_to_seller_id === user.id
    const notOpenedYet = !(lead as any).first_opened_by_seller_at
    if (isTransferredToMe && notOpenedYet) {
      supabase.rpc('mark_lead_opened_by_seller' as never, { _lead_id: id } as never).then(() => {})
    }
  }, [lead, user?.id, id])

  const since = useMemo(() => {
    if (period === 'all') return null
    const d = new Date(); d.setDate(d.getDate() - Number(period)); return d.toISOString()
  }, [period])

  const { data: activity = [] } = useQuery({
    queryKey: ['sdr-lead-activity', id, period],
    queryFn: async () => {
      const calls = supabase.from('crm_call_logs')
        .select('id, call_date, call_time, result, observation, channel, temperature_after, sdr_name, sdr_id, created_at')
        .eq('pipeline_id', id).order('created_at', { ascending: false }).limit(200)
      const notes = supabase.from('crm_notes')
        .select('id, body, created_at, created_by').eq('pipeline_id', id)
        .order('created_at', { ascending: false }).limit(200)
      const fups = supabase.from('crm_followups')
        .select('id, due_at, kind, note, status, created_at, created_by').eq('pipeline_id', id)
        .order('created_at', { ascending: false }).limit(100)
      const stages = supabase.from('crm_stage_changes')
        .select('id, from_stage_id, to_stage_id, created_at, created_by').eq('pipeline_id', id)
        .order('created_at', { ascending: false }).limit(100)
      const [c, n, f, s] = await Promise.all([calls, notes, fups, stages])

      const items = [
        ...((c.data ?? []).map((x: any) => {
          const obs = (x.observation ?? '').trim()
          const isScript = /Script\s+"/i.test(obs) || /—\s*(Abertura|Descoberta|Fechamento)/i.test(obs)
          return {
            kind: 'call' as const, id: x.id,
            ts: x.created_at || `${x.call_date}T${x.call_time ?? '00:00'}`,
            title: isScript ? `Script de ligação · ${x.channel ?? 'telefone'}` : `Ligação · ${x.channel ?? 'telefone'}`,
            result: x.result ?? null,
            detail: obs,
            actor: x.sdr_name ?? null,
            extra: x.temperature_after ? `Temp.: ${x.temperature_after}` : null,
            isScript,
          }
        })),
        ...((n.data ?? []).map((x: any) => ({
          kind: 'note' as const, id: x.id, ts: x.created_at,
          title: 'Anotação do SDR', detail: x.body ?? '', actor: null, extra: null, result: null, isScript: false,
        }))),
        ...((f.data ?? []).map((x: any) => ({
          kind: 'followup' as const, id: x.id, ts: x.created_at,
          title: `Follow-up · ${x.kind ?? ''}`.trim(),
          detail: [x.note, x.due_at ? `Para: ${dateBR(x.due_at)}` : null, x.status].filter(Boolean).join(' · '),
          actor: null, extra: null, result: null, isScript: false,
        }))),
        ...((s.data ?? []).map((x: any) => ({
          kind: 'stage' as const, id: x.id, ts: x.created_at,
          title: 'Mudança de etapa', detail: '', actor: null, extra: null, result: null, isScript: false,
        }))),
      ]
      const filtered = since ? items.filter((it) => new Date(it.ts) >= new Date(since)) : items
      return filtered.sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    },
    enabled: !!id,
  })

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Carregando lead…</div>
  }
  if (!lead) {
    return (
      <div className="p-6 space-y-3">
        <Link to="/app/sdr/bank" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Banco de Leads
        </Link>
        <div className="text-red-700">Lead não encontrado.</div>
      </div>
    )
  }

  const lastActivity = activity[0]?.ts

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/app/sdr/bank" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Banco de Leads
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil className="h-4 w-4" /> Editar lead
          </Button>
          {(lead as any).handoff_status === 'transferred' ? (
            <Badge className="bg-emerald-100 text-emerald-800 gap-1"><CheckCircle2 className="h-3 w-3" />Transferido para {(lead as any).transferred_to_seller_name ?? 'vendedor'}</Badge>
          ) : (
            (lead.sdr_id === user?.id || hasAnyRole(['admin','diretoria','gerente_comercial'] as never)) && (
              <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" /> Transferir para vendedor
              </Button>
            )
          )}
        </div>
      </div>
      <TransferToSellerDialog open={transferOpen} onOpenChange={setTransferOpen} leadId={id} leadLabel={lead.client_name} />
      <LeadEditDialog open={editOpen} onOpenChange={setEditOpen} leadId={id} lead={lead} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="font-mono">{lead.lead_code}</Badge>
            {lead.proposal_version != null && <Badge variant="secondary">Rev. {String(lead.proposal_version).padStart(2, '0')}</Badge>}
            {lead.proposal_status && <Badge className="bg-blue-100 text-blue-800">{lead.proposal_status}</Badge>}
            {lead.temperature && <Badge className="bg-orange-100 text-orange-800"><Thermometer className="h-3 w-3 mr-1" />{lead.temperature}</Badge>}
            {lead.sdr_status && <Badge variant="outline">{lead.sdr_status}</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] mt-2">{lead.client_name}</h1>
          {lead.razao_social && lead.razao_social !== lead.client_name && (
            <p className="text-sm text-muted-foreground">{lead.razao_social}</p>
          )}
          {lead.cnpj && <p className="text-xs font-mono text-muted-foreground">{lead.cnpj}</p>}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Valor</div>
          <div className="text-2xl font-bold text-[#0F2D5E]">{fmtBRL(lead.value)}</div>
          {lead.discount_pct != null && (
            <div className="text-xs text-muted-foreground">Desconto: {Number(lead.discount_pct).toFixed(1)}%</div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" />Contato</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>{lead.contact_name || '—'}</div>
            {lead.contact_mobile && <div className="font-mono text-xs">{lead.contact_mobile}</div>}
            {lead.contact_phone && lead.contact_phone !== lead.contact_mobile && <div className="font-mono text-xs">{lead.contact_phone}</div>}
            {lead.contact_email && <div className="text-xs inline-flex items-center gap-1"><Mail className="h-3 w-3" />{lead.contact_email}</div>}
            {(lead.city || lead.state) && (
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{[lead.city, lead.state].filter(Boolean).join(' / ')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4" />Atribuição</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">SDR responsável:</span> <strong>{lead.sdr_name || '—'}</strong></div>
            <div><span className="text-muted-foreground">Carteira:</span> <strong>{lead.locked_by_sdr_name || 'Livre'}</strong></div>
            {lead.locked_at && <div className="text-xs text-muted-foreground">Travado em {dateTimeBR(lead.locked_at)}</div>}
            {lead.lock_expires_at && <div className="text-xs text-muted-foreground">Expira em {dateTimeBR(lead.lock_expires_at)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" />Última atividade</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Último contato:</span> {dateBR(lead.last_contact_at) || '—'}</div>
            <div><span className="text-muted-foreground">Próximo contato:</span> {dateBR(lead.next_contact_at) || '—'}</div>
            <div><span className="text-muted-foreground">Cadastro proposta:</span> {dateBR(lead.proposal_date || lead.created_at) || '—'}</div>
            {lastActivity && <div className="text-xs text-muted-foreground pt-1 border-t">Último evento: {dateTimeBR(lastActivity)}</div>}
          </CardContent>
        </Card>
      </div>

      {(lead.proposal_title || lead.proposal_desc) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Proposta</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {lead.proposal_title && <div className="font-semibold">{lead.proposal_title}</div>}
            {lead.proposal_desc && <div className="whitespace-pre-wrap text-muted-foreground">{lead.proposal_desc}</div>}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground pt-2">
              {lead.delivery_term && <div><span className="block uppercase tracking-wide">Prazo</span><span className="text-foreground">{lead.delivery_term}</span></div>}
              {lead.validity_days != null && <div><span className="block uppercase tracking-wide">Validade</span><span className="text-foreground">{lead.validity_days} dias</span></div>}
              {lead.expected_delivery && <div><span className="block uppercase tracking-wide">Entrega prevista</span><span className="text-foreground">{dateBR(lead.expected_delivery)}</span></div>}
              {lead.expected_closing && <div><span className="block uppercase tracking-wide">Fechamento previsto</span><span className="text-foreground">{dateBR(lead.expected_closing)}</span></div>}
            </div>
          </CardContent>
        </Card>
      )}

      {(lead.internal_note || lead.call_observation) && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Notas do SDR</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {lead.internal_note && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Nota interna</div>
                <div className="whitespace-pre-wrap">{lead.internal_note}</div>
              </div>
            )}
            {lead.call_observation && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Observação da última ligação</div>
                <div className="whitespace-pre-wrap">{lead.call_observation}</div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm">Histórico de atividades do SDR</CardTitle>
          <div className="flex gap-1">
            {(['7', '30', '90', 'all'] as const).map((d) => (
              <Button key={d} size="sm" variant={period === d ? 'default' : 'outline'} onClick={() => setPeriod(d)}>
                {d === 'all' ? 'Tudo' : `${d} dias`}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Sem atividade registrada no período.</div>
          ) : (
            <div className="space-y-2">
              {activity.map((a: any) => (
                <div key={`${a.kind}-${a.id}`} className={`rounded-md border p-3 text-sm ${a.isScript ? 'bg-emerald-50/60 border-emerald-200' : 'bg-card'}`}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {a.kind === 'call' && <Phone className="h-3 w-3" />}
                    {a.kind === 'note' && <FileText className="h-3 w-3" />}
                    {a.kind === 'followup' && <Calendar className="h-3 w-3" />}
                    {a.kind === 'stage' && <ExternalLink className="h-3 w-3" />}
                    <span className="font-semibold uppercase tracking-wide">{a.title}</span>
                    {a.actor && <span className="text-foreground/80">por {a.actor}</span>}
                    {a.extra && <span>· {a.extra}</span>}
                    <span className="ml-auto">{dateTimeBR(a.ts)}</span>
                  </div>
                  {a.result && (
                    <div className="mt-1.5">
                      <Badge variant="secondary" className="text-[11px]">Resultado: {a.result}</Badge>
                    </div>
                  )}
                  {a.detail && (
                    <div className="mt-2">
                      {a.isScript && (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 mb-1">Respostas do script</div>
                      )}
                      {a.kind === 'note' && (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Nota do SDR</div>
                      )}
                      <div className="whitespace-pre-wrap text-foreground/90 leading-relaxed">{a.detail}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>

      <LeadActivitiesPanel leadId={id} clientName={lead.client_name} />

      <LeadEditHistory leadId={id} />



      <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
        <DollarSign className="h-3 w-3" />
        Valor total da proposta: <strong className="text-foreground">{fmtBRL(lead.value)}</strong>
      </div>
    </div>
  )
}
