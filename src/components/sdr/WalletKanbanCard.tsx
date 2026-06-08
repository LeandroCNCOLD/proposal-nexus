import { useDraggable } from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { Phone, Clock, MoreVertical, Pencil, ArrowRightLeft, UserCheck, Unlock as UnlockIcon, FileText } from 'lucide-react'
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

export function WalletKanbanCard({
  lead,
  actions,
  hasProposal,
}: {
  lead: CrmPipeline
  actions: KanbanCardActions
  hasProposal?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  const remaining = daysUntil(lead.lock_expires_at)
  const tempBorder = TEMP_COLOR[lead.temperature] ?? 'border-l-muted'
  const phone = lead.contact_mobile || lead.contact_phone

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-md border border-l-4 ${tempBorder} bg-card shadow-sm hover:shadow-md transition ${
        isDragging ? 'opacity-50 ring-2 ring-primary' : ''
      }`}
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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">{lead.temperature}</Badge>
          {lead.priority && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{lead.priority}</Badge>
          )}
          {hasProposal && (
            <span title="Proposta Nomus vinculada" className="inline-flex items-center gap-0.5 text-emerald-700">
              <FileText className="w-3 h-3" />
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
          {phone && (
            <div className="truncate">📞 {phone}{lead.contact_name ? ` · ${lead.contact_name}` : ''}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {remaining != null ? `${remaining}d lock` : '—'}
            </span>
            {lead.next_contact_at && (
              <span>· próx: {new Date(lead.next_contact_at).toLocaleDateString('pt-BR')}</span>
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
