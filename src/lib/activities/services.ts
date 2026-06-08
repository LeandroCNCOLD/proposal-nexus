import { supabase } from '@/integrations/supabase/client'
import type { CrmActivity, ActivityStatus, ActivityType } from './types'

export type ActivityFilters = {
  assigned_to?: string | null
  lead_id?: string | null
  status?: ActivityStatus[]
  type?: ActivityType[]
  from?: string
  to?: string
}

export async function fetchActivities(filters: ActivityFilters = {}) {
  let q = supabase.from('crm_activities' as never).select('*')
  if (filters.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
  if (filters.lead_id) q = q.eq('lead_id', filters.lead_id)
  if (filters.status && filters.status.length) q = q.in('status', filters.status as never)
  if (filters.type && filters.type.length) q = q.in('type', filters.type as never)
  if (filters.from) q = q.gte('scheduled_at', filters.from)
  if (filters.to) q = q.lte('scheduled_at', filters.to)
  q = q.order('scheduled_at', { ascending: true })
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as CrmActivity[]
}

export type ActivityCreateInput = {
  lead_id?: string | null
  proposal_id?: string | null
  client_name?: string | null
  type: ActivityType
  title: string
  description?: string | null
  scheduled_at: string
  duration_min?: number | null
  assigned_to: string
  assigned_to_name?: string | null
  reschedule_of?: string | null
}

export async function createActivity(input: ActivityCreateInput) {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('Não autenticado')
  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', u.user.id)
    .maybeSingle()
  const row = {
    ...input,
    created_by: u.user.id,
    created_by_name: prof?.full_name ?? u.user.email ?? null,
  }
  const { data, error } = await supabase
    .from('crm_activities' as never)
    .insert(row as never)
    .select('*')
    .single()
  if (error) throw error
  return data as unknown as CrmActivity
}

export async function updateActivity(id: string, patch: Partial<CrmActivity>) {
  const { error } = await supabase
    .from('crm_activities' as never)
    .update(patch as never)
    .eq('id', id)
  if (error) throw error
}

export async function completeActivity(id: string, outcome?: string) {
  const { data: u } = await supabase.auth.getUser()
  await updateActivity(id, {
    status: 'concluida',
    outcome: outcome ?? null,
    completed_at: new Date().toISOString(),
    completed_by: u.user?.id ?? null,
  })
}

export async function cancelActivity(id: string) {
  await updateActivity(id, { status: 'cancelada' })
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('crm_activities' as never).delete().eq('id', id)
  if (error) throw error
}
