import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { fetchMyWallet, unlockLead, renewLock, updatePipelineField, fetchCallLogs, insertCallLog } from '@/modules/sdr/services'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import {
  CALL_RESULT_OPTIONS, TEMPERATURE_OPTIONS, CALL_CHANNEL_OPTIONS,
  type CrmPipeline, type CrmCallLog, type CallResult, type Temperature, type SdrStatus, type CallChannel,
} from '@/modules/sdr/types'
import { useCloserNames } from '@/modules/sdr/hooks/use-team-members'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Unlock, Clock, MapPin, Phone, DollarSign, ChevronDown, ChevronUp, Mail, Building2, FileText, Calendar, AlertTriangle, History, Paperclip, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { CallScriptDialog } from '@/modules/sdr/components/CallScriptDialog'

export const Route = createFileRoute('/app/sdr/wallet')({
  component: WalletPage,
})

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function WalletPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const sdrName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SDR'
  const closerNames = useCloserNames()

  const [scriptLead, setScriptLead] = useState<CrmPipeline | null>(null)

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['my-wallet', user?.id],
    queryFn: () => (user ? fetchMyWallet(user.id) : Promise.resolve([])),
    enabled: !!user,
  })

  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockLead(id),
    onSuccess: () => {
      toast.success('Lead devolvido ao banco.')
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
    },
  })

  if (!user) return <div className="p-6">Faça login para ver sua carteira.</div>

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Minha Carteira</h1>
        <p className="text-sm text-muted-foreground">{leads.length} leads travados · cada lock dura 7 dias e renova ao registrar atividade</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Você ainda não pegou nenhum lead. Vá ao <strong>Banco de Leads</strong> para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              sdrName={sdrName}
              onOpenScript={() => setScriptLead(lead)}
              onUnlock={() => {
                if (confirm(`Devolver "${lead.client_name}" ao banco?`)) unlockMut.mutate(lead.id)
              }}
            />
          ))}
        </div>
      )}

      <CallScriptDialog
        lead={scriptLead}
        open={!!scriptLead}
        onOpenChange={(o) => !o && setScriptLead(null)}
      />
    </div>
  )
}

