export type SdrStatus =
  | 'Não Contatado'
  | 'Contatado - Aguardando Retorno'
  | 'Reunião Agendada'
  | 'Reunião Realizada'
  | 'Em Negociação com Closer'
  | 'Proposta em Revisão'
  | 'Quente - Alta Chance de Fechamento'
  | 'Perdido (com motivo)'
  | 'Kill / Arquivar'
  | 'Fechado'

export type Temperature = 'Frio' | 'Morno' | 'Quente' | 'Muito Quente'
export type Priority = 'Alta' | 'Média' | 'Baixa'
export type CloserConfirmed = 'Sim' | 'Não' | 'Pendente'
export type TeamRole = 'SDR' | 'Closer' | 'Gestor'
export type CallResult =
  | 'Atendeu - Muito interessado'
  | 'Atendeu - Pediu retorno'
  | 'Atendeu - Resistência de preço'
  | 'Atendeu - Projeto parado/cancelado'
  | 'Não atendeu - WhatsApp'
  | 'Não atendeu - Caixa postal'
  | 'Número inválido'
  | 'Concorrente ganhou'
  | 'Outros'

export interface CrmPipeline {
  id: string
  created_at: string
  updated_at: string
  proposal_number: string
  client_name: string
  city: string | null
  state: string | null
  value: number
  sdr_id: string | null
  closer_id: string | null
  sdr_name: string | null
  closer_name: string | null
  sdr_status: SdrStatus
  temperature: Temperature
  priority: Priority
  last_contact_at: string | null
  next_contact_at: string | null
  meeting_scheduled: boolean
  meeting_date: string | null
  closer_confirmed: CloserConfirmed
  call_result: CallResult | null
  call_observation: string | null
  next_step: string | null
  probability_pct: number | null
  internal_note: string | null
  days_without_contact: number | null
  value_range: string | null
}

export interface CrmCallLog {
  id: string
  created_at: string
  pipeline_id: string | null
  sdr_id: string | null
  sdr_name: string
  call_date: string
  call_time: string | null
  duration_min: number | null
  result: CallResult | null
  temperature_after: Temperature | null
  meeting_booked: boolean
  observation: string | null
}

export interface CrmWeeklyReview {
  id: string
  week_start: string
  total_calls: number
  meetings_booked: number
  meetings_held: number
  hot_deals_count: number
  learnings: string | null
  bottlenecks: string | null
  next_week_plan: string | null
}

export interface SdrMetrics {
  name: string
  totalCalls: number
  realAnswers: number
  answerRate: number
  meetingsBooked: number
  meetingsHeld: number
  conversionRate: number
  hotDeals: number
  closedDeals: number
}

export interface PipelineFilters {
  search: string
  sdrName: string | null
  closerName: string | null
  status: SdrStatus | null
  temperature: Temperature | null
  priority: Priority | null
  minValue: number | null
}

export const SDR_STATUS_OPTIONS: SdrStatus[] = [
  'Não Contatado','Contatado - Aguardando Retorno','Reunião Agendada',
  'Reunião Realizada','Em Negociação com Closer','Proposta em Revisão',
  'Quente - Alta Chance de Fechamento','Perdido (com motivo)','Kill / Arquivar','Fechado',
]
export const TEMPERATURE_OPTIONS: Temperature[] = ['Frio','Morno','Quente','Muito Quente']
export const PRIORITY_OPTIONS: Priority[] = ['Alta','Média','Baixa']
export const CALL_RESULT_OPTIONS: CallResult[] = [
  'Atendeu - Muito interessado','Atendeu - Pediu retorno',
  'Atendeu - Resistência de preço','Atendeu - Projeto parado/cancelado',
  'Não atendeu - WhatsApp','Não atendeu - Caixa postal',
  'Número inválido','Concorrente ganhou','Outros',
]
export const SDR_NAMES = ['Katlin','Silmar','Tais','Vitor'] as const
export const CLOSER_NAMES = ['Rafael','Elton','Rodrigo','Leandro'] as const
