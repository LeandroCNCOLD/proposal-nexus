import { supabase } from '../lib/supabase'
import type { CrmPipeline } from '../types/crm'
import { diasSemContato } from '../lib/utils'

// Tabela real: sdr_leads (mapeada para CrmPipeline)
function mapLead(r: any): CrmPipeline {
  return {
    ...r,
    proposal_number: r.lead_code ?? r.proposal_number ?? '',
    days_without_contact: diasSemContato(r.last_contact_at),
  }
}

export async function fetchMinhaCarteira(sdrId: string): Promise<CrmPipeline[]> {
  const { data, error } = await supabase
    .from('sdr_leads')
    .select('*')
    .eq('locked_by_sdr_id', sdrId)
    .not('sdr_status', 'in', '("Kill / Arquivar","Fechado","Perdido (com motivo)")')
    .order('value', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapLead)
}

export async function fetchHotDeals(limit = 10): Promise<CrmPipeline[]> {
  const { data, error } = await supabase
    .from('sdr_leads')
    .select('*')
    .eq('priority', 'Alta')
    .not('sdr_status', 'in', '("Kill / Arquivar","Fechado","Perdido (com motivo)")')
    .order('value', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(mapLead)
}

export async function fetchBancoLeads(opts?: {
  search?: string
  temperature?: string
  priority?: string
}): Promise<CrmPipeline[]> {
  let q = supabase
    .from('sdr_leads')
    .select('*')
    .is('locked_by_sdr_id', null)
    .not('sdr_status', 'in', '("Kill / Arquivar","Fechado","Perdido (com motivo)")')
    .order('value', { ascending: false })
    .limit(100)

  if (opts?.search) q = q.ilike('client_name', `%${opts.search}%`)
  if (opts?.temperature) q = q.eq('temperature', opts.temperature)
  if (opts?.priority) q = q.eq('priority', opts.priority)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapLead)
}

export async function travarLead(
  pipelineId: string,
  sdrId: string,
  sdrName: string
): Promise<void> {
  const expires = new Date()
  expires.setDate(expires.getDate() + 7)
  const { error } = await supabase
    .from('sdr_leads')
    .update({
      locked_by_sdr_id: sdrId,
      locked_by_sdr_name: sdrName,
      locked_at: new Date().toISOString(),
      lock_expires_at: expires.toISOString(),
      sdr_name: sdrName,
    })
    .eq('id', pipelineId)
    .is('locked_by_sdr_id', null)
  if (error) throw error
}

export async function liberarLead(pipelineId: string): Promise<void> {
  const { error } = await supabase
    .from('sdr_leads')
    .update({
      locked_by_sdr_id: null,
      locked_by_sdr_name: null,
      locked_at: null,
      lock_expires_at: null,
    })
    .eq('id', pipelineId)
  if (error) throw error
}

export async function fetchDashboardKpis() {
  const hoje = new Date().toISOString().slice(0, 10)
  const limite10d = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)

  const [pipeline, callsHoje] = await Promise.all([
    supabase
      .from('sdr_leads')
      .select('sdr_status, temperature, priority, value, last_contact_at')
      .not('sdr_status', 'in', '("Kill / Arquivar","Fechado","Perdido (com motivo)")'),
    supabase
      .from('crm_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('call_date', hoje),
  ])

  if (pipeline.error) throw pipeline.error
  const rows = pipeline.data ?? []

  return {
    totalAtivo: rows.length,
    valorTotal: rows.reduce((s, r) => s + (r.value ?? 0), 0),
    quentes: rows.filter(
      r => r.temperature === 'Quente' || r.temperature === 'Muito Quente'
    ).length,
    semContato10d: rows.filter(
      r => !r.last_contact_at || r.last_contact_at < limite10d
    ).length,
    ligacoesHoje: callsHoje.count ?? 0,
  }
}
