import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchHotDeals } from '@/modules/crm/services'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Temperature } from '@/modules/crm/types'

export const Route = createFileRoute('/app/hot-deals')({
  component: HotDealsPage,
})

const TEMP_COLOR: Record<Temperature, string> = {
  Frio: 'bg-blue-100 text-blue-800',
  Morno: 'bg-yellow-100 text-yellow-800',
  Quente: 'bg-orange-100 text-orange-800',
  'Muito Quente': 'bg-red-100 text-red-800',
}

function HotDealsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['crm', 'hot-deals'], queryFn: () => fetchHotDeals(30) })
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-red-800">Hot Deals</h1>
        <p className="text-sm text-muted-foreground">Prioridade Alta · {data.length} propostas</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((deal, i) => (
          <div key={deal.id} className={`rounded-xl border p-4 space-y-3 ${i < 5 ? 'border-red-300 bg-red-50' : i < 10 ? 'border-orange-200 bg-orange-50' : 'bg-white'}`}>
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-muted-foreground">{deal.proposal_number}</p>
                <p className="font-semibold text-sm">{deal.client_name}</p>
              </div>
              <Badge className={`text-xs shrink-0 ${TEMP_COLOR[deal.temperature]}`}>{deal.temperature}</Badge>
            </div>
            <p className="text-xl font-bold text-[#0F2D5E]">{formatCurrency(deal.value)}</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Closer: <strong>{deal.closer_name ?? '—'}</strong></span>
              <span className={(deal.days_without_contact ?? 0) > 10 ? 'text-red-600 font-semibold' : ''}>
                {deal.days_without_contact ?? 0}d sem contato
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
