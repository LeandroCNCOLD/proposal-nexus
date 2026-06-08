import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Plus, ListChecks } from 'lucide-react'
import { fetchActivities } from '@/lib/activities/services'
import { ActivityList } from './ActivityList'
import { ActivityFormDialog } from './ActivityFormDialog'

export function LeadActivitiesPanel({
  leadId,
  clientName,
}: {
  leadId: string
  clientName?: string | null
}) {
  const [open, setOpen] = useState(false)
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', { lead_id: leadId }],
    queryFn: () => fetchActivities({ lead_id: leadId }),
  })

  const pending = activities.filter(a => a.status === 'pendente')
  const past = activities.filter(a => a.status !== 'pendente')

  return (
    <div className="border rounded-lg p-4 bg-card space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold flex items-center gap-2 text-[#0F2D5E]">
          <ListChecks className="w-4 h-4" /> Atividades
          <span className="text-xs text-muted-foreground font-normal">
            ({pending.length} pendente{pending.length === 1 ? '' : 's'} · {past.length} concluída{past.length === 1 ? '' : 's'})
          </span>
        </h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-3 h-3 mr-1" /> Nova atividade
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
      ) : (
        <>
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pendentes</h4>
            <ActivityList
              activities={pending}
              showLeadLink={false}
              emptyText="Nenhuma atividade pendente. Que tal agendar a próxima?"
            />
          </div>
          {past.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 mt-4">Histórico</h4>
              <ActivityList
                activities={past.slice().reverse()}
                showLeadLink={false}
                emptyText=""
              />
            </div>
          )}
        </>
      )}

      <ActivityFormDialog
        open={open}
        onOpenChange={setOpen}
        leadId={leadId}
        clientName={clientName}
      />
    </div>
  )
}
