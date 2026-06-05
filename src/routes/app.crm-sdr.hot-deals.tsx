import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchHotDeals } from '@/modules/crm/services'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { Temperature } from '@/modules/crm/types'

export const Route = createFileRoute('/app/crm-sdr/hot-deals')({
  component: HotDealsPage,
})

const TEMP_COLOR: Record<Temperature, string> = {
  Frio: 'bg-blue-100 text-blue-800',
  Morno: 'bg-yellow-100 text-yellow-800',
  Quente: 'bg-orange-100 text-orange-800',
  'Muito Quente': 'bg-red-100 text-red-800',
}

function HotDealsPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['crm', 'hot-deals'],
    queryFn: () => fetchHotDeals(30),
  })

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Hot Deals</h1>
        <p className="text-sm text-muted-foreground">Top 30 oportunidades de alta prioridade</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((d) => (
            <div key={d.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">{d.proposal_number}</div>
                  <div className="font-semibold">{d.client_name}</div>
                </div>
                <Badge className={TEMP_COLOR[d.temperature]}>{d.temperature}</Badge>
              </div>
              <div className="text-sm">{formatCurrency(d.value)}</div>
              <div className="text-xs text-muted-foreground">
                {d.sdr_name ?? '—'} / {d.closer_name ?? '—'}
              </div>
            </div>
          ))}
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum hot deal encontrado.</p>
          )}
        </div>
      )}
    </div>
  )
}
