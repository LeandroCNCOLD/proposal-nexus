import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, Flame, AlertTriangle, CalendarCheck, Trophy, ShieldAlert } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { fetchHotDeals, fetchDashboardKpis } from '../services'
import { SDR_DAILY_GOAL, SDR_NAMES, type CrmCallLog } from '../types'

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

export function WarRoomPanel() {
  // Relógio ao vivo (HH:MM:SS)
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

  const rows: DailyRow[] = useMemo(() => {
    const map = new Map<string, DailyRow>()
    // Inicializa todos os SDRs conhecidos
    for (const n of SDR_NAMES) map.set(n, { name: n, completed: 0, attempts: 0, meetings: 0 })
    for (const l of todayLogs.data ?? []) {
      const key = l.sdr_name || '—'
      if (!map.has(key)) map.set(key, { name: key, completed: 0, attempts: 0, meetings: 0 })
      const r = map.get(key)!
      if (l.result?.startsWith('Atendeu')) r.completed++
      else if (l.result) r.attempts++
      if (l.meeting_booked) r.meetings++
    }
    return Array.from(map.values()).sort((a, b) => b.completed - a.completed)
  }, [todayLogs.data])

  const totalCompleted = rows.reduce((s, r) => s + r.completed, 0)
  const totalAttempts  = rows.reduce((s, r) => s + r.attempts,  0)
  const totalMeetings  = rows.reduce((s, r) => s + r.meetings,  0)
  const teamGoal       = SDR_DAILY_GOAL * Math.max(SDR_NAMES.length, rows.length)

  const topHot = useMemo(() => {
    const list = [...(hotDeals.data ?? [])]
    list.sort((a, b) => {
      const da = a.days_without_contact ?? 0
      const db = b.days_without_contact ?? 0
      if (db !== da) return db - da
      return (b.value ?? 0) - (a.value ?? 0)
    })
    return list.slice(0, 5)
  }, [hotDeals.data])

  // Alertas automáticos
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
          text: `Lead grande (${formatCurrency(d.value)}) sem contato há ${d.days_without_contact}d: ${d.client_name}.`,
        })
      }
    }
    for (const d of hotDeals.data ?? []) {
      if (d.meeting_scheduled && (!d.closer_name || d.closer_confirmed !== 'Sim')) {
        out.push({
          tone: 'yellow',
          text: `Reunião sem Closer confirmado: ${d.client_name}${d.closer_name ? ` (Closer: ${d.closer_name})` : ''}.`,
        })
      }
    }
    return out.slice(0, 8)
  }, [rows, hotDeals.data])

  const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const clockLabel = now.toLocaleTimeString('pt-BR', { hour12: false })

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
          label="Contatos concluídos hoje"
          value={totalCompleted}
          sub={`Meta do time: ${teamGoal}`}
          highlight={totalCompleted >= teamGoal ? 'green' : undefined}
        />
        <KpiCard
          icon={<CalendarCheck className="h-5 w-5 text-blue-600" />}
          label="Reuniões agendadas hoje"
          value={totalMeetings}
          sub="somando todos os SDRs"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Tentativas (não contam)"
          value={totalAttempts}
          sub="caixa postal, WhatsApp, etc."
        />
        <KpiCard
          icon={<Flame className="h-5 w-5 text-red-500" />}
          label="Leads sem contato >10d"
          value={kpis.data?.overdue10Days ?? '—'}
          sub="pipeline ativo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de meta por SDR */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Meta por SDR ({SDR_DAILY_GOAL} contatos concluídos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">SDR</th>
                    <th className="py-2 px-2 w-[40%]">Progresso</th>
                    <th className="py-2 px-2 text-center">Concluídos</th>
                    <th className="py-2 px-2 text-center">Tentativas</th>
                    <th className="py-2 px-2 text-center">Reuniões</th>
                    <th className="py-2 pl-2 text-right">% da meta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const pct = Math.round((r.completed / SDR_DAILY_GOAL) * 100)
                    const barColor =
                      pct >= 100 ? 'bg-green-500' :
                      pct >= 50  ? 'bg-orange-400' :
                                   'bg-red-500'
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
            <p className="text-[11px] text-muted-foreground mt-3">
              Contato concluído = cliente atendeu (resultado começando com "Atendeu"). Caixa postal / WhatsApp / número inválido = tentativa, não conta na meta.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Hot leads do dia */}
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
                <Flame className="h-4 w-4" /> Hot leads do dia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topHot.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem dados.</p>
              )}
              {topHot.map((deal, i) => (
                <div key={deal.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className={`text-xs font-bold w-5 ${i < 2 ? 'text-red-600' : 'text-muted-foreground'}`}>{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{deal.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {deal.closer_name ?? deal.sdr_name ?? '—'} · {deal.days_without_contact ?? 0}d sem contato · {deal.temperature}
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0">{formatCurrency(deal.value)}</span>
                </div>
              ))}
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
                <p className="text-xs text-muted-foreground">Nenhum alerta no momento. Bom trabalho!</p>
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
