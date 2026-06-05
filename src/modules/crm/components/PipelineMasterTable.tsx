import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Phone, ChevronUp, ChevronDown } from 'lucide-react'
import { useCrmPipeline } from '../hooks/use-crm-pipeline'
import { PipelineFiltersBar } from './PipelineFiltersBar'
import { CallLogDrawer } from './CallLogDrawer'
import { SDR_STATUS_OPTIONS, TEMPERATURE_OPTIONS, PRIORITY_OPTIONS } from '../types'
import type { CrmPipeline, Temperature, Priority, SdrStatus } from '../types'
import { formatCurrency } from '@/lib/utils'

const INACTIVE_STATUSES: SdrStatus[] = ['Perdido (com motivo)', 'Kill / Arquivar', 'Fechado']

const TEMP_COLOR: Record<Temperature, string> = {
  Frio: 'bg-blue-100 text-blue-800',
  Morno: 'bg-yellow-100 text-yellow-800',
  Quente: 'bg-orange-100 text-orange-800',
  'Muito Quente': 'bg-red-100 text-red-800',
}
const PRIO_COLOR: Record<Priority, string> = {
  Alta: 'bg-red-100 text-red-800',
  Média: 'bg-yellow-100 text-yellow-800',
  Baixa: 'bg-green-100 text-green-800',
}

function rowBg(row: CrmPipeline) {
  if (row.temperature === 'Quente' || row.temperature === 'Muito Quente') return 'bg-green-50'
  if ((row.days_without_contact ?? 0) > 10) return 'bg-yellow-50'
  if (row.priority === 'Alta') return 'bg-orange-50'
  return ''
}

function daysCls(d: number | null) {
  if (!d) return ''
  if (d > 30) return 'text-red-600 font-bold'
  if (d > 10) return 'text-yellow-600 font-bold'
  return ''
}

export function PipelineMasterTable() {
  const { data = [], isLoading, filters, applyFilter, resetFilters, updateField } = useCrmPipeline()
  const [drawer, setDrawer] = useState<CrmPipeline | null>(null)
  const [sortKey, setSortKey] = useState<'value' | 'days_without_contact'>('value')
  const [sortAsc, setSortAsc] = useState(false)
  const [onlyActive, setOnlyActive] = useState(true)

  const filtered = onlyActive ? data.filter(r => !INACTIVE_STATUSES.includes(r.sdr_status)) : data
  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortKey] ?? 0) as number
    const bv = (b[sortKey] ?? 0) as number
    return sortAsc ? av - bv : bv - av
  })

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortAsc(s => !s)
    else { setSortKey(k); setSortAsc(false) }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando pipeline...</div>

  return (
    <div className="space-y-4">
      <PipelineFiltersBar filters={filters} onChange={applyFilter} onReset={resetFilters} />
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
          <Label htmlFor="only-active" className="text-sm cursor-pointer">
            Apenas propostas ativas
          </Label>
        </div>
        <span className="text-xs text-muted-foreground">
          {sorted.length} de {data.length} propostas
        </span>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#0F2D5E] hover:bg-[#0F2D5E]">
              {['Proposta','Cliente','UF','Valor','Status SDR','SDR','Closer','Temp.','Prioridade','Dias s/Contato',''].map((h, i) => (
                <TableHead key={i} className="text-white text-xs font-bold whitespace-nowrap">
                  {h === 'Valor' ? (
                    <button className="text-white flex items-center gap-1" onClick={() => toggleSort('value')}>
                      Valor {sortKey==='value' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                    </button>
                  ) : h === 'Dias s/Contato' ? (
                    <button className="text-white flex items-center gap-1" onClick={() => toggleSort('days_without_contact')}>
                      Dias s/Contato {sortKey==='days_without_contact' && (sortAsc ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>)}
                    </button>
                  ) : h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map(row => (
              <TableRow key={row.id} className={`${rowBg(row)} transition-colors`}>
                <TableCell className="font-mono text-xs">{row.proposal_number}</TableCell>
                <TableCell className="max-w-[180px] truncate font-medium text-sm">{row.client_name}</TableCell>
                <TableCell className="text-xs text-center">{row.state}</TableCell>
                <TableCell className={`text-right text-sm ${row.value >= 2_000_000 ? 'font-bold' : ''}`}>
                  {formatCurrency(row.value)}
                </TableCell>
                <TableCell>
                  <Select value={row.sdr_status} onValueChange={v => updateField.mutate({ id: row.id, field: 'sdr_status', value: v })}>
                    <SelectTrigger className="h-7 text-xs w-52 border-0 bg-transparent p-0 focus:ring-0"><SelectValue /></SelectTrigger>
                    <SelectContent>{SDR_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">{row.sdr_name ?? '—'}</TableCell>
                <TableCell className="text-xs">{row.closer_name ?? '—'}</TableCell>
                <TableCell>
                  <Select value={row.temperature} onValueChange={v => updateField.mutate({ id: row.id, field: 'temperature', value: v })}>
                    <SelectTrigger className="h-7 w-32 border-0 bg-transparent p-0 focus:ring-0">
                      <Badge className={`text-xs ${TEMP_COLOR[row.temperature]}`}>{row.temperature}</Badge>
                    </SelectTrigger>
                    <SelectContent>{TEMPERATURE_OPTIONS.map(t => <SelectItem key={t} value={t} className="text-xs"><Badge className={`text-xs ${TEMP_COLOR[t]}`}>{t}</Badge></SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={row.priority} onValueChange={v => updateField.mutate({ id: row.id, field: 'priority', value: v })}>
                    <SelectTrigger className="h-7 w-24 border-0 bg-transparent p-0 focus:ring-0">
                      <Badge className={`text-xs ${PRIO_COLOR[row.priority]}`}>{row.priority}</Badge>
                    </SelectTrigger>
                    <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p} className="text-xs"><Badge className={`text-xs ${PRIO_COLOR[p]}`}>{p}</Badge></SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className={`text-center text-sm ${daysCls(row.days_without_contact)}`}>
                  {row.days_without_contact ?? '—'}
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDrawer(row)}>
                    <Phone className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma proposta encontrada.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {drawer && <CallLogDrawer pipeline={drawer} open={!!drawer} onClose={() => setDrawer(null)} />}
    </div>
  )
}
