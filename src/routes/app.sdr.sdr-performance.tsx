import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Phone, CalendarCheck, Flame, CheckCircle2, AlertTriangle, Trophy, Medal, Award } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { SDR_DAILY_GOAL, SDR_DAILY_POINTS_GOAL, SDR_POINTS_ANSWERED, SDR_POINTS_ATTEMPT, type CrmCallLog } from '@/modules/sdr/types'
import { useSdrNames } from '@/modules/sdr/hooks/use-team-members'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/app/sdr/sdr-performance')({
  component: SdrPerformancePage,
})

const MONTHLY_GOAL = SDR_DAILY_GOAL * 22 // 15/dia × 22 dias úteis
// Volume mínimo para a taxa de contato ser considerada estatisticamente confiável.
// Abaixo disso, uma "conversão" de 100% é exibida com alerta de amostra pequena.
const MIN_SAMPLE_FOR_CONVERSION = 10

function todayISO() { return new Date().toISOString().slice(0, 10) }
function yesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
function monthStartISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

type DayBucket = { completed: number; attempts: number; meetings: number; hot: number }
type Agg = {
  name: string
  today: DayBucket
  yesterday: DayBucket
  month: DayBucket
  // dias úteis com atividade (para média) e variação
  activeDaysMonth: number
}

function emptyBucket(): DayBucket { return { completed: 0, attempts: 0, meetings: 0, hot: 0 } }

function classifyInto(bucket: DayBucket, l: CrmCallLog) {
  if (l.result?.startsWith('Atendeu')) bucket.completed++
  else if (l.result) bucket.attempts++
  if (l.meeting_booked) bucket.meetings++
  if (l.temperature_after === 'Quente' || l.temperature_after === 'Muito Quente') bucket.hot++
}

