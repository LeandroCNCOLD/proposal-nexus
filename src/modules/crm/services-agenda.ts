import { supabase } from '@/integrations/supabase/client'
import type { CrmAgenda, AgendaStatus } from './types'

export async function fetchAgenda(opts?: { closerId?: string; status?: AgendaStatus; date?: string }) {
  let q = supabase
    .from('crm_agenda')
    .select('*')
    .order('start_at', { ascending: true })

  if (opts?.closerId) q = q.eq('closer_id', opts.closerId)
  if (opts?.status)   q = q.eq('status', opts.status)
  if (opts?.date)     q = q.gte('start_at', `${opts.date}T00:00:00`).lt('start_at', `${opts.date}T23:59:59.999`)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CrmAgenda[]
}

export async function fetchAgendaHoje() {
  const today = new Date().toISOString().slice(0, 10)
  return fetchAgenda({ date: today })
}

export async function criarAgendamento(data: Omit<CrmAgenda, 'id' | 'created_at' | 'status'> & { status?: AgendaStatus }) {
  const { data: row, error } = await supabase
    .from('crm_agenda')
    .insert({ ...data, status: data.status ?? 'Agendado' })
    .select()
    .single()
  if (error) throw error
  return row as CrmAgenda
}

export async function confirmarPresenca(id: string) {
  const { data, error } = await supabase
    .from('crm_agenda')
    .update({ status: 'Confirmado' satisfies AgendaStatus })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CrmAgenda
}

export async function cancelarAgendamento(id: string, motivo?: string) {
  const { data, error } = await supabase
    .from('crm_agenda')
    .update({ status: 'Cancelado' satisfies AgendaStatus, notes: motivo ?? null })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as CrmAgenda
}

export async function fetchDisponibilidadeTodosClosers(inicio: string, fim: string) {
  const { data, error } = await supabase
    .from('crm_agenda')
    .select('*')
    .lt('start_at', fim)
    .gt('end_at', inicio)
    .neq('status', 'Cancelado')
    .order('start_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as CrmAgenda[]
  const byCloser = new Map<string, CrmAgenda[]>()
  for (const row of rows) {
    const key = row.closer_name ?? row.closer_id ?? 'Sem closer'
    if (!byCloser.has(key)) byCloser.set(key, [])
    byCloser.get(key)!.push(row)
  }
  return Array.from(byCloser.entries()).map(([closer, compromissos]) => ({ closer, compromissos }))
}

export async function verificarConflito(closer: string, inicio: string, fim: string) {
  const { data, error } = await supabase
    .from('crm_agenda')
    .select('*')
    .or(`closer_name.eq.${closer},closer_id.eq.${closer}`)
    .lt('start_at', fim)
    .gt('end_at', inicio)
    .neq('status', 'Cancelado')
  if (error) throw error
  const conflitos = (data ?? []) as CrmAgenda[]
  return { temConflito: conflitos.length > 0, conflitos }
}
