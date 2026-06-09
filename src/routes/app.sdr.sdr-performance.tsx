import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Phone, CalendarCheck, Flame, CheckCircle2 } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { SDR_DAILY_GOAL, type CrmCallLog } from '@/modules/sdr/types'
import { useSdrNames } from '@/modules/sdr/hooks/use-team-members'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/app/sdr/sdr-performance')({
  component: SdrPerformancePage,
})

const MONTHLY_GOAL = SDR_DAILY_GOAL * 22 // 15/dia × 22 dias úteis

function todayISO() { return new Date().toISOString().slice(0, 10) }
function monthStartISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

type Agg = { name: string; completedDay: number; attemptsDay: number; meetingsDay: number; hotDay: number; completedMonth: number; attemptsMonth: number; meetingsMonth: number }

async function fetchPerf() {
  const [day, month] = await Promise.all([
    supabase.from('crm_call_logs').select('*').eq('call_date', todayISO()),
    supabase.from('crm_call_logs').select('*').gte('call_date', monthStartISO()).lte('call_date', todayISO()),
  ])
  if (day.error) throw day.error
  if (month.error) throw month.error
  return { day: (day.data ?? []) as CrmCallLog[], month: (month.data ?? []) as CrmCallLog[] }
}

function SdrPerformancePage() {
  const { names: sdrNames, members: sdrMembers } = useSdrNames()
  const { hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['admin', 'diretoria', 'gerente_comercial'])
  const idByName = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of sdrMembers) {
      const n = (x.full_name?.trim() || x.email?.split('@')[0] || '').trim()
      if (n) m.set(n, x.user_id)
    }
    return m
  }, [sdrMembers])
  const { data, isLoading, error } = useQuery({
    queryKey: ['sdr-performance'],
    queryFn: fetchPerf,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const aggs: Agg[] = useMemo(() => {
    const map = new Map<string, Agg>()
    for (const n of sdrNames) {
      map.set(n, { name: n, completedDay: 0, attemptsDay: 0, meetingsDay: 0, hotDay: 0, completedMonth: 0, attemptsMonth: 0, meetingsMonth: 0 })
    }
    for (const l of data?.day ?? []) {
      const a = map.get(l.sdr_name) ?? { name: l.sdr_name, completedDay: 0, attemptsDay: 0, meetingsDay: 0, hotDay: 0, completedMonth: 0, attemptsMonth: 0, meetingsMonth: 0 }
      if (l.result?.startsWith('Atendeu')) a.completedDay++
      else if (l.result) a.attemptsDay++
      if (l.meeting_booked) a.meetingsDay++
      if (l.temperature_after === 'Quente' || l.temperature_after === 'Muito Quente') a.hotDay++
      map.set(l.sdr_name, a)
    }
    for (const l of data?.month ?? []) {
      const a = map.get(l.sdr_name)
      if (!a) continue
      if (l.result?.startsWith('Atendeu')) a.completedMonth++
      else if (l.result) a.attemptsMonth++
      if (l.meeting_booked) a.meetingsMonth++
    }
    return Array.from(map.values())
  }, [data, sdrNames])

  const ranking = useMemo(() => [...aggs].sort((a, b) => b.completedMonth - a.completedMonth), [aggs])

  // Série diária por SDR (mês corrente) para o gráfico de curva de rendimento
  const dailySeriesByName = useMemo(() => {
    const out = new Map<string, Array<{ date: string; label: string; ligacoes: number; atendidas: number; reunioes: number; quentes: number }>>()
    // gera todos os dias do início do mês até hoje
    const start = new Date(monthStartISO())
    const today = new Date(todayISO())
    const days: string[] = []
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10))
    }
    for (const n of sdrNames) {
      out.set(n, days.map(date => ({
        date,
        label: date.slice(8, 10) + '/' + date.slice(5, 7),
        ligacoes: 0, atendidas: 0, reunioes: 0, quentes: 0,
      })))
    }
    for (const l of data?.month ?? []) {
      const series = out.get(l.sdr_name)
      if (!series) continue
      const row = series.find(r => r.date === l.call_date)
      if (!row) continue
      if (l.result) row.ligacoes++
      if (l.result?.startsWith('Atendeu')) row.atendidas++
      if (l.meeting_booked) row.reunioes++
      if (l.temperature_after === 'Quente' || l.temperature_after === 'Muito Quente') row.quentes++
    }
    return out
  }, [data, sdrNames])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2D5E]">Desempenho dos SDRs</h1>
          <p className="text-sm text-muted-foreground">
            Meta diária: <strong>{SDR_DAILY_GOAL} contatos concluídos</strong> · Meta mensal: <strong>{MONTHLY_GOAL}</strong> (15/dia × 22 dias úteis)
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
          <Link to="/app/sdr/wallet">
            <Plus className="h-4 w-4 mr-1" /> Registrar ligação
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 text-red-800 text-sm">
            Erro ao carregar desempenho dos SDRs. Verifique sua conexão e tente novamente.
          </CardContent>
        </Card>
      )}

      {/* Cards por SDR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)
          : aggs.map((sdr) => {
              const goalPct = Math.round((sdr.completedDay / SDR_DAILY_GOAL) * 100)
              const totalCalls = sdr.completedDay + sdr.attemptsDay
              const userId = idByName.get(sdr.name)
              const card = (
                <Card key={sdr.name} className={isManager && userId ? 'hover:ring-2 hover:ring-blue-300 transition cursor-pointer h-full' : 'h-full'}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center font-bold text-sm">
                        {sdr.name[0]}
                      </span>
                      {sdr.name}
                      {sdr.completedDay >= SDR_DAILY_GOAL && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Metric icon={<Phone className="h-3 w-3" />} label="Ligações" value={totalCalls} />
                      <Metric icon={<CheckCircle2 className="h-3 w-3" />} label="Atendidas" value={sdr.completedDay} />
                      <Metric icon={<CalendarCheck className="h-3 w-3" />} label="Reuniões" value={sdr.meetingsDay} />
                      <Metric icon={<Flame className="h-3 w-3" />} label="Quentes" value={sdr.hotDay} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Meta diária ({sdr.completedDay}/{SDR_DAILY_GOAL} atendidas)</span>
                        <span className="font-semibold">{goalPct}%</span>
                      </div>
                      <Progress value={Math.min(goalPct, 100)} className="h-1.5" />
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span>{sdr.attemptsDay} tentativas sem contato</span>
                        <span>·</span>
                        <span>
                          Taxa de contato: <strong>{totalCalls ? Math.round((sdr.completedDay / totalCalls) * 100) : 0}%</strong>
                        </span>
                        <span>·</span>
                        <span>
                          {sdr.completedDay ? (totalCalls / sdr.completedDay).toFixed(1) : '—'} ligações por contato
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Meta mensal: <strong>{sdr.completedMonth} / {MONTHLY_GOAL}</strong> atendidas · {sdr.attemptsMonth} tentativas no mês
                    </div>

                    {/* Curva diária de rendimento do mês */}
                    <div className="border-t pt-3">
                      <p className="text-[11px] font-semibold text-muted-foreground mb-1">Curva diária (mês)</p>
                      <div className="h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dailySeriesByName.get(sdr.name) ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} width={28} />
                            <Tooltip contentStyle={{ fontSize: 11, padding: '4px 8px' }} />
                            <Legend wrapperStyle={{ fontSize: 9 }} iconSize={8} />
                            <Line type="monotone" dataKey="ligacoes" name="Ligações" stroke="#94a3b8" strokeWidth={1.5} dot={false} />
                            <Line type="monotone" dataKey="atendidas" name="Atendidas" stroke="#2563eb" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="reunioes" name="Reuniões" stroke="#16a34a" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="quentes" name="Quentes" stroke="#ea580c" strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {isManager && userId && (
                      <div className="text-[11px] text-blue-700 font-medium border-t pt-2">
                        Clique para ver a carteira e o histórico →
                      </div>
                    )}
                    {totalCalls === 0 && (
                      <p className="text-[11px] text-muted-foreground italic border-t pt-2">
                        Nenhuma ligação registrada hoje
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
              return isManager && userId ? (
                <Link key={sdr.name} to="/app/gestao/carteiras/$userId" params={{ userId }} className="block">
                  {card}
                </Link>
              ) : card
            })}
      </div>

      {/* Ranking mensal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Ranking mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2 w-8">#</th>
                    <th className="py-2 px-2">SDR</th>
                    <th className="py-2 px-2 text-center">Concluídos (mês)</th>
                    <th className="py-2 px-2 text-center">Tentativas</th>
                    <th className="py-2 px-2 text-center">Reuniões</th>
                    <th className="py-2 px-2 text-center">Conv.</th>
                    <th className="py-2 pl-2 text-right">% Meta mensal</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const conv = r.completedMonth ? Math.round((r.meetingsMonth / r.completedMonth) * 100) : 0
                    const pct = Math.round((r.completedMonth / MONTHLY_GOAL) * 100)
                    return (
                      <tr key={r.name} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-2 font-semibold">{r.name}</td>
                        <td className="py-2 px-2 text-center font-bold">{r.completedMonth}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{r.attemptsMonth}</td>
                        <td className="py-2 px-2 text-center">{r.meetingsMonth}</td>
                        <td className="py-2 px-2 text-center">{conv}%</td>
                        <td className="py-2 pl-2 text-right font-semibold">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ranking.every(r => r.completedMonth === 0 && r.attemptsMonth === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                  Os dados aparecem aqui assim que as primeiras ligações forem registradas.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-muted/40 rounded p-2 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center justify-center gap-1">
        {icon} {label}
      </p>
    </div>
  )
}
