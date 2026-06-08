import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updatePipelineField } from '@/modules/sdr/services'
import { useCloserNames } from '@/modules/sdr/hooks/use-team-members'
import type { CrmPipeline, SdrStatus } from '@/modules/sdr/types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

function nowLocal() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  d.setHours(d.getHours() + 24)
  return d.toISOString().slice(0, 16)
}

export function MeetingScheduleQuickDialog({
  lead, open, onOpenChange,
}: { lead: CrmPipeline | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const closers = useCloserNames()
  const [date, setDate] = useState<string>(nowLocal())
  const [closer, setCloser] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(nowLocal())
      setCloser(lead?.closer_name ?? '')
    }
  }, [open, lead])

  const submit = async () => {
    if (!lead) return
    setSaving(true)
    try {
      await updatePipelineField(lead.id, 'meeting_scheduled', true)
      await updatePipelineField(lead.id, 'sdr_status', 'Reunião Agendada' as SdrStatus)
      if (date) await updatePipelineField(lead.id, 'meeting_date', new Date(date).toISOString())
      if (closer) await updatePipelineField(lead.id, 'closer_name', closer)
      toast.success('Reunião agendada.')
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar reunião</DialogTitle>
          <DialogDescription>
            {lead?.client_name ? `Marcar reunião para "${lead.client_name}".` : 'Preencha os dados.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Closer responsável</Label>
            <Select value={closer} onValueChange={setCloser}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {closers.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando…' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
