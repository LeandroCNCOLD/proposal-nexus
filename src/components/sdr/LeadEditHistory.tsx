import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, Undo2 } from 'lucide-react'
import { dateTimeBR } from '@/lib/format'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

const FIELD_LABELS: Record<string, string> = {
  client_name: 'Nome do cliente',
  razao_social: 'Razão social',
  cnpj: 'CNPJ',
  contact_name: 'Contato',
  contact_mobile: 'Celular',
  contact_phone: 'Telefone',
  contact_email: 'E-mail',
  city: 'Cidade',
  state: 'UF',
  proposal_title: 'Título da proposta',
  proposal_desc: 'Descrição da proposta',
  internal_note: 'Nota interna',
  next_step: 'Próximo passo',
  delivery_term: 'Prazo de entrega',
  validity_days: 'Validade',
  expected_delivery: 'Entrega prevista',
  expected_closing: 'Fechamento previsto',
  value: 'Valor',
  discount_pct: 'Desconto (%)',
}

export function LeadEditHistory({ leadId }: { leadId: string }) {
  const { hasAnyRole } = useAuth()
  const qc = useQueryClient()
  const canRevert = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)

  const { data: edits = [], isLoading } = useQuery({
    queryKey: ['sdr-lead-edits', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_lead_edits' as never)
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as any[]
    },
  })

  const revert = useMutation({
    mutationFn: async (editId: string) => {
      const { error } = await supabase.rpc('revert_sdr_lead_edit' as never, { _edit_id: editId } as never)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Edição revertida')
      qc.invalidateQueries({ queryKey: ['sdr-lead', leadId] })
      qc.invalidateQueries({ queryKey: ['sdr-lead-edits', leadId] })
    },
    onError: (e: any) => toast.error(e?.message ?? 'Erro ao reverter'),
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="h-4 w-4" />
          Histórico de edições do lead
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : edits.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma edição registrada.</div>
        ) : (
          <div className="space-y-2">
            {edits.map((e) => (
              <div key={e.id} className="rounded-md border p-3 text-sm bg-card">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <Badge variant="outline">{FIELD_LABELS[e.field] ?? e.field}</Badge>
                  {e.reverted_from_edit_id && <Badge className="bg-amber-100 text-amber-800">Reversão</Badge>}
                  <span>por <strong className="text-foreground">{e.edited_by_name ?? '—'}</strong></span>
                  <span className="ml-auto">{dateTimeBR(e.created_at)}</span>
                </div>
                <div className="mt-2 grid md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="uppercase tracking-wide text-muted-foreground">Antes</div>
                    <div className="whitespace-pre-wrap break-words bg-red-50 border border-red-100 rounded px-2 py-1 text-foreground/80">
                      {e.old_value ?? <em className="text-muted-foreground">(vazio)</em>}
                    </div>
                  </div>
                  <div>
                    <div className="uppercase tracking-wide text-muted-foreground">Depois</div>
                    <div className="whitespace-pre-wrap break-words bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-foreground/80">
                      {e.new_value ?? <em className="text-muted-foreground">(vazio)</em>}
                    </div>
                  </div>
                </div>
                {e.reason && <div className="mt-2 text-xs text-muted-foreground">Motivo: {e.reason}</div>}
                {canRevert && !e.reverted_from_edit_id && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        if (confirm('Reverter esta edição? O valor anterior será restaurado.')) {
                          revert.mutate(e.id)
                        }
                      }}
                      disabled={revert.isPending}
                    >
                      <Undo2 className="h-3 w-3" /> Reverter
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
