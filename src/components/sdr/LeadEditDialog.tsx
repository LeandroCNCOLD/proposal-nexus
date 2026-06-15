import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'

const FIELDS: Array<{ key: string; label: string; type?: 'text' | 'textarea' | 'number' | 'date'; showWhen?: (lead: any) => boolean; placeholder?: string }> = [
  { key: 'client_name', label: 'Nome do cliente' },
  { key: 'razao_social', label: 'Razão social' },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'contact_name', label: 'Nome do contato' },
  { key: 'contact_mobile', label: 'Celular' },
  { key: 'contact_phone', label: 'Telefone fixo' },
  { key: 'contact_email', label: 'E-mail' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'UF' },
  { key: 'proposal_title', label: 'Título da proposta' },
  { key: 'proposal_desc', label: 'Descrição da proposta', type: 'textarea' },
  { key: 'internal_note', label: 'Nota interna', type: 'textarea' },
  { key: 'next_step', label: 'Próximo passo' },
  {
    key: 'expected_closing_date',
    label: 'Previsão de fechamento',
    type: 'date',
    placeholder: 'Quando o cliente deve decidir?',
    showWhen: (lead) => ['Em Negociação com Closer','Proposta em Revisão','Quente - Alta Chance de Fechamento'].includes(lead?.sdr_status),
  },
]

export function LeadEditDialog({
  open,
  onOpenChange,
  leadId,
  lead,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  leadId: string
  lead: any
}) {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open && lead) {
      const init: Record<string, string> = {}
      for (const f of FIELDS) init[f.key] = lead[f.key] ?? ''
      setValues(init)
      setReason('')
    }
  }, [open, lead])

  const mutation = useMutation({
    mutationFn: async () => {
      const changes: Record<string, any> = {}
      for (const f of FIELDS) {
        const original = (lead[f.key] ?? '') as string
        const next = values[f.key] ?? ''
        if (String(original) !== String(next)) {
          changes[f.key] = next === '' ? null : next
        }
      }
      if (Object.keys(changes).length === 0) return { changed: 0 }
      const { error } = await supabase.rpc('update_sdr_lead_fields' as never, {
        _lead_id: leadId,
        _changes: changes,
        _reason: reason || null,
      } as never)
      if (error) throw error
      return { changed: Object.keys(changes).length }
    },
    onSuccess: (r) => {
      if (r.changed === 0) {
        toast.info('Nenhuma alteração para salvar')
      } else {
        toast.success(`${r.changed} campo(s) atualizado(s)`)
        qc.invalidateQueries({ queryKey: ['sdr-lead', leadId] })
        qc.invalidateQueries({ queryKey: ['sdr-lead-edits', leadId] })
        onOpenChange(false)
      }
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao salvar'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar informações do lead</DialogTitle>
          <DialogDescription>
            Corrija ou complete dados do lead. Todas as alterações ficam registradas no histórico e podem ser revertidas por um gestor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          {FIELDS.filter((f) => !f.showWhen || f.showWhen(lead)).map((f) => (
            <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
              <Label htmlFor={f.key} className="text-xs">{f.label}</Label>
              {f.type === 'textarea' ? (
                <Textarea
                  id={f.key}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <Input
                  id={f.key}
                  type={f.type === 'date' ? 'date' : 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="reason" className="text-xs">Motivo da edição (opcional)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: telefone trocado pelo cliente" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
