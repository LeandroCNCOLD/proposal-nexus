import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchMyWallet, unlockLead, renewLock, updatePipelineField } from '@/modules/crm/services'
import { insertCallLog } from '@/modules/crm/services'
import { useAuth } from '@/hooks/useAuth'
import {
  CALL_RESULT_OPTIONS, TEMPERATURE_OPTIONS, SDR_STATUS_OPTIONS, CLOSER_NAMES,
  type CrmPipeline, type CallResult, type Temperature, type SdrStatus,
} from '@/modules/crm/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Unlock, Clock, MapPin, Phone, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/app/crm-sdr/wallet')({
  component: WalletPage,
})

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function WalletPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const sdrName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'SDR'

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
          Você ainda não pegou nenhum lead. Vá ao <strong>Banco de Propostas</strong> para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              sdrName={sdrName}
              onUnlock={() => {
                if (confirm(`Devolver "${lead.client_name}" ao banco?`)) unlockMut.mutate(lead.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LeadCard({ lead, sdrName, onUnlock }: { lead: CrmPipeline; sdrName: string; onUnlock: () => void }) {
  const qc = useQueryClient()
  const [result, setResult] = useState<CallResult | ''>('')
  const [tempAfter, setTempAfter] = useState<Temperature | ''>(lead.temperature)
  const [observation, setObservation] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [meetingBooked, setMeetingBooked] = useState(false)
  const [meetingDate, setMeetingDate] = useState('')
  const [closer, setCloser] = useState<string>('')

  const remaining = daysUntil(lead.lock_expires_at)

  const registerMut = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error('Escolha o resultado da ligação')
      const today = new Date().toISOString().slice(0, 10)
      await insertCallLog({
        pipeline_id: lead.id,
        sdr_id: lead.locked_by_sdr_id,
        sdr_name: sdrName,
        call_date: today,
        call_time: new Date().toTimeString().slice(0, 5),
        duration_min: null,
        result: result as CallResult,
        temperature_after: tempAfter || null,
        meeting_booked: meetingBooked,
        observation: observation || null,
      })

      const updates: Array<Promise<unknown>> = [renewLock(lead.id)]
      if (tempAfter)   updates.push(updatePipelineField(lead.id, 'temperature', tempAfter))
      if (observation) updates.push(updatePipelineField(lead.id, 'call_observation', observation))
      if (nextStep)    updates.push(updatePipelineField(lead.id, 'next_step', nextStep))
      updates.push(updatePipelineField(lead.id, 'last_contact_at', new Date().toISOString()))
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
      toast.success(meetingBooked ? 'Reunião agendada — Closer notificado!' : 'Ligação registrada e lock renovado.')
      setResult(''); setObservation(''); setNextStep(''); setMeetingBooked(false); setMeetingDate(''); setCloser('')
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{lead.proposal_number}</span>
            <h3 className="font-bold text-lg">{lead.client_name}</h3>
            <Badge variant="secondary">{lead.temperature}</Badge>
            <Badge variant="outline">{lead.sdr_status}</Badge>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.city || '—'}/{lead.state || '—'}</span>
            <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{fmtBRL(lead.value)}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Lock expira em {remaining ?? '—'} dia{remaining === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onUnlock}>
          <Unlock className="w-3 h-3 mr-1" /> Devolver ao banco
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold">Resultado da ligação *</label>
          <select value={result} onChange={e => setResult(e.target.value as CallResult)} className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="">Selecione...</option>
            {CALL_RESULT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

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

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={meetingBooked} onChange={e => setMeetingBooked(e.target.checked)} />
            Reunião agendada?
          </label>

          {meetingBooked && (
            <div className="space-y-2 pl-6 border-l-2 border-blue-300">
              <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              <select value={closer} onChange={e => setCloser(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">Selecionar Closer...</option>
                {CLOSER_NAMES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button onClick={() => registerMut.mutate()} disabled={!result || registerMut.isPending}>
          <Phone className="w-3 h-3 mr-1" />
          {registerMut.isPending ? 'Salvando...' : 'Registrar ligação'}
        </Button>
      </div>
    </div>
  )
}
