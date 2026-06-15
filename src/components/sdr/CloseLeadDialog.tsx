import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { closeSdrLead } from '@/modules/sdr/services'
import { supabase } from '@/integrations/supabase/client'
import type { CrmPipeline } from '@/modules/sdr/types'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'

type CloseReason = 'Fechado' | 'Perdido (com motivo)' | 'Kill / Arquivar'

const LOSS_REASONS = [
  { value: 'preco',              label: 'Preço — nossa proposta foi mais cara' },
  { value: 'prazo',              label: 'Prazo de entrega — não conseguimos atender' },
  { value: 'concorrente',        label: 'Concorrente — relacionamento estabelecido' },
  { value: 'sem_budget',         label: 'Sem budget — cliente não tinha verba' },
  { value: 'projeto_cancelado',  label: 'Projeto cancelado — necessidade deixou de existir' },
  { value: 'tecnico',            label: 'Técnico — solução não atendia requisito' },
  { value: 'nao_respondeu',      label: 'Não respondeu — cliente sumiu' },
  { value: 'outro',              label: 'Outro' },
] as const

type LossReason = (typeof LOSS_REASONS)[number]['value']

export function CloseLeadDialog({
  lead, open, onOpenChange,
}: { lead: CrmPipeline | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState<CloseReason>('Perdido (com motivo)')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Loss form
  const [lossReason, setLossReason] = useState<LossReason | ''>('')
  const [lossCompetitor, setLossCompetitor] = useState('')
  const [lossPriceDiff, setLossPriceDiff] = useState<string>('')
  const [lossNotes, setLossNotes] = useState('')

  useEffect(() => {
    if (open) {
      setReason('Perdido (com motivo)')
      setNote('')
      setLossReason('')
      setLossCompetitor('')
      setLossPriceDiff('')
      setLossNotes('')
    }
  }, [open])

  const isLoss = reason === 'Perdido (com motivo)'
  const showCompetitor = lossReason === 'concorrente'
  const showPriceDiff = lossReason === 'preco' || lossReason === 'concorrente'

  const canSubmit = useMemo(() => {
    if (saving) return false
    if (isLoss && !lossReason) return false
    return true
  }, [saving, isLoss, lossReason])

  const submit = async () => {
    if (!lead) return
    setSaving(true)
    try {
      // Save structured loss analysis BEFORE close
      if (isLoss && lossReason) {
        const payload: Record<string, unknown> = {
          loss_reason: lossReason,
          loss_competitor: showCompetitor ? (lossCompetitor.trim() || null) : null,
          loss_price_diff_pct: showPriceDiff && lossPriceDiff ? Number(lossPriceDiff) : null,
          loss_notes: lossNotes.trim() || null,
        }
        const { error: upErr } = await supabase
          .from('sdr_leads')
          .update(payload as never)
          .eq('id', lead.id)
        if (upErr) throw upErr
      }

      const finalNote = isLoss
        ? [lossNotes.trim(), note.trim()].filter(Boolean).join(' — ') || null
        : (note.trim() || null)
      await closeSdrLead(lead.id, reason, finalNote)

      toast.success(`Lead movido para "${reason}" — vaga liberada na carteira.`)
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
      qc.invalidateQueries({ queryKey: ['proposal-bank'] })
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {isLoss && (
            <div className="rounded-md border border-red-200 bg-red-50/50 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-700 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-900">Análise da perda</div>
                  <div className="text-[11px] text-red-800/80">
                    Esses dados alimentam o painel de motivos de perda — preenchimento obrigatório.
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Motivo principal <span className="text-red-600">*</span>
                </Label>
                <Select value={lossReason} onValueChange={(v) => setLossReason(v as LossReason)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo…" /></SelectTrigger>
                  <SelectContent>
                    {LOSS_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showCompetitor && (
                <div className="space-y-1">
                  <Label className="text-xs">Concorrente vencedor</Label>
                  <Input
                    value={lossCompetitor}
                    onChange={(e) => setLossCompetitor(e.target.value)}
                    placeholder="Ex: Mipal, Frigelar, Heatcraft…"
                  />
                </div>
              )}

              {showPriceDiff && (
                <div className="space-y-1">
                  <Label className="text-xs">Diferença de preço (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={lossPriceDiff}
                    onChange={(e) => setLossPriceDiff(e.target.value)}
                    placeholder="Ex: 15 (significa 15% mais caro)"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Observação</Label>
                <Textarea
                  value={lossNotes}
                  onChange={(e) => setLossNotes(e.target.value)}
                  placeholder="O que poderíamos ter feito diferente?"
                  rows={3}
                />
              </div>
            </div>
          )}

          {!isLoss && (
            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: cliente fechou, projeto adiado…"
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving ? 'Salvando…' : isLoss ? 'Confirmar perda' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