function LeadCard({ lead, sdrName, onUnlock, onOpenScript }: {
  lead: CrmPipeline
  sdrName: string
  onUnlock: () => void
  onOpenScript: () => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [result, setResult] = useState<CallResult | ''>('')
  const [tempAfter, setTempAfter] = useState<Temperature | ''>(lead.temperature)
  const [observation, setObservation] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [meetingBooked, setMeetingBooked] = useState(false)
  const [meetingDate, setMeetingDate] = useState('')
  const [closer, setCloser] = useState<string>('')
  const [channel, setChannel] = useState<CallChannel>('Telefone')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const nowLocal = () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }
  const [attemptAt, setAttemptAt] = useState<string>(nowLocal())

  const remaining = daysUntil(lead.lock_expires_at)
  const requiresProof = channel === 'WhatsApp' || channel === 'E-mail' || channel === 'Outro'

  const { data: callLogs = [] } = useQuery({
    queryKey: ['call-logs', lead.id],
    queryFn: () => fetchCallLogs({ pipelineId: lead.id }),
    refetchInterval: 60_000,
  })
  // Só conta tentativas validadas: telefone sempre conta; canais alternativos só com print
  const validAttempts = callLogs.filter(l => (l.channel ?? 'Telefone') === 'Telefone' || l.proof_validated)
  const attemptCount = validAttempts.length
  const alertManagement = attemptCount >= 3

  const registerMut = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('Escolha o resultado da ligação')
      if (requiresProof && !proofFile) {
        throw new Error(`Para contato por ${channel} é obrigatório anexar o print da conversa.`)
      }
      const when = attemptAt ? new Date(attemptAt) : new Date()
      const dateStr = when.toISOString().slice(0, 10)
      const timeStr = when.toTimeString().slice(0, 5)

      let proofPath: string | null = null
      if (proofFile) {
        const safe = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `call-logs/${lead.id}/${Date.now()}_${safe}`
        const { error: upErr } = await supabase.storage
          .from('crm-attachments')
          .upload(path, proofFile, { contentType: proofFile.type || 'application/octet-stream', upsert: false })
        if (upErr) throw new Error(`Falha no upload do print: ${upErr.message}`)
        proofPath = path
      }

      await insertCallLog({
        pipeline_id: lead.id,
        sdr_id: lead.locked_by_sdr_id,
        sdr_name: sdrName,
        call_date: dateStr,
        call_time: timeStr,
        duration_min: null,
        result: result as CallResult,
        temperature_after: tempAfter || null,
        meeting_booked: meetingBooked,
        observation: observation || null,
        channel,
        proof_path: proofPath,
        proof_validated: channel === 'Telefone' ? true : !!proofPath,
      })

      // Alerta para gestão na 3ª tentativa (sem reunião agendada)
      if (attemptCount + 1 >= 3 && !meetingBooked) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser()
          await supabase.from('audit_logs').insert({
            user_id: authUser?.id ?? null,
            action: 'SDR_ALERT_3_ATTEMPTS',
            entity_type: 'sdr_lead',
            entity_id: lead.id,
            changes: {
              lead_code: lead.lead_code,
              client_name: lead.client_name,
              sdr_name: sdrName,
              attempt_number: attemptCount + 1,
              last_result: result,
              observation: observation || null,
              triggered_at: new Date().toISOString(),
            },
          })
        } catch (err) {
          console.error('Falha ao registrar alerta de gestão', err)
        }
      }

      const updates: Array<Promise<unknown>> = [renewLock(lead.id)]
      if (tempAfter)   updates.push(updatePipelineField(lead.id, 'temperature', tempAfter))
      if (observation) updates.push(updatePipelineField(lead.id, 'call_observation', observation))
      if (nextStep)    updates.push(updatePipelineField(lead.id, 'next_step', nextStep))
      updates.push(updatePipelineField(lead.id, 'last_contact_at', when.toISOString()))
      updates.push(updatePipelineField(lead.id, 'call_result', result as CallResult))

      if (meetingBooked) {
        updates.push(updatePipelineField(lead.id, 'meeting_scheduled', true))
        updates.push(updatePipelineField(lead.id, 'sdr_status', 'Reunião Agendada' as SdrStatus))
        if (meetingDate) updates.push(updatePipelineField(lead.id, 'meeting_date', meetingDate))
        if (closer) {
          updates.push(updatePipelineField(lead.id, 'closer_name', closer))
        }
      }

      await Promise.all(updates)
    },
    onSuccess: () => {
      const willAlert = attemptCount + 1 >= 3 && !meetingBooked
      toast.success(
        meetingBooked
          ? 'Reunião agendada — Closer notificado!'
          : willAlert
            ? `Tentativa #${attemptCount + 1} registrada — Gestão notificada!`
            : `Tentativa #${attemptCount + 1} registrada e lock renovado.`,
      )
      setResult(''); setObservation(''); setNextStep(''); setMeetingBooked(false); setMeetingDate(''); setCloser('')
      setChannel('Telefone'); setProofFile(null)
      setAttemptAt(nowLocal())
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      qc.invalidateQueries({ queryKey: ['call-logs', lead.id] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{lead.lead_code}</span>
            <h3 className="font-bold text-lg">{lead.client_name}</h3>
            <Badge variant="secondary">{lead.temperature}</Badge>
            <Badge variant="outline">{lead.sdr_status}</Badge>
            {lead.priority && <Badge>{lead.priority}</Badge>}
          </div>
          {lead.razao_social && lead.razao_social !== lead.client_name && (
            <div className="text-sm text-muted-foreground mt-1">
              <Building2 className="w-3 h-3 inline mr-1" />
              {lead.razao_social} {lead.cnpj && <span className="font-mono text-xs">· {lead.cnpj}</span>}
            </div>
          )}
          <div className="flex gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.city || '—'}/{lead.state || '—'}</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtBRL(lead.value)}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Lock expira em {remaining ?? '—'} dia{remaining === 1 ? '' : 's'}
            </span>
            {lead.contact_name && (
              <span className="flex items-center gap-1">👤 {lead.contact_name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onOpenScript}>
            <Phone className="w-3 h-3 mr-1" /> Ligar / Script
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            Detalhes
          </Button>
          <Button size="sm" variant="outline" onClick={onUnlock}>
            <Unlock className="w-3 h-3 mr-1" /> Devolver
          </Button>
        </div>
      </div>

      {/* DETALHES expandidos */}
      {expanded && (
        <div className="border-t pt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <DetailSection icon={<FileText className="w-4 h-4" />} title="Proposta">
              <Row label="Título" value={lead.proposal_title} />
              <Row label="Versão" value={lead.proposal_version != null ? String(lead.proposal_version) : null} />
              <Row label="Desconto" value={lead.discount_pct != null ? `${lead.discount_pct}%` : null} />
              <Row label="Validade" value={lead.validity_days ? `${lead.validity_days} dias` : null} />
              {lead.proposal_desc && (
                <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">{lead.proposal_desc}</div>
              )}
            </DetailSection>

            <DetailSection icon={<Phone className="w-4 h-4" />} title="Contato">
              <Row label="Nome" value={lead.contact_name} />
              <Row label="Celular" value={lead.contact_mobile} mono />
              <Row label="Fixo" value={lead.contact_phone} mono />
              <Row
                label="E-mail"
                value={lead.contact_email}
                renderValue={(v) => (
                  <a href={`mailto:${v}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {v}
                  </a>
                )}
              />
            </DetailSection>

            <DetailSection icon={<Calendar className="w-4 h-4" />} title="Datas e prazos">
              <Row label="Data proposta" value={fmtDate(lead.proposal_date)} />
              <Row label="Entrega prevista" value={fmtDate(lead.expected_delivery)} />
              <Row label="Fechamento esperado" value={fmtDate(lead.expected_closing)} />
              <Row label="Último contato" value={fmtDate(lead.last_contact_at)} />
              <Row label="Próximo contato" value={fmtDate(lead.next_contact_at)} />
              {lead.delivery_term && (
                <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                  <strong>Prazo entrega:</strong> {lead.delivery_term}
                </div>
              )}
            </DetailSection>
          </div>

          {(lead.call_observation || lead.internal_note || lead.next_step) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm pt-2 border-t">
              {lead.call_observation && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Última observação</div>
                  <p className="text-xs mt-1">{lead.call_observation}</p>
                </div>
              )}
              {lead.next_step && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Próximo passo</div>
                  <p className="text-xs mt-1">{lead.next_step}</p>
                </div>
              )}
              {lead.internal_note && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground">Nota interna</div>
                  <p className="text-xs mt-1 italic">{lead.internal_note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTADOR DE TENTATIVAS + ALERTA */}
      <div className="flex items-center justify-between gap-2 border-t pt-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">Tentativas de contato:</span>
          <Badge variant={alertManagement ? 'destructive' : 'secondary'}>{attemptCount}</Badge>
          <span className="text-xs text-muted-foreground">próxima será #{attemptCount + 1}</span>
        </div>
        {alertManagement && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            ALERTA — Gestão notificada (3+ tentativas)
          </Badge>
        )}
      </div>

      {/* REGISTRO DE LIGAÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold">Canal de contato *</label>
          <select value={channel} onChange={e => setChannel(e.target.value as CallChannel)} className="w-full border rounded px-2 py-1.5 text-sm">
            {CALL_CHANNEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="text-xs font-semibold">Resultado da ligação *</label>
          <select value={result} onChange={e => setResult(e.target.value as CallResult)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecione...</option>
            {CALL_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="text-xs font-semibold">Data e hora da tentativa *</label>
          <Input type="datetime-local" value={attemptAt} onChange={e => setAttemptAt(e.target.value)} />

          <label className="text-xs font-semibold">Temperatura após ligação</label>
          <select value={tempAfter} onChange={e => setTempAfter(e.target.value as Temperature)} className="w-full border rounded px-2 py-1.5 text-sm">
            {TEMPERATURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <label className="text-xs font-semibold">Próximo passo</label>
          <Input value={nextStep} onChange={e => setNextStep(e.target.value)} placeholder="Ex: ligar quinta às 14h" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold">Observação</label>
          <Textarea value={observation} onChange={e => setObservation(e.target.value)} rows={3} placeholder="O que aconteceu na ligação..." />

          {requiresProof && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 space-y-1">
              <div className="flex items-center gap-1 text-xs font-semibold text-amber-900">
                <Paperclip className="w-3 h-3" />
                Print da conversa ({channel}) — obrigatório p/ validar tentativa
              </div>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setProofFile(e.target.files?.[0] ?? null)}
              />
              {proofFile && (
                <div className="text-[11px] text-amber-900 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {proofFile.name} · {(proofFile.size / 1024).toFixed(0)} KB
                </div>
              )}
              {!proofFile && (
                <div className="text-[11px] text-amber-700 italic">
                  Sem o anexo, a tentativa não será contabilizada nem comporá o alerta da gestão.
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={meetingBooked} onChange={e => setMeetingBooked(e.target.checked)} />
            Reunião agendada?
          </label>

          {meetingBooked && (
            <div className="space-y-2 pl-6 border-l-2 border-blue-300">
              <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              <select value={closer} onChange={e => setCloser(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Selecionar Closer...</option>
                {closerNames.names.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button
          onClick={() => registerMut.mutate()}
          disabled={!result || registerMut.isPending || (requiresProof && !proofFile)}
        >
          {registerMut.isPending ? 'Salvando...' : `Registrar tentativa #${attemptCount + 1}`}
        </Button>
      </div>

      {/* LINHA DO TEMPO */}
      <CallTimeline logs={callLogs} />
    </div>
  )
}

function CallTimeline({ logs }: { logs: CrmCallLog[] }) {
  const sorted = [...logs].sort((a, b) => {
    const ka = `${a.call_date}T${a.call_time ?? '00:00'}`
    const kb = `${b.call_date}T${b.call_time ?? '00:00'}`
    return kb.localeCompare(ka)
  })
  return (
    <div className="border-t pt-3">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-2">
        <History className="w-3 h-3" /> Linha do tempo · {sorted.length} {sorted.length === 1 ? 'evento' : 'eventos'}
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma tentativa registrada ainda.</p>
      ) : (
        <ol className="relative border-l-2 border-muted ml-2 space-y-3">
          {sorted.map((log, idx) => {
            const attempt = sorted.length - idx
            const when = new Date(`${log.call_date}T${log.call_time ?? '00:00'}:00`)
            const ch = (log.channel ?? 'Telefone') as CallChannel
            const counted = ch === 'Telefone' || log.proof_validated
            const isAlert = attempt >= 3 && !log.meeting_booked && counted
            return (
              <li key={log.id} className="ml-4 relative">
                <span className={`absolute -left-[1.4rem] top-1 w-3 h-3 rounded-full border-2 border-background ${isAlert ? 'bg-red-500' : log.meeting_booked ? 'bg-green-500' : counted ? 'bg-blue-500' : 'bg-gray-400'}`} />
                <div className="text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant={isAlert ? 'destructive' : counted ? 'outline' : 'secondary'} className="text-[10px]">
                    {counted ? `#${attempt}` : 'não contabilizada'}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{ch}</Badge>
                  <span className="font-semibold">{when.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className="text-muted-foreground">· {log.sdr_name}</span>
                  {log.temperature_after && <Badge variant="secondary" className="text-[10px]">{log.temperature_after}</Badge>}
                  {log.meeting_booked && <Badge className="text-[10px] bg-green-600">Reunião agendada</Badge>}
                </div>
                <div className="text-xs mt-0.5">{log.result || '—'}</div>
                {log.observation && (
                  <div className="text-xs text-muted-foreground italic mt-0.5">"{log.observation}"</div>
                )}
                {log.proof_path && <ProofImage path={log.proof_path} />}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function ProofImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let cancelled = false
    supabase.storage.from('crm-attachments').createSignedUrl(path, 600).then(({ data, error }) => {
      if (cancelled) return
      if (error || !data?.signedUrl) { setErr(true); return }
      setUrl(data.signedUrl)
    })
    return () => { cancelled = true }
  }, [path])
  if (err) return <div className="text-[10px] text-red-600 mt-1">Não foi possível carregar o print.</div>
  if (!url) return <div className="text-[10px] text-muted-foreground mt-1 italic">Carregando print…</div>
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(path)
  if (!isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] inline-flex items-center gap-1 text-blue-600 hover:underline mt-1">
        <Paperclip className="w-3 h-3" /> Abrir anexo
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2 max-w-xs">
      <img src={url} alt="Print da conversa" className="rounded border border-muted max-h-48 object-contain bg-muted/30" />
      <span className="text-[10px] text-muted-foreground hover:underline">Abrir em tamanho real</span>
    </a>
  )
}


function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 bg-muted/30 rounded-md p-2.5">
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon} {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({ label, value, mono, renderValue }: {
  label: string
  value: string | null | undefined
  mono?: boolean
  renderValue?: (v: string) => React.ReactNode
}) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`text-right ${mono ? 'font-mono' : ''} ${!value ? 'text-muted-foreground/60' : ''}`}>
        {value ? (renderValue ? renderValue(value) : value) : '—'}
      </span>
    </div>
  )
}
