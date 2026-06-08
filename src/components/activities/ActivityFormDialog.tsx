import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { createActivity, updateActivity } from '@/lib/activities/services'
import { ACTIVITY_TYPE_LABELS, type ActivityType, type CrmActivity } from '@/lib/activities/types'

function nowLocal(plusMinutes = 60) {
  const d = new Date()
  d.setMinutes(d.getMinutes() + plusMinutes - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  leadId,
  clientName,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  leadId?: string | null
  clientName?: string | null
  initial?: Partial<CrmActivity> | null
  onSaved?: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const editing = !!initial?.id

  const [type, setType] = useState<ActivityType>(initial?.type ?? 'ligacao')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduled_at ? new Date(initial.scheduled_at).toISOString().slice(0, 16) : nowLocal(60),
  )
  const [durationMin, setDurationMin] = useState<string>(
    initial?.duration_min != null ? String(initial.duration_min) : '15',
  )
  const [assignedTo, setAssignedTo] = useState<string>(initial?.assigned_to ?? user?.id ?? '')

  // lista de usuários do time (todos com perfil)
  const { data: people = [] } = useQuery({
    queryKey: ['profiles-list'],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>
    },
  })

  useEffect(() => {
    if (open && !editing) {
      setType('ligacao'); setTitle(''); setDescription('')
      setScheduledAt(nowLocal(60)); setDurationMin('15')
      setAssignedTo(user?.id ?? '')
    }
  }, [open, editing, user])

  const save = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Informe um título')
      if (!assignedTo) throw new Error('Selecione o responsável')
      const target = people.find(p => p.id === assignedTo)
      const payload = {
        type,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_min: durationMin ? Number(durationMin) : null,
        assigned_to: assignedTo,
        assigned_to_name: target?.full_name ?? target?.email ?? null,
        lead_id: leadId ?? initial?.lead_id ?? null,
        client_name: clientName ?? initial?.client_name ?? null,
      }
      if (editing && initial?.id) {
        await updateActivity(initial.id, payload)
      } else {
        await createActivity(payload)
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Atividade atualizada.' : 'Atividade agendada.')
      qc.invalidateQueries({ queryKey: ['activities'] })
      qc.invalidateQueries({ queryKey: ['activities-mine'] })
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar atividade' : 'Nova atividade'}</DialogTitle>
          {clientName && <DialogDescription>Cliente: {clientName}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map(k => (
                    <SelectItem key={k} value={k}>{ACTIVITY_TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Duração (min)</Label>
              <Input type="number" min={5} step={5} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligar para validar interesse" />
          </div>

          <div className="space-y-1">
            <Label>Detalhes</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Pontos a tratar, contexto…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Quando *</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsável *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {people.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email || p.id.slice(0, 8)}
                      {p.id === user?.id ? ' (você)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : (editing ? 'Salvar' : 'Agendar atividade')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
