import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ListChecks, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { fetchActivities } from '@/lib/activities/services'
import { ActivityList } from '@/components/activities/ActivityList'
import { isOverdue, type CrmActivity } from '@/lib/activities/types'

export const Route = createFileRoute('/app/gestao/atividades')({
  component: ManagerActivitiesPage,
})

function ManagerActivitiesPage() {
  const { hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'] as never)
  const [userFilter, setUserFilter] = useState<string>('all')

  const { data: people = [] } = useQuery({
    queryKey: ['profiles-list'],
    enabled: isManager,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>
    },
  })

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', 'manager', userFilter],
    enabled: isManager,
    queryFn: () => fetchActivities(
      userFilter === 'all' ? {} : { assigned_to: userFilter },
    ),
  })

  const grouped = useMemo(() => {
    const byUser = new Map<string, { name: string; items: CrmActivity[] }>()
    for (const a of activities) {
      const key = a.assigned_to
      if (!byUser.has(key)) byUser.set(key, { name: a.assigned_to_name || '—', items: [] })
      byUser.get(key)!.items.push(a)
    }
    return Array.from(byUser.entries()).map(([uid, v]) => {
      const pendentes = v.items.filter(i => i.status === 'pendente')
      const atrasadas = v.items.filter(i => isOverdue(i))
      const concluidas = v.items.filter(i => i.status === 'concluida')
      const total = v.items.length
      const taxa = total > 0 ? Math.round((concluidas.length / total) * 100) : 0
      return { uid, name: v.name, pendentes, atrasadas, concluidas, total, taxa, items: v.items }
    }).sort((a, b) => b.atrasadas.length - a.atrasadas.length)
  }, [activities])

  if (!isManager) {
    return <div className="p-6 text-muted-foreground">Acesso restrito a gestores.</div>
  }

  const totals = {
    pendentes: activities.filter(a => a.status === 'pendente').length,
    atrasadas: activities.filter(a => isOverdue(a)).length,
    concluidas: activities.filter(a => a.status === 'concluida').length,
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E] flex items-center gap-2">
            <ListChecks className="w-6 h-6" /> Gestão de Atividades
          </h1>
          <p className="text-sm text-muted-foreground">Visão consolidada por responsável</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Filtrar por usuário:</label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos</SelectItem>
              {people.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Pendentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{totals.pendentes}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Atrasadas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{totals.atrasadas}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Concluídas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-green-700">{totals.concluidas}</CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
      ) : (
        <div className="space-y-4">
          {grouped.length === 0 && (
            <div className="text-sm text-muted-foreground italic text-center py-6">Nenhuma atividade no filtro.</div>
          )}
          {grouped.map(g => (
            <Card key={g.uid}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{g.pendentes.length} pendentes</Badge>
                    {g.atrasadas.length > 0 && (
                      <Badge variant="destructive">{g.atrasadas.length} atrasadas</Badge>
                    )}
                    <Badge variant="secondary">{g.concluidas.length} concluídas</Badge>
                    <span className="text-muted-foreground">Taxa: {g.taxa}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue={g.atrasadas.length ? 'atrasadas' : 'pendentes'}>
                  <TabsList>
                    <TabsTrigger value="pendentes">Pendentes ({g.pendentes.length})</TabsTrigger>
                    <TabsTrigger value="atrasadas" className={g.atrasadas.length ? 'text-destructive' : ''}>
                      Atrasadas ({g.atrasadas.length})
                    </TabsTrigger>
                    <TabsTrigger value="concluidas">Concluídas ({g.concluidas.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pendentes" className="mt-3">
                    <ActivityList activities={g.pendentes.filter(p => !isOverdue(p))} />
                  </TabsContent>
                  <TabsContent value="atrasadas" className="mt-3">
                    <ActivityList activities={g.atrasadas} />
                  </TabsContent>
                  <TabsContent value="concluidas" className="mt-3">
                    <ActivityList activities={g.concluidas.slice().reverse()} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <Link to="/app/atividades" className="underline">← Minhas atividades</Link>
      </div>
    </div>
  )
}
