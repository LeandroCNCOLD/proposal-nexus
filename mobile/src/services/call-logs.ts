import { supabase } from '../lib/supabase'
import type { CrmCallLog, CallResult, Temperature } from '../types/crm'

// crm_call_logs colunas reais:
// id, created_at, pipeline_id (= sdr_leads.id), sdr_id, sdr_name,
// call_date, call_time, duration_min, result, temperature_after,
// meeting_booked, observation, channel, proof_path, proof_validated

export async function iniciarLigacao(data: {
  pipeline_id: string
  sdr_id: string
  sdr_name: string
  numero_discado: string
  tipo_numero: 'celular' | 'fixo' | 'whatsapp'
}): Promise<CrmCallLog> {
  const { data: result, error } = await supabase
    .from('crm_call_logs')
    .insert({
      pipeline_id: data.pipeline_id,
      sdr_id: data.sdr_id,
      sdr_name: data.sdr_name,
      call_date: new Date().toISOString().slice(0, 10),
      call_time: new Date().toTimeString().slice(0, 8),
      channel: data.tipo_numero,
      result: null,
      meeting_booked: false,
    })
    .select()
    .single()
  if (error) throw error
  // Adaptar para interface CrmCallLog
  return {
    ...result,
    numero_discado: data.numero_discado,
    duracao_segundos: null,
    iniciado_em: new Date().toISOString(),
    temperature_after: null,
  } as CrmCallLog
}

export async function finalizarLigacao(
  logId: string,
  pipelineId: string,
  data: {
    result: CallResult
    meeting_booked: boolean
    observation?: string
    duracao_segundos?: number
    temperature_after?: Temperature
  }
): Promise<void> {
  const agora = new Date().toISOString()

  // duration_min = segundos / 60 arredondado
  const duration_min = data.duracao_segundos
    ? Math.round(data.duracao_segundos / 60)
    : null

  await supabase
    .from('crm_call_logs')
    .update({
      result: data.result,
      meeting_booked: data.meeting_booked,
      observation: data.observation ?? null,
      duration_min,
      temperature_after: data.temperature_after ?? null,
    })
    .eq('id', logId)

  const updates: Record<string, unknown> = {
    last_contact_at: agora.slice(0, 10),
    call_result: data.result,
    call_observation: data.observation ?? null,
    updated_at: agora,
  }
  if (data.temperature_after) updates.temperature = data.temperature_after
  if (data.meeting_booked) {
    updates.sdr_status = 'Reunião Agendada'
    updates.meeting_scheduled = true
  }

  await supabase.from('sdr_leads').update(updates).eq('id', pipelineId)
}

export async function fetchLigacoesHoje(sdrId?: string): Promise<CrmCallLog[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  let q = supabase
    .from('crm_call_logs')
    .select('*')
    .eq('call_date', hoje)
    .order('created_at', { ascending: false })
  if (sdrId) q = q.eq('sdr_id', sdrId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    numero_discado: null,
    duracao_segundos: r.duration_min ? r.duration_min * 60 : null,
    iniciado_em: r.created_at,
    temperature_after: r.temperature_after ?? null,
  })) as CrmCallLog[]
}

export async function fetchHistoricoLead(pipelineId: string): Promise<CrmCallLog[]> {
  const { data, error } = await supabase
    .from('crm_call_logs')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    numero_discado: null,
    duracao_segundos: r.duration_min ? r.duration_min * 60 : null,
    iniciado_em: r.created_at,
  })) as CrmCallLog[]
}

export async function fetchMetricasTempoReal() {
  // Calcular métricas do dia direto da tabela crm_call_logs
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('crm_call_logs')
    .select('sdr_name, result, meeting_booked')
    .eq('call_date', hoje)

  if (error || !data) return []

  // Agrupar por SDR
  const map: Record<string, any> = {}
  for (const row of data) {
    if (!row.sdr_name) continue
    if (!map[row.sdr_name]) {
      map[row.sdr_name] = {
        sdr_name: row.sdr_name,
        concluidos: 0,
        tentativas: 0,
        reunioes: 0,
      }
    }
    map[row.sdr_name].tentativas++
    if (row.result) map[row.sdr_name].concluidos++
    if (row.meeting_booked) map[row.sdr_name].reunioes++
  }

  return Object.values(map)
}
