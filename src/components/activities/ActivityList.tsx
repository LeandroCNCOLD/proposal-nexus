import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Pencil, RotateCcw, Trash2, Clock, AlertTriangle, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  isOverdue,
  type CrmActivity,
} from '@/lib/activities/types'
import {
  cancelActivity,
  completeActivity,
  deleteActivity,
} from '@/lib/activities/services'
import { ActivityFormDialog } from './ActivityFormDialog'

function fmtWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function ActivityList({
  activities,
  showLeadLink = true,
  emptyText = 'Nenhuma atividade.',
  onChanged,
}: {
  activities: CrmActivity[]
  showLeadLink?: boolean
  emptyText?: string
  onChanged?: () => void
}) {
  const qc = useQueryClient()
  const { user, hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)
  const [editing, setEditing] = useState<CrmActivity | null>(null)
  const [reschedule, setReschedule] = useState<CrmActivity | null>(null)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['activities'] })
    qc.invalidateQueries({ queryKey: ['activities-mine'] })
    onChanged?.()
  }

  const completeMut = useMutation({
    mutationFn: async (a: CrmActivity) => {
      const outcome = prompt('Desfecho / observação (opcional):') ?? undefined
      await completeActivity(a.id, outcome || undefined)
    },
    onSuccess: () => { toast.success('Atividade concluída.'); invalidate() },
    onError: (e: Error) => toast.error(e.message),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelActivity(id),
    onSuccess: () => { toast.success('Atividade cancelada.'); invalidate() },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteActivity(id),
    onSuccess: () => { toast.success('Atividade excluída.'); invalidate() },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!activities.length) {
    return <div className="text-sm text-muted-foreground italic py-4 text-center">{emptyText}</div>
  }

  return (
    <>
      <ul className="space-y-2">
        {activities.map(a => {
          const overdue = isOverdue(a)
          const canEdit = a.assigned_to === user?.id || a.created_by === user?.id || isManager
          const canDelete = a.created_by === user?.id || isManager
          return (
            <li key={a.id} className={`border rounded-md p-3 bg-card ${overdue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{ACTIVITY_TYPE_ICONS[a.type]}</span>
                    <span className="font-semibold">{a.title}</span>
                    <Badge variant="outline" className="text-[10px]">{ACTIVITY_TYPE_LABELS[a.type]}</Badge>
                    {a.status === 'pendente' && overdue && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertTriangle className="w-3 h-3" /> Atrasada
                      </Badge>
                    )}
                    {a.status !== 'pendente' && (
                      <Badge variant="secondary" className="text-[10px]">{a.status}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {fmtWhen(a.scheduled_at)}
                      {a.duration_min ? ` · ${a.duration_min} min` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" /> {a.assigned_to_name || '—'}
                    </span>
                    {a.created_by_name && a.created_by !== a.assigned_to && (
                      <span>· por {a.created_by_name}</span>
                    )}
                    {showLeadLink && a.lead_id && (
                      <Link
                        to="/app/sdr/leads/$id"
                        params={{ id: a.lead_id }}
                        className="text-primary hover:underline"
                      >
                        {a.client_name || 'ver lead'}
                      </Link>
                    )}
                  </div>
                  {a.description && (
                    <div className="text-xs mt-1 text-muted-foreground whitespace-pre-wrap">{a.description}</div>
                  )}
                  {a.outcome && (
                    <div className="text-xs mt-1 p-2 rounded bg-muted/40">
                      <span className="font-medium">Desfecho:</span> {a.outcome}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {a.status === 'pendente' && canEdit && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-green-700" onClick={() => completeMut.mutate(a)}>
                        <Check className="w-3 h-3 mr-1" /> Concluir
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setReschedule(a)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reagendar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing(a)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => cancelMut.mutate(a.id)}>
                        <X className="w-3 h-3 mr-1" /> Cancelar
                      </Button>
                    </>
                  )}
                  {canDelete && (
                    <Button
                      size="sm" variant="ghost" className="h-7 text-destructive"
                      onClick={() => { if (confirm('Excluir esta atividade?')) deleteMut.mutate(a.id) }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {editing && (
        <ActivityFormDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing}
          leadId={editing.lead_id}
          clientName={editing.client_name}
        />
      )}
      {reschedule && (
        <ActivityFormDialog
          open={!!reschedule}
          onOpenChange={(o) => !o && setReschedule(null)}
          leadId={reschedule.lead_id}
          clientName={reschedule.client_name}
          initial={{
            type: reschedule.type,
            title: reschedule.title,
            description: reschedule.description,
            duration_min: reschedule.duration_min,
            assigned_to: reschedule.assigned_to,
            reschedule_of: reschedule.id,
          }}
          onSaved={() => { cancelActivity(reschedule.id).then(() => invalidate()) }}
        />
      )}
    </>
  )
}
