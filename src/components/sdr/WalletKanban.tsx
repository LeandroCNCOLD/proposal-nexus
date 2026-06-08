import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updatePipelineField, unlockLead } from '@/modules/sdr/services'
import type { CrmPipeline, SdrStatus, Temperature } from '@/modules/sdr/types'
import { useProposalLeadMatches } from '@/hooks/use-proposal-lead-matches'
import { WalletKanbanCard, type KanbanCardActions } from './WalletKanbanCard'
import { MeetingScheduleQuickDialog } from './MeetingScheduleQuickDialog'
import { CloseLeadDialog } from './CloseLeadDialog'
import { TransferToSellerDialog } from './TransferToSellerDialog'
import { LeadEditDialog } from './LeadEditDialog'
import { TransferLeadDialog } from '@/components/manager/TransferLeadDialog'

type ColumnKey = 'nao_contatado' | 'contatado' | 'reuniao' | 'vendedor' | 'encerrados'

type Column = {
  key: ColumnKey
  title: string
  hint?: string
  collapsedByDefault?: boolean
  match: (lead: LeadWithExtras) => boolean
}

type LeadWithExtras = CrmPipeline & { handoff_status?: string | null }

const COLUMNS: Column[] = [
  { key: 'nao_contatado', title: 'Não Contatado',
    match: (l) => l.sdr_status === 'Não Contatado' && (l.handoff_status ?? null) !== 'transferred' },
  { key: 'contatado', title: 'Contatado – Aguardando Retorno',
    match: (l) => l.sdr_status === 'Contatado - Aguardando Retorno' && !l.meeting_scheduled && (l.handoff_status ?? null) !== 'transferred' },
  { key: 'reuniao', title: 'Reunião Agendada',
    match: (l) => (l.sdr_status === 'Reunião Agendada' || l.meeting_scheduled) && (l.handoff_status ?? null) !== 'transferred' },
  { key: 'vendedor', title: 'Em Negociação (Vendedor)',
    hint: 'Lead já transferido para o closer',
    match: (l) => (l.handoff_status ?? null) === 'transferred' || l.sdr_status === 'Em Negociação com Closer' || l.sdr_status === 'Reunião Realizada' || l.sdr_status === 'Proposta em Revisão' || l.sdr_status === 'Quente - Alta Chance de Fechamento' },
  { key: 'encerrados', title: 'Encerrados', collapsedByDefault: true,
    match: (l) => l.sdr_status === 'Fechado' || l.sdr_status === 'Perdido (com motivo)' || l.sdr_status === 'Kill / Arquivar' },
]

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function Column({
  col,
  leads,
  collapsed,
  toggleCollapsed,
  renderCard,
}: {
  col: Column
  leads: LeadWithExtras[]
  collapsed: boolean
  toggleCollapsed: () => void
  renderCard: (lead: LeadWithExtras) => React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })
  const total = leads.reduce((s, l) => s + (l.value || 0), 0)

  return (
    <div className="flex flex-col min-w-[280px] w-[280px] bg-muted/40 rounded-lg border">
      <div className="px-3 py-2 border-b bg-background/60 rounded-t-lg">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={toggleCollapsed}
            className="flex items-center gap-1 text-sm font-semibold text-[#0F2D5E] hover:text-primary"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {col.title}
          </button>
          <span className="text-xs text-muted-foreground tabular-nums">{leads.length}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {fmtBRL(total)}{col.hint ? ` · ${col.hint}` : ''}
        </div>
      </div>
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors ${
            isOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''
          }`}
        >
          {leads.length === 0 ? (
            <div className="text-[11px] text-muted-foreground text-center py-6 italic">
              Arraste leads aqui
            </div>
          ) : (
            leads.map(renderCard)
          )}
        </div>
      )}
    </div>
  )
}

export function WalletKanban({
  leads,
  canTransferSdr,
}: {
  leads: CrmPipeline[]
  canTransferSdr: boolean
}) {
  const qc = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Dialogs / scripts já existentes na página: subimos via callbacks?
  // Para manter este componente autônomo, gerimos aqui.
  const [scriptLead, setScriptLead] = useState<CrmPipeline | null>(null)
  const [editLead, setEditLead] = useState<CrmPipeline | null>(null)
  const [transferSdrLead, setTransferSdrLead] = useState<CrmPipeline | null>(null)
  const [transferSellerLead, setTransferSellerLead] = useState<CrmPipeline | null>(null)
  const [meetingLead, setMeetingLead] = useState<CrmPipeline | null>(null)
  const [closeLead, setCloseLead] = useState<CrmPipeline | null>(null)

  const [search, setSearch] = useState('')
  const [tempFilter, setTempFilter] = useState<'all' | Temperature>('all')
  const [collapsed, setCollapsed] = useState<Record<ColumnKey, boolean>>(() => {
    const init = {} as Record<ColumnKey, boolean>
    COLUMNS.forEach(c => { init[c.key] = !!c.collapsedByDefault })
    return init
  })

  const leadIds = useMemo(() => leads.map(l => l.id), [leads])
  const { byLead: proposalMatches } = useProposalLeadMatches({ leadIds })

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return (leads as LeadWithExtras[]).filter(l => {
      if (tempFilter !== 'all' && l.temperature !== tempFilter) return false
      if (!s) return true
      return (
        l.client_name?.toLowerCase().includes(s) ||
        l.lead_code?.toLowerCase().includes(s) ||
        l.cnpj?.toLowerCase().includes(s) ||
        l.razao_social?.toLowerCase().includes(s)
      )
    })
  }, [leads, search, tempFilter])

  const byColumn = useMemo(() => {
    const map = new Map<ColumnKey, LeadWithExtras[]>()
    COLUMNS.forEach(c => map.set(c.key, []))
    filtered.forEach(lead => {
      const col = COLUMNS.find(c => c.match(lead))
      if (col) map.get(col.key)!.push(lead)
    })
    return map
  }, [filtered])

  const moveMut = useMutation({
    mutationFn: async ({ leadId, target }: { leadId: string; target: ColumnKey }) => {
      if (target === 'nao_contatado') {
        await updatePipelineField(leadId, 'sdr_status', 'Não Contatado' as SdrStatus)
        await updatePipelineField(leadId, 'meeting_scheduled', false)
      } else if (target === 'contatado') {
        await updatePipelineField(leadId, 'sdr_status', 'Contatado - Aguardando Retorno' as SdrStatus)
        await updatePipelineField(leadId, 'meeting_scheduled', false)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      toast.success('Lead atualizado.')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const unlockMut = useMutation({
    mutationFn: (id: string) => unlockLead(id),
    onSuccess: () => {
      toast.success('Lead devolvido ao banco.')
      qc.invalidateQueries({ queryKey: ['my-wallet'] })
      qc.invalidateQueries({ queryKey: ['my-lock-count'] })
    },
  })

  const onDragEnd = (e: DragEndEvent) => {
    const target = e.over?.id as ColumnKey | undefined
    const leadId = String(e.active.id)
    if (!target) return
    const lead = leads.find(l => l.id === leadId) as LeadWithExtras | undefined
    if (!lead) return
    const currentCol = COLUMNS.find(c => c.match(lead))
    if (currentCol?.key === target) return

    if (target === 'reuniao') {
      setMeetingLead(lead)
      return
    }
    if (target === 'vendedor') {
      setTransferSellerLead(lead)
      return
    }
    if (target === 'encerrados') {
      setCloseLead(lead)
      return
    }
    moveMut.mutate({ leadId, target })
  }

  const actions: KanbanCardActions = {
    onOpenScript: setScriptLead,
    onEdit: setEditLead,
    onTransferSdr: setTransferSdrLead,
    onTransferSeller: setTransferSellerLead,
    onUnlock: (l) => {
      if (confirm(`Devolver "${l.client_name}" ao banco?`)) unlockMut.mutate(l.id)
    },
    canTransferSdr,
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, código ou CNPJ…"
          className="max-w-xs h-8"
        />
        <Select value={tempFilter} onValueChange={(v) => setTempFilter(v as 'all' | Temperature)}>
          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas temperaturas</SelectItem>
            <SelectItem value="Frio">Frio</SelectItem>
            <SelectItem value="Morno">Morno</SelectItem>
            <SelectItem value="Quente">Quente</SelectItem>
            <SelectItem value="Muito Quente">Muito Quente</SelectItem>
          </SelectContent>
        </Select>
        {(search || tempFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTempFilter('all') }}>
            Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Arraste o card para mudar de etapa
        </span>
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <Column
              key={col.key}
              col={col}
              leads={byColumn.get(col.key) ?? []}
              collapsed={collapsed[col.key]}
              toggleCollapsed={() => setCollapsed(s => ({ ...s, [col.key]: !s[col.key] }))}
              renderCard={(lead) => (
                <WalletKanbanCard
                  key={lead.id}
                  lead={lead}
                  actions={actions}
                  hasProposal={!!proposalMatches.get(lead.id)}
                />
              )}
            />
          ))}
        </div>
      </DndContext>

      {/* Diálogos */}
      {scriptLead && (
        <ScriptDialogMount lead={scriptLead} onClose={() => setScriptLead(null)} />
      )}
      <LeadEditDialog
        lead={editLead}
        leadId={editLead?.id ?? ''}
        open={!!editLead}
        onOpenChange={(o) => !o && setEditLead(null)}
      />
      {transferSdrLead && (
        <TransferLeadDialog
          open={!!transferSdrLead}
          onOpenChange={(o) => !o && setTransferSdrLead(null)}
          leadId={transferSdrLead.id}
        />
      )}
      {transferSellerLead && (
        <TransferToSellerDialog
          open={!!transferSellerLead}
          onOpenChange={(o) => !o && setTransferSellerLead(null)}
          leadId={transferSellerLead.id}
          leadLabel={transferSellerLead.client_name}
        />
      )}
      <MeetingScheduleQuickDialog
        lead={meetingLead}
        open={!!meetingLead}
        onOpenChange={(o) => !o && setMeetingLead(null)}
      />
      <CloseLeadDialog
        lead={closeLead}
        open={!!closeLead}
        onOpenChange={(o) => !o && setCloseLead(null)}
      />
    </div>
  )
}

// Pequeno wrapper para reusar o CallScriptDialog sem recriar imports no topo
import { CallScriptDialog } from '@/modules/sdr/components/CallScriptDialog'
function ScriptDialogMount({ lead, onClose }: { lead: CrmPipeline; onClose: () => void }) {
  return (
    <CallScriptDialog lead={lead} open={true} onOpenChange={(o) => !o && onClose()} />
  )
}
