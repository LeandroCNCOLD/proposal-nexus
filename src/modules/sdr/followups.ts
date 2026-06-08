import { supabase } from '@/integrations/supabase/client'

export interface SdrFollowup {
  id: string
  lead_id: string
  sdr_id: string | null
  sdr_name: string | null
  scheduled_at: string
  note: string | null
  done_at: string | null
  done_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SdrFollowupWithLead extends SdrFollowup {
  lead?: {
    id: string
    lead_code: string
    client_name: string
    sdr_name: string | null
  } | null
}

const client = supabase as any

export async function insertFollowup(input: {
  lead_id: string
  sdr_id: string | null
  sdr_name: string | null
  scheduled_at: string
  note?: string | null
}) {
  const user = (await supabase.auth.getUser()).data.user
  const { data, error } = await client
    .from('sdr_followups')
    .insert({
      lead_id: input.lead_id,
      sdr_id: input.sdr_id ?? user?.id ?? null,
      sdr_name: input.sdr_name,
      scheduled_at: input.scheduled_at,
      note: input.note ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as SdrFollowup
}

export async function completeFollowup(id: string) {
  const user = (await supabase.auth.getUser()).data.user
  const { error } = await client
    .from('sdr_followups')
    .update({ done_at: new Date().toISOString(), done_by: user?.id ?? null })
    .eq('id', id)
  if (error) throw error
}

export async function snoozeFollowup(id: string, minutes: number) {
  const newAt = new Date(Date.now() + minutes * 60_000).toISOString()
  const { error } = await client
    .from('sdr_followups')
    .update({ scheduled_at: newAt })
    .eq('id', id)
  if (error) throw error
}

/** Pendentes do SDR atual já vencidas ou nos próximos N minutos. */
export async function fetchMyDueFollowups(opts: { userId: string; lookaheadMin?: number }) {
  const lookahead = opts.lookaheadMin ?? 15
  const horizon = new Date(Date.now() + lookahead * 60_000).toISOString()
  const { data, error } = await client
    .from('sdr_followups')
    .select('*, lead:sdr_leads(id, lead_code, client_name, sdr_name)')
    .is('done_at', null)
    .eq('sdr_id', opts.userId)
    .lte('scheduled_at', horizon)
    .order('scheduled_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return (data ?? []) as SdrFollowupWithLead[]
}

/** Para gestores: tentativas vencidas há mais de `graceMin` minutos. */
export async function fetchOverdueFollowups(graceMin = 30) {
  const cutoff = new Date(Date.now() - graceMin * 60_000).toISOString()
  const { data, error } = await client
    .from('sdr_followups')
    .select('*, lead:sdr_leads(id, lead_code, client_name, sdr_name)')
    .is('done_at', null)
    .lte('scheduled_at', cutoff)
    .order('scheduled_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []) as SdrFollowupWithLead[]
}

export async function fetchFollowupsForLead(leadId: string) {
  const { data, error } = await client
    .from('sdr_followups')
    .select('*')
    .eq('lead_id', leadId)
    .order('scheduled_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as SdrFollowup[]
}
