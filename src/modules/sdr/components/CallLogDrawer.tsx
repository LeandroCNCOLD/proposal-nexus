import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCallLog } from '../hooks/use-call-log'
import { CALL_RESULT_OPTIONS, TEMPERATURE_OPTIONS } from '../types'
import { useSdrNames } from '../hooks/use-team-members'
import type { CrmPipeline } from '../types'
import { formatCurrency } from '@/lib/utils'
import { insertFollowup } from '../followups'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { TransferToSellerDialog } from '@/components/sdr/TransferToSellerDialog'

interface Props { pipeline: CrmPipeline; open: boolean; onClose: () => void }

function defaultNextAttempt() {
  // amanhã 09:00 local
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  // YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CallLogDrawer({ pipeline, open, onClose }: Props) {
  const { insert } = useCallLog({ pipelineId: pipeline.id })
  const { names: sdrNames } = useSdrNames()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [transferOpen, setTransferOpen] = useState(false)
  const [form, setForm] = useState({
    sdr_name: pipeline.sdr_name ?? '',
    line_type: 'Celular' as 'Celular' | 'Fixo' | 'WhatsApp',
    phone_number: (pipeline.contact_mobile ?? pipeline.contact_phone ?? '') as string,
    manual_log: false,
    manual_summary: '',
    result: '' as any,
    other_reason: '',
    temperature_after: pipeline.temperature as any,
    meeting_booked: false,
    observation: '',
    next_attempt_at: defaultNextAttempt(),
    next_attempt_note: '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const requiresFollowup = !form.meeting_booked
  const nextAttemptValid = !requiresFollowup || (!!form.next_attempt_at && new Date(form.next_attempt_at).getTime() > Date.now() - 60_000)
  const manualSummaryValid = !form.manual_log || form.manual_summary.trim().length >= 5

  async function handleSubmit() {
    if (!form.result) return
    if (form.result === 'Outros' && !form.other_reason.trim()) return
    if (form.manual_log && !manualSummaryValid) {
      toast.error('Descreva brevemente o que foi conversado (mínimo 5 caracteres).')
      return
    }
    if (requiresFollowup && !nextAttemptValid) {
      toast.error('Defina a data/hora da próxima tentativa (no futuro).')
      return
    }
    const today = new Date()
    const phoneLine = form.phone_number ? `${form.line_type}: ${form.phone_number}` : form.line_type
    const manualPrefix = form.manual_log
      ? `[Registro manual — gravação não capturada] ${phoneLine}\nResumo: ${form.manual_summary.trim()}`
      : `[${phoneLine}]`
    const baseObs = form.result === 'Outros'
      ? `[Outros: ${form.other_reason.trim()}]${form.observation ? `\n${form.observation}` : ''}`
      : form.observation || ''
    const obs = [manualPrefix, baseObs].filter(Boolean).join('\n') || null
    await insert.mutateAsync({
      pipeline_id: pipeline.id,
      sdr_id: null,
      sdr_name: form.sdr_name,
      call_date: today.toISOString().slice(0, 10),
      call_time: today.toTimeString().slice(0, 8),
      duration_min: null,
      result: form.result,
      temperature_after: form.temperature_after || null,
      meeting_booked: form.meeting_booked,
      observation: obs,
      channel: form.line_type,
    })

    if (requiresFollowup) {
      try {
        const iso = new Date(form.next_attempt_at).toISOString()
        await insertFollowup({
          lead_id: pipeline.id,
          sdr_id: user?.id ?? null,
          sdr_name: form.sdr_name || null,
          scheduled_at: iso,
          note: form.next_attempt_note.trim() || null,
        })
        qc.invalidateQueries({ queryKey: ['sdr-followups'] })
        toast.success(`Próxima tentativa agendada para ${new Date(iso).toLocaleString('pt-BR')}`)
      } catch (e: any) {
        toast.error('Falha ao agendar próxima tentativa: ' + (e?.message ?? 'erro'))
      }
    }

    // Se a reunião foi marcada e o lead ainda não foi transferido, abre o diálogo de handoff
    const alreadyTransferred = (pipeline as any).handoff_status === 'transferred'
    if (form.meeting_booked && !alreadyTransferred) {
      setTransferOpen(true)
      return
    }
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[460px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Registrar Ligação</SheetTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">{pipeline.client_name}</span>
            {' · '}<span className="font-mono text-xs">{pipeline.lead_code}</span>
            {' · '}{formatCurrency(pipeline.value)}
          </p>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">SDR</Label>
            <Select value={form.sdr_name} onValueChange={v => set('sdr_name', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{sdrNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Linha</Label>
              <Select value={form.line_type} onValueChange={v => set('line_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Celular">Celular</SelectItem>
                  <SelectItem value="Fixo">Fixo</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Número</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={form.phone_number}
                onChange={e => set('phone_number', e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">📝 Registro manual (sem gravação)</Label>
              <Switch checked={form.manual_log} onCheckedChange={v => set('manual_log', v)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use quando você falou com o cliente mas a gravação não foi capturada. Conta como atendimento.
            </p>
            {form.manual_log && (
              <Textarea
                rows={3}
                placeholder="Resuma com poucas palavras o que foi conversado..."
                value={form.manual_summary}
                onChange={e => set('manual_summary', e.target.value)}
                className="resize-none"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Resultado *</Label>
            <Select value={form.result} onValueChange={v => set('result', v as any)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{CALL_RESULT_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.result === 'Outros' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Explique o motivo *</Label>
              <Textarea
                rows={3}
                placeholder="Descreva o que aconteceu / o motivo do resultado..."
                value={form.other_reason}
                onChange={e => set('other_reason', e.target.value)}
                className="resize-none"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Temperatura</Label>
            <Select value={form.temperature_after} onValueChange={v => set('temperature_after', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TEMPERATURE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.meeting_booked} onCheckedChange={v => set('meeting_booked', v)} />
            <Label>Reunião agendada?</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observação</Label>
            <Textarea rows={3} placeholder="O que foi conversado?" value={form.observation}
              onChange={e => set('observation', e.target.value)} className="resize-none" />
          </div>

          {requiresFollowup && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="text-xs font-semibold text-amber-900">
                ⏰ Agendar próxima tentativa *
              </div>
              <p className="text-[11px] text-amber-800">
                Toda tentativa exige uma nova data/hora de contato. O sistema vai te lembrar e, se você não cumprir, o gestor é alertado.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={form.next_attempt_at}
                  onChange={e => set('next_attempt_at', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plano / o que falar (opcional)</Label>
                <Textarea
                  rows={2}
                  placeholder="Ex.: retornar pedindo decisor; mandar proposta revisada antes; etc."
                  value={form.next_attempt_note}
                  onChange={e => set('next_attempt_note', e.target.value)}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-[#0F2D5E] hover:bg-[#1A56DB]"
              onClick={handleSubmit} disabled={!form.result || insert.isPending || (requiresFollowup && !nextAttemptValid) || !manualSummaryValid}>
              {insert.isPending ? 'Salvando...' : 'Salvar Ligação'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </SheetContent>
      <TransferToSellerDialog
        open={transferOpen}
        onOpenChange={(v) => { setTransferOpen(v); if (!v) onClose() }}
        leadId={pipeline.id}
        leadLabel={pipeline.client_name}
      />
    </Sheet>
  )
}
