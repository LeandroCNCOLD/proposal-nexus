import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, ListChecks } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { fetchActivities } from '@/lib/activities/services'
import { ActivityList } from '@/components/activities/ActivityList'
import { ActivityFormDialog } from '@/components/activities/ActivityFormDialog'
import { isOverdue } from '@/lib/activities/types'

export const Route = createFileRoute('/app/atividades')({
  component: ActivitiesPage,
})

function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function endOfDay(d = new Date()) { const x = new Date(d); x.setHours(23,59,59,999); return x }

function ActivitiesPage() {
  const { user, hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)
  const [newOpen, setNewOpen] = useState(false)
  const [tab, setTab] = useState<'hoje' | 'atrasadas' | 'proximas' | 'concluidas' | 'todas'>('hoje')

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['activities-mine', user?.id],
    enabled: !!user,
    queryFn: () => fetchActivities({ assigned_to: user!.id }),
  })

  const buckets = useMemo(() => {
    const today = startOfDay()
    const todayEnd = endOfDay()
    const hoje = all.filter(a => a.status === 'pendente' && new Date(a.scheduled_at) >= today && new Date(a.scheduled_at) <= todayEnd)
    const atrasadas = all.filter(a => isOverdue(a) && new Date(a.scheduled_at) < today)
    const proximas = all.filter(a => a.status === 'pendente' && new Date(a.scheduled_at) > todayEnd)
    const concluidas = all.filter(a => a.status === 'concluida').slice().reverse()
    return { hoje, atrasadas, proximas, concluidas, todas: all }
  }, [all])

  if (!user) return <div className="p-6">Faça login.</div>

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
            <ListChecks className="w-6 h-6" /> Minhas Atividades
          </h1>
          <p className="text-sm text-muted-foreground">
            {buckets.atrasadas.length > 0
              ? `${buckets.atrasadas.length} atrasada(s) · ${buckets.hoje.length} para hoje`
              : `${buckets.hoje.length} para hoje · ${buckets.proximas.length} próximas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button variant="outline" asChild>
              <a href="/app/gestao/atividades">Painel do gestor</a>
            </Button>
          )}
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova atividade
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="hoje">Hoje ({buckets.hoje.length})</TabsTrigger>
          <TabsTrigger value="atrasadas" className={buckets.atrasadas.length ? 'text-destructive' : ''}>
            Atrasadas ({buckets.atrasadas.length})
          </TabsTrigger>
          <TabsTrigger value="proximas">Próximas ({buckets.proximas.length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({buckets.concluidas.length})</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>

        {(['hoje','atrasadas','proximas','concluidas','todas'] as const).map(key => (
          <TabsContent key={key} value={key} className="mt-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
            ) : (
              <ActivityList
                activities={buckets[key]}
                emptyText={key === 'atrasadas' ? 'Nada atrasado. 🎉' : 'Nada por aqui.'}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ActivityFormDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}
