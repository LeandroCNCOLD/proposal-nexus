import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListChecks, ArrowRight, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchActivities } from '@/lib/activities/services'
import { ActivityList } from './ActivityList'
import { isOverdue } from '@/lib/activities/types'

export function ActivitiesDashboardCard() {
  const { user } = useAuth()
  const { data: all = [], isLoading } = useQuery({
    queryKey: ['activities-mine', user?.id],
    enabled: !!user,
    queryFn: () => fetchActivities({ assigned_to: user!.id, status: ['pendente'] }),
  })

  const atrasadas = all.filter(isOverdue)
  const todayEnd = (() => { const d = new Date(); d.setHours(23,59,59,999); return d })()
  const hoje = all.filter(a => !isOverdue(a) && new Date(a.scheduled_at) <= todayEnd)
  const list = [...atrasadas, ...hoje].slice(0, 5)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Atividades
            {atrasadas.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive font-normal">
                <AlertTriangle className="w-3 h-3" /> {atrasadas.length} atrasada{atrasadas.length === 1 ? '' : 's'}
              </span>
            )}
          </CardTitle>
          <Button asChild size="sm" variant="ghost" className="h-7">
            <Link to="/app/atividades">Ver todas <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
        ) : list.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center italic">
            Nada pendente para hoje. 🎉
          </div>
        ) : (
          <ActivityList activities={list} emptyText="" />
        )}
      </CardContent>
    </Card>
  )
}
