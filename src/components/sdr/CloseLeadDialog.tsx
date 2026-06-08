import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updatePipelineField } from '@/modules/sdr/services'
import type { CrmPipeline, SdrStatus } from '@/modules/sdr/types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

type CloseReason = 'Fechado' | 'Perdido (com motivo)' | 'Kill / Arquivar'

export function CloseLeadDialog({
  lead, open, onOpenChange,
}: { lead: CrmPipeline | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState<CloseReason>('Perdido (com motivo)')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!lead) return
    setSaving(true)
    try {
      await updatePipelineField(lead.id, 'sdr_status', reason as SdrStatus)
      if (note.trim()) {
        await updatePipelineField(lead.id, 'call_observation', note.trim())
      }
      toast.success(`Lead movido para "${reason}".`)
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      onOpenChange(false)
      setNote('')
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
          <DialogTitle>Encerrar lead</DialogTitle>
          <DialogDescription>
            {lead?.client_name ? `Marque o desfecho de "${lead.client_name}".` : 'Selecione o desfecho.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Desfecho</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CloseReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Fechado">Fechado (ganho)</SelectItem>
                <SelectItem value="Perdido (com motivo)">Perdido (com motivo)</SelectItem>
                <SelectItem value="Kill / Arquivar">Kill / Arquivar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: cliente fechou com concorrente XYZ, projeto adiado…"
              rows={3}
            />
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
