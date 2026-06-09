import { useDraggable } from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { Phone, Clock, MoreVertical, Pencil, ArrowRightLeft, UserCheck, Unlock as UnlockIcon, FileText, Calendar, AlertCircle, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { CrmPipeline, Temperature } from '@/modules/sdr/types'

function fmtBRL(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

const TEMP_COLOR: Record<Temperature, string> = {
  'Frio': 'border-l-sky-400',
  'Morno': 'border-l-amber-400',
  'Quente': 'border-l-orange-500',
  'Muito Quente': 'border-l-red-600',
}

export type KanbanCardActions = {
  onOpenScript: (lead: CrmPipeline) => void
  onEdit: (lead: CrmPipeline) => void
  onTransferSdr: (lead: CrmPipeline) => void
  onTransferSeller: (lead: CrmPipeline) => void
  onUnlock: (lead: CrmPipeline) => void
  canTransferSdr?: boolean
}

export type LeadCommSignals = {
  /** dias desde o último contato (ou null se nunca) */
  daysSinceContact: number | null
  /** dias parado na coluna atual */
  staleDays: number
  /** descrição da próxima ação */
  nextActionLabel: string | null
  /** quem precisa agir agora */
  waitingOn: 'me' | 'other' | 'none'
  /** está na zona vermelha (SLA estourado) */
  isStale: boolean
  /** precisa de ação nas próximas 4h */
  isUrgent: boolean
}

export function computeSignals(lead: CrmPipeline & { handoff_status?: string | null }): LeadCommSignals {
  const daysSinceContact = daysSince(lead.last_contact_at)
  const staleDays = daysSince(lead.last_contact_at ?? lead.updated_at) ?? 0
  const handoff = (lead as any).handoff_status === 'transferred'

  let nextActionLabel: string | null = null
  if (lead.meeting_date) {
    const d = new Date(lead.meeting_date)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const isToday = d.toDateString() === new Date().toDateString()
    nextActionLabel = `Reunião ${isToday ? 'hoje' : d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  } else if (lead.next_step) {
    nextActionLabel = lead.next_step.length > 48 ? lead.next_step.slice(0, 45) + '…' : lead.next_step
  } else if (lead.next_contact_at) {
    nextActionLabel = `Retomar em ${new Date(lead.next_contact_at).toLocaleDateString('pt-BR')}`
  } else if (lead.sdr_status === 'Não Contatado') {
    nextActionLabel = 'Primeira ligação'
  } else if (lead.sdr_status === 'Contatado - Aguardando Retorno') {
    nextActionLabel = 'Retornar contato'
  }

  let waitingOn: 'me' | 'other' | 'none' = 'me'
  if (handoff) waitingOn = 'other'
  else if (lead.sdr_status === 'Fechado' || lead.sdr_status === 'Perdido (com motivo)' || lead.sdr_status === 'Kill / Arquivar') waitingOn = 'none'
  else if (lead.sdr_status === 'Contatado - Aguardando Retorno' && (daysSinceContact ?? 0) < 3) waitingOn = 'other'
  else if (lead.sdr_status === 'Reunião Agendada' && lead.meeting_date && new Date(lead.meeting_date).getTime() > Date.now()) waitingOn = 'other'

  const slaByStatus: Record<string, number> = {
    'Não Contatado': 2,
    'Contatado - Aguardando Retorno': 5,
    'Reunião Agendada': 7,
    'Reunião Realizada': 3,
    'Em Negociação com Closer': 7,
  }
  const sla = slaByStatus[lead.sdr_status] ?? 7
  const isStale = waitingOn === 'me' && staleDays >= sla

  const isUrgent = !!(
    (lead.meeting_date && Math.abs(new Date(lead.meeting_date).getTime() - Date.now()) <= 4 * 3600_000) ||
    (lead.next_contact_at && new Date(lead.next_contact_at).toDateString() === new Date().toDateString())
  )

  return { daysSinceContact, staleDays, nextActionLabel, waitingOn, isStale, isUrgent }
}

export function WalletKanbanCard({
  lead,
  actions,
  hasProposal,
  signals,
}: {
  lead: CrmPipeline
  actions: KanbanCardActions
  hasProposal?: boolean
  signals?: LeadCommSignals
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const sig = signals ?? computeSignals(lead)
  const remaining = daysUntil(lead.lock_expires_at)
  const tempBorder = TEMP_COLOR[lead.temperature] ?? 'border-l-muted'
  const phone = lead.contact_mobile || lead.contact_phone

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-md border border-l-4 ${tempBorder} bg-card shadow-sm hover:shadow-md transition ${
        isDragging ? 'opacity-50 ring-2 ring-primary' : ''
      } ${sig.isStale ? 'ring-1 ring-red-300' : sig.isUrgent ? 'ring-1 ring-amber-300' : ''}`}
    >
      {/* Handle de drag = cabeçalho clicável */}
      <div
        {...listeners}
        {...attributes}
        className="px-3 pt-2 pb-1 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground truncate">{lead.lead_code}</span>
          <span className="text-xs font-semibold text-[#0F2D5E] whitespace-nowrap">{fmtBRL(lead.value)}</span>
        </div>
        <Link
          to="/app/sdr/leads/$id"
          params={{ id: lead.id }}
          className="block text-sm font-semibold leading-tight line-clamp-2 hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.client_name}
        </Link>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">{lead.temperature}</Badge>
          {lead.priority && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{lead.priority}</Badge>
          )}
          {sig.waitingOn === 'me' && (
            <Badge className="text-[10px] py-0 px-1.5 h-4 bg-blue-100 text-blue-700 hover:bg-blue-100">Sua vez</Badge>
          )}
          {sig.waitingOn === 'other' && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground">Aguardando</Badge>
          )}
          {hasProposal && (
            <span title="Proposta Nomus vinculada" className="inline-flex items-center gap-0.5 text-emerald-700">
              <FileText className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* Próxima ação */}
        {sig.nextActionLabel && (
          <div className={`mt-1.5 flex items-start gap-1 text-[11px] rounded px-1.5 py-0.5 ${
            sig.isUrgent ? 'bg-amber-50 text-amber-800' : 'bg-muted/60 text-foreground/80'
          }`}>
            <ArrowUpRight className="w-3 h-3 mt-px shrink-0" />
            <span className="truncate">{sig.nextActionLabel}</span>
          </div>
        )}

        <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
          {phone && (
            <div className="truncate">📞 {phone}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {sig.daysSinceContact != null ? (
              <span className={`inline-flex items-center gap-1 ${sig.isStale ? 'text-red-600 font-medium' : ''}`}>
                {sig.isStale && <AlertCircle className="w-3 h-3" />}
                <Clock className="w-3 h-3" />
                {sig.daysSinceContact === 0 ? 'hoje' : `${sig.daysSinceContact}d s/ contato`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertCircle className="w-3 h-3" /> nunca contatado
              </span>
            )}
            {remaining != null && (
              <span className="inline-flex items-center gap-1">· {remaining}d lock</span>
            )}
            {lead.meeting_date && (
              <span className="inline-flex items-center gap-1">
                · <Calendar className="w-3 h-3" />
                {new Date(lead.meeting_date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between gap-1 px-2 pb-2 pt-1 border-t mt-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] text-green-700 hover:bg-green-50"
          onClick={(e) => { e.stopPropagation(); actions.onOpenScript(lead) }}
        >
          <Phone className="w-3 h-3 mr-1" /> Ligar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => actions.onEdit(lead)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar lead
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => actions.onTransferSeller(lead)}>
              <UserCheck className="w-3.5 h-3.5 mr-2" /> Transferir p/ Vendedor
            </DropdownMenuItem>
            {actions.canTransferSdr && (
              <DropdownMenuItem onClick={() => actions.onTransferSdr(lead)}>
                <ArrowRightLeft className="w-3.5 h-3.5 mr-2" /> Transferir p/ outro SDR
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onUnlock(lead)} className="text-destructive">
              <UnlockIcon className="w-3.5 h-3.5 mr-2" /> Devolver ao banco
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
