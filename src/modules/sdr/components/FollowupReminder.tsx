import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMyDueFollowups, completeFollowup, snoozeFollowup, type SdrFollowupWithLead } from '@/modules/sdr/followups'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

const POLL_MS = 30_000
const LOOKAHEAD_MIN = 15
const SNOOZED_KEY = 'sdr-followup-snoozed-v1'

function getSnoozed(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(SNOOZED_KEY) || '{}') } catch { return {} }
}
function markSnoozed(id: string, minutes: number) {
  const m = getSnoozed()
  m[id] = Date.now() + minutes * 60_000
  sessionStorage.setItem(SNOOZED_KEY, JSON.stringify(m))
}

export function FollowupReminder() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [current, setCurrent] = useState<SdrFollowupWithLead | null>(null)
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['sdr-followups', 'mine', user?.id],
    queryFn: () => fetchMyDueFollowups({ userId: user!.id, lookaheadMin: LOOKAHEAD_MIN }),
    enabled: !!user?.id,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!data || data.length === 0) return
    if (open) return
    const snoozed = getSnoozed()
    const now = Date.now()
    const next = data.find(f => !snoozed[f.id] || snoozed[f.id] < now)
    if (next) {
      setCurrent(next)
      setOpen(true)
    }
  }, [data, open])

  if (!current) return null

  const scheduled = new Date(current.scheduled_at)
  const overdueMin = Math.floor((Date.now() - scheduled.getTime()) / 60_000)
  const isOverdue = overdueMin > 0

  async function handleDone() {
    if (!current) return
    try {
      await completeFollowup(current.id)
      toast.success('Tentativa marcada como concluída.')
      qc.invalidateQueries({ queryKey: ['sdr-followups'] })
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message ?? 'falha'))
    }
    setOpen(false); setCurrent(null)
  }
  async function handleSnooze(min: number) {
    if (!current) return
    try {
      await snoozeFollowup(current.id, min)
      markSnoozed(current.id, min)
      qc.invalidateQueries({ queryKey: ['sdr-followups'] })
    } catch (e: any) {
      toast.error('Erro: ' + (e?.message ?? 'falha'))
    }
    setOpen(false); setCurrent(null)
  }
  function handleDismiss() {
    if (current) markSnoozed(current.id, 5)
    setOpen(false); setCurrent(null)
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleDismiss() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isOverdue ? '🔴' : '⏰'} Hora de retomar o contato
          </DialogTitle>
          <DialogDescription>
            {isOverdue
              ? `Tentativa vencida há ${overdueMin} min. O gestor será alertado se ficar pendente.`
              : `Próxima tentativa programada para ${scheduled.toLocaleString('pt-BR')}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div className="font-semibold">{current.lead?.client_name ?? 'Lead'}</div>
          <div className="text-xs text-muted-foreground font-mono">{current.lead?.lead_code}</div>
          {current.note && <div className="mt-2 text-xs whitespace-pre-wrap">{current.note}</div>}
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSnooze(15)}>Adiar 15 min</Button>
          <Button variant="outline" size="sm" onClick={() => handleSnooze(60)}>Adiar 1 h</Button>
          {current.lead?.id && (
            <Button asChild size="sm" onClick={() => { setOpen(false); setCurrent(null) }}>
              <Link to="/app/sdr/leads/$id" params={{ id: current.lead.id }}>Abrir lead</Link>
            </Button>
          )}
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDone}>
            Já contatei
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
