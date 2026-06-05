import { supabase } from '@/integrations/supabase/client'
import type { CrmPipeline, CrmCallLog, CrmWeeklyReview, PipelineFilters, SdrStatus } from './types'
import { SDR_LOCK_DAYS } from './types'

const INACTIVE_STATUSES: SdrStatus[] = ['Perdido (com motivo)', 'Kill / Arquivar', 'Fechado']

function withDaysWithoutContact<T extends { last_contact_at: string | null }>(rows: T[]): (T & { days_without_contact: number | null })[] {
  const now = Date.now()
  return rows.map(r => ({
    ...r,
    days_without_contact: r.last_contact_at
      ? Math.floor((now - new Date(r.last_contact_at).getTime()) / 86_400_000)
      : null,
  }))
}

/** Banco de Propostas: TODAS as propostas ativas (inclui leads travados por outros SDRs). */
export async function fetchProposalBank(filters: Partial<PipelineFilters> = {}) {
  let q = supabase
    .from('sdr_leads')
    .select('*')
    .not('sdr_status', 'in', `("${INACTIVE_STATUSES.join('","')}")`)
    .order('priority', { ascending: true })
    .order('value', { ascending: false })

  if (filters.search)
    q = q.or(`client_name.ilike.%${filters.search}%,lead_code.ilike.%${filters.search}%`)
  if (filters.temperature) q = q.eq('temperature', filters.temperature)
  if (filters.priority)    q = q.eq('priority', filters.priority)
  if (filters.minValue)    q = q.gte('value', filters.minValue)

  const { data, error } = await q
  if (error) throw error
  return withDaysWithoutContact(data ?? []) as CrmPipeline[]
}

/** Trava o lead para o SDR. Falha silenciosa se já estiver travado por outro. */
export async function lockLead(pipelineId: string, sdrId: string, sdrName: string) {
  const expires = new Date()
  expires.setDate(expires.getDate() + SDR_LOCK_DAYS)

  const { data, error } = await supabase
    .from('sdr_leads')
    .update({
      locked_by_sdr_id: sdrId,
      locked_by_sdr_name: sdrName,
      locked_at: new Date().toISOString(),
      lock_expires_at: expires.toISOString(),
      sdr_name: sdrName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pipelineId)
    .is('locked_by_sdr_id', null)
    .select()
    .single()

  if (error) throw error
  return data as CrmPipeline
}

export const MANAGER_FREEZE_PREFIX = '🔒 Bloqueado pelo gestor'

/** Gestor bloqueia o lead para que ninguém entre em contato. Sobrescreve lock existente. */
export async function freezeLead(pipelineId: string, managerId: string, managerName: string) {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 5)
  const { error } = await supabase
    .from('sdr_leads')
    .update({
      locked_by_sdr_id: managerId,
      locked_by_sdr_name: `${MANAGER_FREEZE_PREFIX} (${managerName})`,
      locked_at: new Date().toISOString(),
      lock_expires_at: expires.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pipelineId)
  if (error) throw error
}

/** Devolve o lead ao banco. */
export async function unlockLead(pipelineId: string) {
  const { error } = await supabase
    .from('sdr_leads')
    .update({
      locked_by_sdr_id: null,
      locked_by_sdr_name: null,
      locked_at: null,
      lock_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pipelineId)
  if (error) throw error
}

/** Minha Carteira: leads travados pelo SDR. */
export async function fetchMyWallet(sdrId: string) {
  const { data, error } = await supabase
    .from('sdr_leads')
    .select('*')
    .eq('locked_by_sdr_id', sdrId)
    .not('locked_by_sdr_name', 'ilike', `${MANAGER_FREEZE_PREFIX}%`)
    .order('locked_at', { ascending: false })
  if (error) throw error
  return withDaysWithoutContact(data ?? []) as CrmPipeline[]
}


/** Renova o lock por mais SDR_LOCK_DAYS dias (chamar a cada atividade). */
export async function renewLock(pipelineId: string) {
  const expires = new Date()
  expires.setDate(expires.getDate() + SDR_LOCK_DAYS)
  const { error } = await supabase
    .from('sdr_leads')
    .update({ lock_expires_at: expires.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', pipelineId)
  if (error) throw error
}

/** Conta quantos leads o SDR tem travados (para checar limite). */
export async function countMyLocks(sdrId: string) {
  const { count, error } = await supabase
    .from('sdr_leads')
    .select('id', { count: 'exact', head: true })
    .eq('locked_by_sdr_id', sdrId)
    .not('locked_by_sdr_name', 'ilike', `${MANAGER_FREEZE_PREFIX}%`)
  if (error) throw error
  return count ?? 0
}



export async function fetchPipeline(filters: Partial<PipelineFilters> = {}) {
  let q = supabase
    .from('sdr_leads')
    .select('*')
    .order('priority', { ascending: true })
    .order('value', { ascending: false })

  if (filters.search)
    q = q.or(`client_name.ilike.%${filters.search}%,lead_code.ilike.%${filters.search}%`)
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
  const dbRow = { ...row } as Record<string, unknown>
  delete dbRow.days_without_contact
  const { data, error } = await supabase
    .from('sdr_leads')
    .upsert(dbRow as Partial<CrmPipeline>, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as CrmPipeline
}

export async function updatePipelineField(id: string, field: keyof CrmPipeline, value: unknown) {
  const { error } = await supabase
    .from('sdr_leads')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchHotDeals(limit = 30) {
  const { data, error } = await supabase
    .from('sdr_leads')
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

  // Regra oficial:
  // - "Atendeu*" = contato CONCLUÍDO (conta na meta diária de 15)
  // - qualquer outro resultado = TENTATIVA (não conta)
  const isCompleted = (result: string | null) => result?.startsWith('Atendeu') ?? false
  const isAttempt   = (result: string | null) => result !== null && !result.startsWith('Atendeu')

  const map = new Map<string, { completed: number; attempts: number; meetings: number; hot: number }>()

  for (const l of logs) {
    if (!map.has(l.sdr_name)) map.set(l.sdr_name, { completed: 0, attempts: 0, meetings: 0, hot: 0 })
    const m = map.get(l.sdr_name)!
    if (isCompleted(l.result)) m.completed++
    if (isAttempt(l.result))   m.attempts++
    if (l.meeting_booked) m.meetings++
    if (l.temperature_after === 'Quente' || l.temperature_after === 'Muito Quente') m.hot++
  }

  const GOAL = 15
  return Array.from(map.entries()).map(([name, m]) => {
    const totalCalls = m.completed + m.attempts
    return {
      name,
      completedContacts: m.completed,
      attempts: m.attempts,
      totalCalls,
      realAnswers: m.completed,
      answerRate: totalCalls ? Math.round((m.completed / totalCalls) * 100) : 0,
      meetingsBooked: m.meetings,
      meetingsHeld: 0,
      conversionRate: m.completed ? Math.round((m.meetings / m.completed) * 100) : 0,
      hotDeals: m.hot,
      closedDeals: 0,
      goalPct: Math.round((m.completed / GOAL) * 100),
      goalReached: m.completed >= GOAL,
    }
  })
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
    supabase.from('sdr_leads')
      .select('sdr_status, temperature, priority, value, last_contact_at'),
    supabase.from('crm_call_logs').select('id', { count: 'exact', head: true }).eq('call_date', today),
  ])

  if (pipeline.error) throw pipeline.error

  const todayTs = Date.now()
  const rows = (pipeline.data ?? []).map(r => ({
    ...r,
    days_without_contact: r.last_contact_at
      ? Math.floor((todayTs - new Date(r.last_contact_at).getTime()) / 86_400_000)
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
