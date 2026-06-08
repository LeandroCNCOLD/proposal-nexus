import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Phone, Flame, CalendarCheck, Trophy, ShieldAlert, PhoneCall, Calendar as CalendarIcon, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { fetchHotDeals, fetchDashboardKpis } from '../services'
import { fetchAgendaHoje, CORES_TIPO } from '@/modules/crm/services-agenda'
import { SDR_DAILY_GOAL, type CrmCallLog, type CrmPipeline } from '../types'
import { useSdrNames } from '../hooks/use-team-members'
import { CoberturaCarteiraMini } from '@/modules/crm/components/CoberturaCarteiraMini'

type DailyRow = {
  name: string
  completed: number
  attempts: number
  meetings: number
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function fetchTodayCallLogs(): Promise<CrmCallLog[]> {
  const { data, error } = await supabase
    .from('crm_call_logs')
    .select('*')
    .eq('call_date', todayISO())
  if (error) throw error
  return (data ?? []) as CrmCallLog[]
}

function urgencyBadge(days: number | null) {
  const d = days ?? 0
  if (d > 180) return { label: 'CRÍTICO', cls: 'bg-red-600 text-white' }
  if (d >= 60) return { label: 'URGENTE', cls: 'bg-orange-500 text-white' }
  return { label: 'ATENÇÃO', cls: 'bg-yellow-400 text-yellow-900' }
}

function barColorByCompleted(completed: number): string {
  if (completed >= SDR_DAILY_GOAL) return 'bg-[#3B6D11]'
  if (completed >= 8) return 'bg-[#854F0B]'
  return 'bg-[#A32D2D]'
}

export function WarRoomPanel() {
  const { names: sdrNames } = useSdrNames()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const todayLogs = useQuery({
    queryKey: ['war-room', 'today-logs', todayISO()],
    queryFn: fetchTodayCallLogs,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const hotDeals = useQuery({
    queryKey: ['war-room', 'hot-deals'],
    queryFn: () => fetchHotDeals(20),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const kpis = useQuery({
    queryKey: ['war-room', 'kpis'],
    queryFn: fetchDashboardKpis,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const agendaHoje = useQuery({
    queryKey: ['war-room', 'agenda-hoje'],
    queryFn: fetchAgendaHoje,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const rows: DailyRow[] = useMemo(() => {
    const map = new Map<string, DailyRow>()
    for (const n of sdrNames) map.set(n, { name: n, completed: 0, attempts: 0, meetings: 0 })
    for (const l of todayLogs.data ?? []) {
      const key = l.sdr_name || '—'
      if (!map.has(key)) map.set(key, { name: key, completed: 0, attempts: 0, meetings: 0 })
      const r = map.get(key)!
      if (l.result?.startsWith('Atendeu')) r.completed++
      else if (l.result) r.attempts++
      if (l.meeting_booked) r.meetings++
    }
    return Array.from(map.values()).sort((a, b) => b.completed - a.completed)
  }, [todayLogs.data, sdrNames])

  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0)
  const totalAttempts  = rows.reduce((s, r) => s + r.attempts,  0)
  const totalMeetings  = rows.reduce((s, r) => s + r.meetings,  0)
  const totalCallsToday = totalCompleted + totalAttempts

  // Hot leads ordenados por urgência + valor
  const topHot: CrmPipeline[] = useMemo(() => {
    const list = [...(hotDeals.data ?? [])]
    list.sort((a, b) => {
      const sa = (a.value ?? 0) * (1 + (a.days_without_contact ?? 0) / 100)
      const sb = (b.value ?? 0) * (1 + (b.days_without_contact ?? 0) / 100)
      return sb - sa
    })
    return list.slice(0, 6)
  }, [hotDeals.data])

  const alerts = useMemo(() => {
    const out: { tone: 'red' | 'orange' | 'yellow' | 'green'; text: string }[] = []
    for (const r of rows) {
      if (r.completed === 0) out.push({ tone: 'red', text: `${r.name} ainda não tem nenhum contato concluído hoje.` })
      if (r.completed >= SDR_DAILY_GOAL) out.push({ tone: 'green', text: `${r.name} bateu a meta de ${SDR_DAILY_GOAL} contatos! 🎯` })
    }
    for (const d of hotDeals.data ?? []) {
      if ((d.value ?? 0) >= 1_000_000 && (d.days_without_contact ?? 0) > 30) {
        out.push({
          tone: 'orange',
          text: `Lead grande (${formatCurrency(d.value)}) sem contato há ${d.days_without_contact} dias: ${d.client_name}.`,
        })
      }
    }
    return out.slice(0, 8)
  }, [rows, hotDeals.data])

  const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const clockLabel = now.toLocaleTimeString('pt-BR', { hour12: false })

  const isLoading = todayLogs.isLoading || hotDeals.isLoading || kpis.isLoading
  const hasError = todayLogs.error || hotDeals.error || kpis.error

  if (hasError) {
    return (
      <Card className="border-red-300 bg-red-50">
        <CardContent className="pt-6 text-red-800 text-sm">
          Erro ao carregar dados do War Room. Verifique sua conexão e tente novamente.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-[#0F2D5E]">War Room — Reunião Diária</h2>
          <p className="text-sm text-muted-foreground capitalize">
            Meta: <strong>{SDR_DAILY_GOAL} contatos concluídos por SDR</strong> · {todayLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold text-[#0F2D5E] tabular-nums">{clockLabel}</span>
          <Badge className="bg-green-600 text-white animate-pulse">● Ao vivo</Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Phone className="h-5 w-5 text-green-600" />}
          label="Concluídos hoje"
          value={isLoading ? '—' : totalCompleted}
          sub={`Meta do time: ${SDR_DAILY_GOAL * Math.max(sdrNames.length, 1)}`}
          highlight={totalCompleted >= SDR_DAILY_GOAL * Math.max(sdrNames.length, 1) ? 'green' : undefined}
        />
        <KpiCard
          icon={<PhoneCall className="h-5 w-5 text-blue-600" />}
          label="Ligações hoje (total)"
          value={isLoading ? '—' : totalCallsToday}
          sub={`${totalAttempts} tentativas + ${totalCompleted} concluídos`}
        />
        <KpiCard
          icon={<CalendarCheck className="h-5 w-5 text-indigo-600" />}
          label="Reuniões hoje"
          value={isLoading ? '—' : totalMeetings}
          sub="agendadas por SDRs"
        />
        <KpiCard
          icon={<Flame className="h-5 w-5 text-red-500" />}
          label="Quentes (pipeline)"
          value={isLoading ? '—' : (kpis.data?.hotDeals ?? 0)}
          sub="Quente + Muito Quente, ativos"
        />
      </div>

      <CoberturaCarteiraMini />



      {/* Meta diária por SDR */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Meta diária por SDR — {SDR_DAILY_GOAL} contatos concluídos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">SDR</th>
                    <th className="py-2 px-2 w-[35%]">Barra de progresso</th>
                    <th className="py-2 px-2 text-center">Concluídos hoje</th>
                    <th className="py-2 px-2 text-center">Tentativas hoje</th>
                    <th className="py-2 px-2 text-center">Reuniões</th>
                    <th className="py-2 pl-2 text-right">% da meta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const pct = Math.round((r.completed / SDR_DAILY_GOAL) * 100)
                    const barColor = barColorByCompleted(r.completed)
                    return (
                      <tr key={r.name} className="border-b last:border-0">
                        <td className="py-2 pr-2 font-semibold">{r.name}</td>
                        <td className="py-2 px-2">
                          <div className="h-2 w-full rounded bg-muted overflow-hidden">
                            <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-bold">{r.completed}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{r.attempts}</td>
                        <td className="py-2 px-2 text-center">{r.meetings}</td>
                        <td className="py-2 pl-2 text-right font-semibold">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Contato concluído = cliente atendeu a ligação. Caixa postal, WhatsApp, número inválido = tentativa, não conta na meta.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hot Leads — Ação Obrigatória Hoje */}
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
              <Flame className="h-4 w-4" /> Hot Leads — Ação Obrigatória Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <Skeleton className="h-16 w-full" />}
            {!isLoading && topHot.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem hot leads no momento.</p>
            )}
            {topHot.map((deal) => {
              const days = deal.days_without_contact ?? 0
              const u = urgencyBadge(days)
              return (
                <div key={deal.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <Badge className={`text-[10px] shrink-0 ${u.cls}`}>{u.label}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{deal.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deal.closer_name ?? deal.sdr_name ?? '—'} · {days} dias sem contato · {deal.temperature}
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0 text-[#0F2D5E]">{formatCurrency(deal.value)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Reuniões de Hoje */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Reuniões de Hoje
            </CardTitle>
            <Button asChild size="sm" variant="ghost" className="h-6 text-xs text-blue-700">
              <Link to="/app/agenda">Ver agenda →</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {agendaHoje.isLoading && <Skeleton className="h-16 w-full" />}
            {!agendaHoje.isLoading && (agendaHoje.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Sem reuniões agendadas para hoje.</p>
            )}
            {(agendaHoje.data ?? []).slice(0, 5).map((r: any) => {
              const hora = r.data_hora ? new Date(r.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
              const cor = (CORES_TIPO as any)[r.tipo] ?? 'bg-gray-100 text-gray-800'
              return (
                <Link key={r.id} to="/app/agenda/$id" params={{ id: r.id }} className="block">
                  <div className="flex items-center gap-2 py-1.5 border-b last:border-0 hover:bg-muted/40 rounded px-1 -mx-1">
                    <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-[#0F2D5E] tabular-nums">
                      <Clock className="h-3 w-3" /> {hora}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.cliente_nome ?? '—'}</p>
                    </div>
                    <Badge className={`text-[10px] shrink-0 ${cor}`}>{r.tipo}</Badge>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        {/* Alertas automáticos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" /> Alertas automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum alerta no momento.</p>
            )}
            {alerts.map((a, i) => {
              const cls =
                a.tone === 'red'    ? 'bg-red-50 border-red-200 text-red-800' :
                a.tone === 'orange' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                a.tone === 'yellow' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                                      'bg-green-50 border-green-200 text-green-800'
              return (
                <div key={i} className={`text-xs border rounded px-2 py-1.5 ${cls}`}>{a.text}</div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, sub, highlight,
}: { icon: React.ReactNode; label: string; value: number | string; sub?: string; highlight?: 'green' }) {
  return (
    <Card className={highlight === 'green' ? 'border-green-300 bg-green-50/40' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
