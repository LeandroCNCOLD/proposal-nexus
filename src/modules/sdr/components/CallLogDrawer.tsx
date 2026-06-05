import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useCallLog } from '../hooks/use-call-log'
import { CALL_RESULT_OPTIONS, TEMPERATURE_OPTIONS } from '../types'
import { useSdrNames } from '../hooks/use-team-members'
import type { CrmPipeline } from '../types'
import { formatCurrency } from '@/lib/utils'

interface Props { pipeline: CrmPipeline; open: boolean; onClose: () => void }

export function CallLogDrawer({ pipeline, open, onClose }: Props) {
  const { insert } = useCallLog({ pipelineId: pipeline.id })
  const { names: sdrNames } = useSdrNames()
  const [form, setForm] = useState({
    sdr_name: pipeline.sdr_name ?? '',
    result: '' as any,
    temperature_after: pipeline.temperature as any,
    meeting_booked: false,
    observation: '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    if (!form.result) return
    const today = new Date()
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
      observation: form.observation || null,
    })
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px]">
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
              <SelectContent>{SDR_NAMES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Resultado *</Label>
            <Select value={form.result} onValueChange={v => set('result', v as any)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{CALL_RESULT_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
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
            <Textarea rows={4} placeholder="O que foi conversado? Próximo passo?" value={form.observation}
              onChange={e => set('observation', e.target.value)} className="resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-[#0F2D5E] hover:bg-[#1A56DB]"
              onClick={handleSubmit} disabled={!form.result || insert.isPending}>
              {insert.isPending ? 'Salvando...' : 'Salvar Ligação'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
