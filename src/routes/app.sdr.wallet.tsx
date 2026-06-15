import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Unlock, Clock, MapPin, Phone, DollarSign, ChevronDown, ChevronUp, Mail, Building2, FileText, Calendar, AlertTriangle, History, Paperclip, MessageCircle, UserCheck, XCircle, Pencil, Flame, AlertCircle, Inbox } from 'lucide-react'
import { toast } from 'sonner'
import { CallScriptDialog } from '@/modules/sdr/components/CallScriptDialog'
import { useProposalLeadMatches, type ProposalLeadMatch } from '@/hooks/use-proposal-lead-matches'
import { useTeamRoster } from '@/hooks/use-team-roster'
import { TransferLeadDialog } from '@/components/manager/TransferLeadDialog'
import { TransferToSellerDialog } from '@/components/sdr/TransferToSellerDialog'
import { CloseLeadDialog } from '@/components/sdr/CloseLeadDialog'
import { LeadEditDialog } from '@/components/sdr/LeadEditDialog'
import { MeetingScheduleQuickDialog } from '@/components/sdr/MeetingScheduleQuickDialog'
import { computeSignals, type LeadCommSignals } from '@/components/sdr/WalletKanbanCard'
import { ArrowRightLeft, LayoutGrid, List } from 'lucide-react'
import { WalletKanban } from '@/components/sdr/WalletKanban'

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
  const { user, hasAnyRole } = useAuth()
  const qc = useQueryClient()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)
  const closerNames = useCloserNames()

  const [scriptLead, setScriptLead] = useState<CrmPipeline | null>(null)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [transferLead, setTransferLead] = useState<CrmPipeline | null>(null)
  const [transferSellerLead, setTransferSellerLead] = useState<CrmPipeline | null>(null)
  const [closeLead, setCloseLead] = useState<CrmPipeline | null>(null)
  const [editLead, setEditLead] = useState<CrmPipeline | null>(null)
  const [meetingLead, setMeetingLead] = useState<CrmPipeline | null>(null)
  const [search, setSearch] = useState('')
  const [tempFilter, setTempFilter] = useState<'all' | Temperature>('all')
  const [actionFilter, setActionFilter] = useState<'all' | 'me' | 'other' | 'stale'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
    if (typeof window === 'undefined') return 'kanban'
    return (localStorage.getItem('sdr-wallet-view') as 'list' | 'kanban') || 'kanban'
  })
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sdr-wallet-view', viewMode)
  }, [viewMode])

  const targetUserId = viewingUserId ?? user?.id ?? null
  const isViewingOther = !!viewingUserId && viewingUserId !== user?.id

  // Roster de SDRs (somente para gestores)
  const { data: roster = [] } = useTeamRoster('sdr' as never)
  const targetUser = roster.find(r => r.user_id === targetUserId)
  const targetName = isViewingOther
    ? (targetUser?.full_name || targetUser?.email || 'SDR')
    : (user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SDR')
  const sdrName = targetName

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['my-wallet', targetUserId],
    queryFn: () => (targetUserId ? fetchMyWallet(targetUserId) : Promise.resolve([])),
    enabled: !!targetUserId,
  })

  const leadIds = useMemo(() => leads.map(l => l.id), [leads])
  const { byLead: proposalMatches } = useProposalLeadMatches({ leadIds })

  const signalsByLead = useMemo(() => {
    const m = new Map<string, LeadCommSignals>()
    leads.forEach(l => m.set(l.id, computeSignals(l as never)))
    return m
  }, [leads])

  // contadores para o header (capacidade ativa)
  const activeCount = useMemo(
    () => leads.filter(l => {
      const handoff = (l as { handoff_status?: string | null }).handoff_status
      return handoff !== 'transferred' && !['Fechado', 'Perdido (com motivo)', 'Kill / Arquivar'].includes(l.sdr_status as string)
    }).length,
    [leads]
  )

  const filteredListLeads = useMemo(() => {
    const s = search.trim().toLowerCase()
    return leads.filter(l => {
      if (tempFilter !== 'all' && l.temperature !== tempFilter) return false
      const sig = signalsByLead.get(l.id)
      if (actionFilter === 'me' && sig?.waitingOn !== 'me') return false
      if (actionFilter === 'other' && sig?.waitingOn !== 'other') return false
      if (actionFilter === 'stale' && !sig?.isStale) return false
      if (!s) return true
      return (
        l.client_name?.toLowerCase().includes(s) ||
        l.lead_code?.toLowerCase().includes(s) ||
        l.cnpj?.toLowerCase().includes(s) ||
        l.razao_social?.toLowerCase().includes(s)
      )
    })
  }, [leads, search, tempFilter, actionFilter, signalsByLead])

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

  const filtersActive = !!search || tempFilter !== 'all' || actionFilter !== 'all'

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">
            {isViewingOther ? `Carteira de ${targetName}` : 'Minha Carteira'}
          </h1>
          <p className="text-sm text-muted-foreground">
            <strong>{activeCount}/45</strong> leads ativos · {leads.length - activeCount} encerrados/transferidos no histórico · lock de 7 dias renova a cada atividade
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            <Button
              size="sm"
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Kanban
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5 mr-1" /> Lista
            </Button>
          </div>
          {isManager && (
            <>
              <label className="text-xs text-muted-foreground">Ver carteira de:</label>
              <select
                className="border rounded-md px-2 py-1 text-sm bg-background"
                value={viewingUserId ?? user.id}
                onChange={(e) => setViewingUserId(e.target.value === user.id ? null : e.target.value)}
              >
                <option value={user.id}>Minha carteira</option>
                {roster
                  .filter(r => r.user_id !== user.id)
                  .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
                  .map(r => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.full_name || r.email || r.user_id.slice(0, 8)}
                    </option>
                  ))}
              </select>
              {isViewingOther && (
                <Badge variant="secondary" className="gap-1">somente leitura sugerida</Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Para contatar hoje (cadência automática) */}
      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const tempOrder: Record<string, number> = { 'Muito Quente': 1, 'Quente': 2, 'Morno': 3, 'Frio': 4 }
        const dueLeads = leads
          .filter(l => {
            if (!l.next_contact_at) return false
            const d = new Date(l.next_contact_at); d.setHours(0, 0, 0, 0)
            if (d.getTime() > today.getTime()) return false
            return !['Fechado', 'Kill / Arquivar', 'Perdido (com motivo)'].includes(l.sdr_status as string)
          })
          .sort((a, b) => {
            const ta = tempOrder[a.temperature ?? ''] ?? 99
            const tb = tempOrder[b.temperature ?? ''] ?? 99
            if (ta !== tb) return ta - tb
            return Number(b.value ?? 0) - Number(a.value ?? 0)
          })
          .slice(0, 12)
        if (dueLeads.length === 0) return null
        const tempBadge: Record<string, string> = {
          'Muito Quente': 'bg-red-600 text-white',
          'Quente': 'bg-orange-500 text-white',
          'Morno': 'bg-amber-400 text-amber-900',
          'Frio': 'bg-blue-400 text-white',
        }
        return (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-bold text-amber-900">📅 Para contatar hoje</h2>
              <Badge className="bg-amber-600 text-white">{dueLeads.length}</Badge>
              <span className="text-[11px] text-amber-800/70 ml-auto">Cadência automática por temperatura</span>
            </div>
            <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
              {dueLeads.map(l => (
                <div key={l.id} className="flex items-center gap-2 rounded border bg-background px-2 py-1.5">
                  <Badge className={`text-[10px] shrink-0 ${tempBadge[l.temperature ?? ''] ?? 'bg-muted'}`}>{l.temperature ?? '—'}</Badge>
                  <Link to="/app/sdr/leads/$id" params={{ id: l.id }} className="text-xs font-medium truncate flex-1 hover:underline">
                    {l.client_name}
                  </Link>
                  {l.contact_mobile && (
                    <a href={`tel:${l.contact_mobile}`} className="text-xs inline-flex items-center gap-1 text-emerald-700 hover:underline shrink-0" title={l.contact_mobile}>
                      <Phone className="h-3 w-3" /> Ligar
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}



      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Você ainda não pegou nenhum lead. Vá ao <strong>Banco de Leads</strong> para começar.
        </div>
      ) : viewMode === 'kanban' ? (
        <WalletKanban leads={leads} canTransferSdr={isManager} />
      ) : (
        <div className="space-y-3">
          {/* Filtros (mesmo conjunto do Kanban) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente, código ou CNPJ…"
              className="max-w-xs h-8"
            />
            <Select value={tempFilter} onValueChange={(v) => setTempFilter(v as 'all' | Temperature)}>
              <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas temperaturas</SelectItem>
                <SelectItem value="Frio">Frio</SelectItem>
                <SelectItem value="Morno">Morno</SelectItem>
                <SelectItem value="Quente">Quente</SelectItem>
                <SelectItem value="Muito Quente">Muito Quente</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="me">Esperando minha ação</SelectItem>
                <SelectItem value="other">Esperando outro lado</SelectItem>
                <SelectItem value="stale">Parados (SLA estourado)</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTempFilter('all'); setActionFilter('all') }}>
                Limpar
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredListLeads.length} de {leads.length} leads
            </span>
          </div>

          {filteredListLeads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              sdrName={sdrName}
              proposalMatch={proposalMatches.get(lead.id) ?? null}
              signals={signalsByLead.get(lead.id)}
              onOpenScript={() => setScriptLead(lead)}
              onUnlock={() => {
                if (confirm(`Devolver "${lead.client_name}" ao banco?`)) unlockMut.mutate(lead.id)
              }}
              canManage={isManager}
              onTransfer={() => setTransferLead(lead)}
              onTransferSeller={() => setTransferSellerLead(lead)}
              onClose={() => setCloseLead(lead)}
              onEdit={() => setEditLead(lead)}
              onMeeting={() => setMeetingLead(lead)}
            />
          ))}
          {filteredListLeads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm italic">
              Nenhum lead corresponde aos filtros atuais.
            </div>
          )}
        </div>
      )}

      <CallScriptDialog
        lead={scriptLead}
        open={!!scriptLead}
        onOpenChange={(o) => !o && setScriptLead(null)}
      />
      {transferLead && (
        <TransferLeadDialog
          open={!!transferLead}
          onOpenChange={(o) => { if (!o) setTransferLead(null) }}
          leadId={transferLead.id}
        />
      )}
      {transferSellerLead && (
        <TransferToSellerDialog
          open={!!transferSellerLead}
          onOpenChange={(o) => !o && setTransferSellerLead(null)}
          leadId={transferSellerLead.id}
          leadLabel={transferSellerLead.client_name}
        />
      )}
      <CloseLeadDialog
        lead={closeLead}
        open={!!closeLead}
        onOpenChange={(o) => !o && setCloseLead(null)}
      />
      <LeadEditDialog
        lead={editLead}
        leadId={editLead?.id ?? ''}
        open={!!editLead}
        onOpenChange={(o) => !o && setEditLead(null)}
      />
      <MeetingScheduleQuickDialog
        lead={meetingLead}
        open={!!meetingLead}
        onOpenChange={(o) => !o && setMeetingLead(null)}
      />
    </div>
  )
}


function LeadCard({ lead, sdrName, onUnlock, onOpenScript, proposalMatch, canManage, onTransfer, onTransferSeller, onClose, onEdit, onMeeting, signals }: {
  lead: CrmPipeline
  sdrName: string
  onUnlock: () => void
  onOpenScript: () => void
  proposalMatch?: ProposalLeadMatch | null
  canManage?: boolean
  onTransfer?: () => void
  onTransferSeller?: () => void
  onClose?: () => void
  onEdit?: () => void
  onMeeting?: () => void
  signals?: LeadCommSignals
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
      // Temperatura é calculada automaticamente pelo trigger calcular_temperatura_lead (não edita manual)
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
            {proposalMatch && (
              <Link
                to="/app/propostas/$id"
                params={{ id: proposalMatch.proposal_id }}
                title={proposalMatch.match_type === 'cnpj' ? 'Casado por CNPJ' : 'Casado por título'}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 px-2 py-0.5 text-[11px] font-medium hover:bg-emerald-500/20"
              >
                <FileText className="w-3 h-3" /> Proposta Nomus
              </Link>
            )}
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
          <Button asChild size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
            <Link to="/app/agenda"><Calendar className="w-3 h-3 mr-1" /> Agendar</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            Detalhes
          </Button>
          <Button size="sm" variant="outline" onClick={onUnlock}>
            <Unlock className="w-3 h-3 mr-1" /> Devolver
          </Button>
          {canManage && onTransfer && (
            <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onTransfer}>
              <ArrowRightLeft className="w-3 h-3 mr-1" /> Transferir
            </Button>
          )}
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
              <div className="flex items-center justify-between text-xs gap-2 mt-1 pt-1 border-t">
                <span className="text-muted-foreground">Previsão de fechamento</span>
                <ExpectedClosingDateInline
                  leadId={lead.id}
                  value={(lead as any).expected_closing_date ?? null}
                />
              </div>
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

          <label className="text-xs font-semibold">Temperatura atual</label>
          <div className="flex items-center gap-2 border rounded px-2 py-1.5 bg-muted/30">
            <Badge variant="secondary">{lead.temperature || '—'}</Badge>
            <span className="text-[11px] text-muted-foreground italic">Automática — definida pelo status</span>
          </div>

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
                {((useCloserNames as any)?.names ?? []).map((c: string) => <option key={c} value={c}>{c}</option>)}
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

function ExpectedClosingDateInline({ leadId, value }: { leadId: string; value: string | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')

  useEffect(() => { setVal(value ?? '') }, [value])

  const save = async (next: string) => {
    const payload = next ? next : null
    const { error } = await supabase.rpc('update_sdr_lead_fields' as never, {
      _lead_id: leadId,
      _changes: { expected_closing_date: payload } as any,
      _reason: 'edição inline da carteira',
    } as never)
    if (error) { toast.error(error.message); return }
    toast.success('Previsão atualizada')
    qc.invalidateQueries({ queryKey: ['my-wallet'] })
    qc.invalidateQueries({ queryKey: ['sdr-lead', leadId] })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => save(val)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(val); if (e.key === 'Escape') setEditing(false) }}
        className="border rounded px-1.5 py-0.5 text-xs"
      />
    )
  }

  if (!value) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
        + Definir data
      </button>
    )
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(value + 'T00:00:00')
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const cls = diff < 0 ? 'text-red-700 font-semibold' : diff <= 7 ? 'text-green-700 font-semibold' : ''
  const label = diff < 0
    ? `⚠️ Vencido há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`
    : `📅 Fecha em ${fmtDate(value)}`

  return (
    <button onClick={() => setEditing(true)} className={`text-xs hover:underline ${cls}`}>
      {label}
    </button>
  )
}
