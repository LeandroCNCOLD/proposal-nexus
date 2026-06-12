export type ActivityType = 'ligacao' | 'reuniao' | 'email_whatsapp' | 'tarefa'
export type ActivityStatus = 'pendente' | 'concluida' | 'cancelada' | 'reagendada'

export interface CrmActivity {
  id: string
  lead_id: string | null
  proposal_id: string | null
  client_name: string | null
  type: ActivityType
  title: string
  description: string | null
  scheduled_at: string
  duration_min: number | null
  status: ActivityStatus
  outcome: string | null
  assigned_to: string
  assigned_to_name: string | null
  created_by: string
  created_by_name: string | null
  completed_at: string | null
  completed_by: string | null
  reschedule_of: string | null
  created_at: string
  updated_at: string
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  ligacao: 'Ligação',
  reuniao: 'Reunião / Visita',
  email_whatsapp: 'E-mail / WhatsApp',
  tarefa: 'Tarefa interna',
}

export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  ligacao: '📞',
  reuniao: '🤝',
  email_whatsapp: '✉️',
  tarefa: '✅',
}

export const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  reagendada: 'Reagendada',
}

export function isOverdue(a: Pick<CrmActivity, 'scheduled_at' | 'status'>) {
  if (a.status !== 'pendente') return false
  return new Date(a.scheduled_at).getTime() < Date.now()
}
