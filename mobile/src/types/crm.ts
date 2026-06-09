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
  lead_code?: string          // campo real na sdr_leads
  proposal_number: string     // mapeado de lead_code no serviço
  client_name: string
  city: string | null
  state: string | null
  value: number
  sdr_name: string | null
  closer_name: string | null
  sdr_status: SdrStatus
  temperature: Temperature
  priority: Priority
  last_contact_at: string | null
  next_contact_at: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_mobile: string | null
  locked_by_sdr_id: string | null
  locked_by_sdr_name: string | null
  days_without_contact: number | null
  value_range: string | null
}

export interface CrmCallLog {
  id: string
  pipeline_id: string | null
  sdr_id: string | null
  sdr_name: string
  call_date: string
  call_time: string | null
  result: CallResult | null
  meeting_booked: boolean
  observation: string | null
  numero_discado: string | null
  duracao_segundos: number | null
  iniciado_em: string | null
  temperature_after: Temperature | null
}

export interface CrmAgenda {
  id: string
  client_name: string
  proposal_number: string | null
  tipo: string
  status: string
  data_inicio: string
  data_fim: string
  closer_nome: string
  sdr_nome: string | null
  closer_confirmou: boolean
  local: string | null
  link_reuniao: string | null
  observacoes: string | null
}

export interface SdrMetrica {
  sdr_name: string
  concluidos: number
  tentativas: number
  reunioes: number
  meta_dia: number
  meta_atingida: boolean
  faltam_para_meta: number
  taxa_atendimento: number
  ultima_ligacao: string | null
}

export const CALL_RESULTS_ATENDEU: CallResult[] = [
  'Atendeu - Muito interessado',
  'Atendeu - Pediu retorno',
  'Atendeu - Resistência de preço',
  'Atendeu - Projeto parado/cancelado',
]

export const CALL_RESULTS_NAO_ATENDEU: CallResult[] = [
  'Não atendeu - WhatsApp',
  'Não atendeu - Caixa postal',
  'Número inválido',
  'Concorrente ganhou',
  'Outros',
]

export const TEMPERATURE_OPTIONS: Temperature[] = [
  'Frio',
  'Morno',
  'Quente',
  'Muito Quente',
]

export const SDR_NAMES = ['Katlin', 'Silmar', 'Tais', 'Vitor'] as const

export const CLOSER_NAMES = ['Rafael', 'Elton', 'Rodrigo', 'Leandro'] as const