async function fetchPerf() {
  const start = monthStartISO()
  const today = todayISO()
  const { data, error } = await supabase
    .from('crm_call_logs')
    .select('*')
    .gte('call_date', start)
    .lte('call_date', today)
  if (error) throw error
  return { logs: (data ?? []) as CrmCallLog[] }
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
    const today = todayISO()
    const yesterday = yesterdayISO()
    const map = new Map<string, Agg>()
    for (const n of sdrNames) {
      map.set(n, {
        name: n,
        today: emptyBucket(),
        yesterday: emptyBucket(),
        month: emptyBucket(),
        activeDaysMonth: 0,
      })
    }
    const activeDays = new Map<string, Set<string>>()
    for (const l of data?.logs ?? []) {
      const a = map.get(l.sdr_name)
      if (!a) continue
      classifyInto(a.month, l)
      if (l.call_date === today) classifyInto(a.today, l)
      if (l.call_date === yesterday) classifyInto(a.yesterday, l)
      if (l.result) {
        let s = activeDays.get(l.sdr_name)
        if (!s) { s = new Set(); activeDays.set(l.sdr_name, s) }
        s.add(l.call_date)
      }
    }
    for (const a of map.values()) {
      a.activeDaysMonth = activeDays.get(a.name)?.size ?? 0
    }
    return Array.from(map.values())
  }, [data, sdrNames])

  const ranking = useMemo(
    () => [...aggs].sort((a, b) => b.month.completed - a.month.completed || b.month.meetings - a.month.meetings),
    [aggs],
  )

  // Série diária por SDR (mês corrente) para o gráfico de curva de rendimento
  const dailySeriesByName = useMemo(() => {
    const out = new Map<string, Array<{ date: string; label: string; ligacoes: number; atendidas: number; reunioes: number; quentes: number }>>()
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
    for (const l of data?.logs ?? []) {
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
            Meta diária: <strong>{SDR_DAILY_POINTS_GOAL} pontos</strong> · <strong>{SDR_DAILY_GOAL} atendidas</strong> recomendadas · Mensal: <strong>{MONTHLY_GOAL}</strong> atendidas (22 dias úteis)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Toda tentativa de contato pontua. <strong>Atendeu = {SDR_POINTS_ANSWERED} pts</strong>; demais resultados (caixa postal, WhatsApp, número inválido, concorrente, outros) = <strong>{SDR_POINTS_ATTEMPT} pt</strong>. Assim quem está ligando aparece no placar mesmo sem o cliente atender.
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
              const todayCalls = sdr.today.completed + sdr.today.attempts
              const yCalls = sdr.yesterday.completed + sdr.yesterday.attempts
              const goalPct = Math.round((sdr.today.completed / SDR_DAILY_GOAL) * 100)
              const todayContactRate = todayCalls ? Math.round((sdr.today.completed / todayCalls) * 100) : 0
              const monthCalls = sdr.month.completed + sdr.month.attempts
              const monthContactRate = monthCalls ? Math.round((sdr.month.completed / monthCalls) * 100) : 0
              const suspicious = monthCalls > 0 && monthCalls < MIN_SAMPLE_FOR_CONVERSION && monthContactRate >= 90
              const userId = idByName.get(sdr.name)
              const delta = todayCalls - yCalls
              const card = (
                <Card key={sdr.name} className={isManager && userId ? 'hover:ring-2 hover:ring-blue-300 transition cursor-pointer h-full' : 'h-full'}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 grid place-items-center font-bold text-sm">
                        {sdr.name[0]}
                      </span>
                      {sdr.name}
                      {sdr.today.completed >= SDR_DAILY_GOAL && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Hoje */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                        <span className="font-semibold uppercase tracking-wide">Hoje</span>
                        <span className={delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : ''}>
                          vs ontem: {delta > 0 ? '+' : ''}{delta}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Metric icon={<Phone className="h-3 w-3" />} label="Ligações" value={todayCalls} />
                        <Metric icon={<CheckCircle2 className="h-3 w-3" />} label="Atendidas" value={sdr.today.completed} />
                        <Metric icon={<CalendarCheck className="h-3 w-3" />} label="Reuniões" value={sdr.today.meetings} />
                        <Metric icon={<Flame className="h-3 w-3" />} label="Quentes" value={sdr.today.hot} />
                      </div>
                    </div>

                    {/* Ontem (resumo) */}
                    <div className="bg-muted/30 rounded p-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-semibold uppercase tracking-wide text-[10px]">Ontem</span>
                      <span>{yCalls} ligações</span>
                      <span>·</span>
                      <span>{sdr.yesterday.completed} atendidas</span>
                      <span>·</span>
                      <span>{sdr.yesterday.meetings} reuniões</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Pontuação hoje ({sdr.today.completed * 2 + sdr.today.attempts}/{SDR_DAILY_POINTS_GOAL} pts)</span>
                        <span className="font-semibold">{Math.round(((sdr.today.completed * 2 + sdr.today.attempts) / SDR_DAILY_POINTS_GOAL) * 100)}%</span>
                      </div>
                      <Progress value={Math.min(Math.round(((sdr.today.completed * 2 + sdr.today.attempts) / SDR_DAILY_POINTS_GOAL) * 100), 100)} className="h-2 bg-blue-100" />
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span>{sdr.today.completed} atendidas × 2 + {sdr.today.attempts} tentativas × 1</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Meta de atendidas ({sdr.today.completed}/{SDR_DAILY_GOAL})</span>
                        <span className="font-semibold">{goalPct}%</span>
                      </div>
                      <Progress value={Math.min(goalPct, 100)} className="h-1.5" />
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span>Taxa de contato hoje: <strong>{todayContactRate}%</strong></span>
                      </div>
                    </div>

                    {/* Acumulado mês */}
                    <div className="text-[11px] text-muted-foreground border-t pt-2 space-y-0.5">
                      <div>
                        Mês: <strong>{sdr.month.completed}</strong> atendidas de {monthCalls} ligações ({monthContactRate}%)
                        {' · '}
                        <strong>{sdr.month.meetings}</strong> reuniões
                      </div>
                      <div>
                        Meta mensal: <strong>{sdr.month.completed} / {MONTHLY_GOAL}</strong>
                        {' · '}
                        Média/dia ativo:{' '}
                        <strong>
                          {sdr.activeDaysMonth ? (monthCalls / sdr.activeDaysMonth).toFixed(1) : '—'}
                        </strong>
                      </div>
                      {suspicious && (
                        <div className="flex items-start gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 mt-1">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>
                            Amostra pequena ({monthCalls} ligações). Taxa de {monthContactRate}% pode não refletir a realidade —
                            aumentar volume para validar a performance.
                          </span>
                        </div>
                      )}
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
                    {todayCalls === 0 && (
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
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking mensal
          </CardTitle>
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
                    <th className="py-2 px-2 text-center">Ligações (mês)</th>
                    <th className="py-2 px-2 text-center">Atendidas</th>
                    <th className="py-2 px-2 text-center">Taxa contato</th>
                    <th className="py-2 px-2 text-center">Reuniões</th>
                    <th className="py-2 px-2 text-center">Conv. reunião</th>
                    <th className="py-2 px-2 text-center">Hoje</th>
                    <th className="py-2 px-2 text-center">Ontem</th>
                    <th className="py-2 pl-2 text-right">% Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => {
                    const monthCalls = r.month.completed + r.month.attempts
                    const contactRate = monthCalls ? Math.round((r.month.completed / monthCalls) * 100) : 0
                    const conv = r.month.completed ? Math.round((r.month.meetings / r.month.completed) * 100) : 0
                    const pct = Math.round((r.month.completed / MONTHLY_GOAL) * 100)
                    const suspicious = monthCalls > 0 && monthCalls < MIN_SAMPLE_FOR_CONVERSION && contactRate >= 90
                    const medal = i === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-500" /> : i === 1 ? <Medal className="h-3.5 w-3.5 text-slate-400" /> : i === 2 ? <Award className="h-3.5 w-3.5 text-amber-700" /> : null
                    return (
                      <tr key={r.name} className="border-b last:border-0">
                        <td className="py-2 pr-2 text-muted-foreground">
                          <span className="flex items-center gap-1">{i + 1}{medal}</span>
                        </td>
                        <td className="py-2 px-2 font-semibold">{r.name}</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">{monthCalls}</td>
                        <td className="py-2 px-2 text-center font-bold">{r.month.completed}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="inline-flex items-center gap-1">
                            {contactRate}%
                            {suspicious && (
                              <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-[9px] px-1 py-0">
                                amostra baixa
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">{r.month.meetings}</td>
                        <td className="py-2 px-2 text-center">{conv}%</td>
                        <td className="py-2 px-2 text-center text-muted-foreground">
                          {r.today.completed + r.today.attempts}
                          <span className="text-[10px] block">({r.today.completed} atend.)</span>
                        </td>
                        <td className="py-2 px-2 text-center text-muted-foreground">
                          {r.yesterday.completed + r.yesterday.attempts}
                          <span className="text-[10px] block">({r.yesterday.completed} atend.)</span>
                        </td>
                        <td className="py-2 pl-2 text-right font-semibold">{pct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ranking.every(r => r.month.completed === 0 && r.month.attempts === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                  Os dados aparecem aqui assim que as primeiras ligações forem registradas.
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-3 italic">
                * &quot;Amostra baixa&quot; sinaliza taxa de contato acima de 90% com menos de {MIN_SAMPLE_FOR_CONVERSION} ligações no mês — o número é matematicamente válido, mas pouco representativo. Aumentar volume é o caminho para confirmar a performance.
              </p>
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
