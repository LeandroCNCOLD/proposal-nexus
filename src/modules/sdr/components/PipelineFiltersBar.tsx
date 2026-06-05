import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { SDR_STATUS_OPTIONS, TEMPERATURE_OPTIONS, PRIORITY_OPTIONS } from '../types'
import { useSdrNames, useCloserNames } from '../hooks/use-team-members'
import type { PipelineFilters } from '../types'

const ALL = '__all__'

interface Props {
  filters: Partial<PipelineFilters>
  onChange: (patch: Partial<PipelineFilters>) => void
  onReset: () => void
}

export function PipelineFiltersBar({ filters, onChange, onReset }: Props) {
  const { names: sdrNames } = useSdrNames()
  const { names: closerNames } = useCloserNames()
  return (
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <Input
        placeholder="Buscar cliente ou proposta..."
        className="w-56"
        value={filters.search ?? ''}
        onChange={e => onChange({ search: e.target.value })}
      />
      <Select value={filters.sdrName ?? ALL} onValueChange={v => onChange({ sdrName: v === ALL ? null : v })}>
        <SelectTrigger className="w-32"><SelectValue placeholder="SDR" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos SDRs</SelectItem>
          {sdrNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.closerName ?? ALL} onValueChange={v => onChange({ closerName: v === ALL ? null : v })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Closer" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos Closers</SelectItem>
          {closerNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.temperature ?? ALL} onValueChange={v => onChange({ temperature: (v === ALL ? null : v) as any })}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Temperatura" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {TEMPERATURE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filters.priority ?? ALL} onValueChange={v => onChange({ priority: (v === ALL ? null : v) as any })}>
        <SelectTrigger className="w-32"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas</SelectItem>
          {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" onClick={onReset}><X className="h-4 w-4" /></Button>
    </div>
  )
}
