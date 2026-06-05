import { supabase } from '@/integrations/supabase/client'
import type { CrmPipeline, CrmCallLog, CrmWeeklyReview, PipelineFilters, SdrStatus } from './types'

export async function fetchPipeline(filters: Partial<PipelineFilters> = {}) {
  let q = supabase
    .from('crm_pipeline')
    .select('*')
    .order('priority', { ascending: true })
    .order('value', { ascending: false })

  if (filters.search)
    q = q.or(`client_name.ilike.%${filters.search}%,proposal_number.ilike.%${filters.search}%`)
  if (filters.sdrName)     q = q.eq('sdr_name', filters.sdrName)
  if (filters.closerName)  q = q.eq('closer_name', filters.closerName)
  if (filters.status)      q = q.eq('sdr_status', filters.status)
  if (filters.temperature) q = q.eq('temperature', filters.temperature)
  if (filters.priority)    q = q.eq('priority', filters.priority)
  if (filters.minValue)    q = q.gte('value', filters.minValue)

  const { data, error } = await q
  if (error) throw error
  const today = Date.now()
  const withDays = (data ?? []).map(row => ({
    ...row,
    days_without_contact: row.last_contact_at
      ? Math.floor((today - new Date(row.last_contact_at).getTime()) / 86_400_000)
      : null,
  }))
  return withDays as CrmPipeline[]
}

export async function upsertPipelineRow(row: Partial<CrmPipeline> & { id?: string }) {
  const { data, error } = await supabase
    .from('crm_pipeline')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as CrmPipeline
}

export async function updatePipelineField(id: string, field: keyof CrmPipeline, value: unknown) {
  const { error } = await supabase
    .from('crm_pipeline')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchHotDeals(limit = 30) {
  const { data, error } = await supabase
    .from('crm_pipeline')
    .select('*')
    .eq('priority', 'Alta')
    .not('sdr_status', 'in', '("Kill / Arquivar","Fechado")')
    .order('value', { ascending: false })
    .limit(limit)
  if (error) throw error
  const today = Date.now()
  const withDays = (data ?? []).map(row => ({
    ...row,
    days_without_contact: row.last_contact_at
      ? Math.floor((today - new Date(row.last_contact_at).getTime()) / 86_400_000)
      : null,
  }))
  return withDays as CrmPipeline[]
}

export async function fetchCallLogs(opts?: { pipelineId?: string; date?: string }) {
  let q = supabase
    .from('crm_call_logs')
    .select('*')
    .order('call_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (opts?.pipelineId) q = q.eq('pipeline_id', opts.pipelineId)
  if (opts?.date)       q = q.eq('call_date', opts.date)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CrmCallLog[]
}

export async function insertCallLog(log: Omit<CrmCallLog, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('crm_call_logs')
    .insert(log)
    .select()
    .single()
  if (error) throw error
  return data as CrmCallLog
}

export async function fetchSdrMetrics(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from('crm_call_logs')
    .select('sdr_name, result, meeting_booked, temperature_after')
    .gte('call_date', startDate)
    .lte('call_date', endDate)
  if (error) throw error

  const logs = (data ?? []) as Pick<CrmCallLog, 'sdr_name' | 'result' | 'meeting_booked' | 'temperature_after'>[]
  const map = new Map<string, { total: number; answered: number; meetings: number; hot: number }>()

  for (const l of logs) {
    if (!map.has(l.sdr_name)) map.set(l.sdr_name, { total: 0, answered: 0, meetings: 0, hot: 0 })
    const m = map.get(l.sdr_name)!
    m.total++
    if (l.result?.startsWith('Atendeu')) m.answered++
    if (l.meeting_booked) m.meetings++
    if (l.temperature_after === 'Quente' || l.temperature_after === 'Muito Quente') m.hot++
  }

  return Array.from(map.entries()).map(([name, m]) => ({
    name,
    totalCalls: m.total,
    realAnswers: m.answered,
    answerRate: m.total ? Math.round((m.answered / m.total) * 100) : 0,
    meetingsBooked: m.meetings,
    meetingsHeld: 0,
    conversionRate: m.total ? Math.round((m.meetings / m.total) * 100) : 0,
    hotDeals: m.hot,
    closedDeals: 0,
  }))
}

export async function fetchWeeklyReviews(limit = 12) {
  const { data, error } = await supabase
    .from('crm_weekly_reviews')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CrmWeeklyReview[]
}

export async function upsertWeeklyReview(review: Partial<CrmWeeklyReview> & { week_start: string }) {
  const { data, error } = await supabase
    .from('crm_weekly_reviews')
    .upsert(review, { onConflict: 'week_start' })
    .select()
    .single()
  if (error) throw error
  return data as CrmWeeklyReview
}

const _STATUS_GROUP: SdrStatus[] = [
  'Não Contatado','Contatado - Aguardando Retorno','Reunião Agendada',
  'Em Negociação com Closer','Quente - Alta Chance de Fechamento',
]

export async function fetchDashboardKpis() {
  const today = new Date().toISOString().slice(0, 10)

  const [pipeline, callsToday] = await Promise.all([
    supabase.from('crm_pipeline').select('sdr_status, temperature, priority, value, last_contact_at'),
    supabase.from('crm_call_logs').select('id', { count: 'exact', head: true }).eq('call_date', today),
  ])

  if (pipeline.error) throw pipeline.error
  const todayMs = Date.now()
  const rows = (pipeline.data ?? []).map(r => ({
    ...r,
    days_without_contact: r.last_contact_at
      ? Math.floor((todayMs - new Date(r.last_contact_at).getTime()) / 86_400_000)
      : null,
  })) as Pick<CrmPipeline, 'sdr_status' | 'temperature' | 'priority' | 'value' | 'days_without_contact'>[]
  const active = rows.filter(r => !['Kill / Arquivar','Fechado','Perdido (com motivo)'].includes(r.sdr_status))

  return {
    totalActive: active.length,
    totalValue: active.reduce((s, r) => s + r.value, 0),
    highPriority: active.filter(r => r.priority === 'Alta').length,
    hotDeals: active.filter(r => r.temperature === 'Quente' || r.temperature === 'Muito Quente').length,
    overdue10Days: active.filter(r => (r.days_without_contact ?? 0) > 10).length,
    overdue30Days: active.filter(r => (r.days_without_contact ?? 0) > 30).length,
    callsToday: callsToday.count ?? 0,
    byTemperature: {
      Frio: active.filter(r => r.temperature === 'Frio').length,
      Morno: active.filter(r => r.temperature === 'Morno').length,
      Quente: active.filter(r => r.temperature === 'Quente').length,
      'Muito Quente': active.filter(r => r.temperature === 'Muito Quente').length,
    },
  }
}
