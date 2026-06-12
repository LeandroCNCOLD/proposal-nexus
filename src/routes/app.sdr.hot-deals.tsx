import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { fetchHotDeals } from '@/modules/sdr/services'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { CallScriptDialog } from '@/modules/sdr/components/CallScriptDialog'
import { Phone } from 'lucide-react'
import type { Temperature, CrmPipeline } from '@/modules/sdr/types'

export const Route = createFileRoute('/app/sdr/hot-deals')({
  component: HotDealsPage,
})

const TEMP_COLOR: Record<Temperature, string> = {
  Frio: 'bg-blue-100 text-blue-700',
  Morno: 'bg-yellow-100 text-yellow-800',
  Quente: 'bg-orange-100 text-orange-700',
  'Muito Quente': 'bg-red-100 text-red-700',
}

function urgencyBadge(days: number) {
  if (days > 180) return { label: 'CRÍTICO', cls: 'bg-red-600 text-white' }
  if (days >= 61) return { label: 'URGENTE', cls: 'bg-orange-500 text-white' }
  return null
}

function HotDealsPage() {
  const { user, hasAnyRole } = useAuth()
  const isManager = hasAnyRole(['gerente_comercial', 'diretoria', 'admin'])
  const [scriptLead, setScriptLead] = useState<CrmPipeline | null>(null)

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['crm', 'hot-deals', 'page', isManager ? 'all' : user?.id],
    queryFn: () => fetchHotDeals(60, isManager ? null : user?.id ?? null),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const sa = (a.value ?? 0) * (1 + (a.days_without_contact ?? 0) / 100)
      const sb = (b.value ?? 0) * (1 + (b.days_without_contact ?? 0) / 100)
      return sb - sa
    })
  }, [data])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-red-800">Hot Leads</h1>
        <p className="text-sm text-muted-foreground">
          {isManager
            ? `Todos os leads de alta prioridade · ${sorted.length} propostas`
            : `Seus leads de alta prioridade · ${sorted.length} propostas · clique para ligar`}
        </p>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 text-red-800 text-sm">
            Erro ao carregar Hot Leads. Verifique sua conexão e tente novamente.
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      )}

      {!isLoading && !error && sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {isManager
            ? 'Nenhum hot lead no momento.'
            : 'Você ainda não tem hot leads na sua carteira. Vá ao Banco de Leads para pegar leads de alta prioridade.'}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((deal: CrmPipeline) => {
          const days = deal.days_without_contact ?? 0
          const urg = urgencyBadge(days)
          return (
            <button
              type="button"
              key={deal.id}
              onClick={() => setScriptLead(deal)}
              className="relative text-left rounded-xl border bg-white p-4 space-y-3 shadow-sm transition hover:shadow-md hover:border-red-300 cursor-pointer"
            >
              {urg && (
                <Badge className={`absolute top-3 right-3 text-[10px] ${urg.cls}`}>
                  {urg.label}
                </Badge>
              )}
              <div>
                <p className="text-xs font-mono text-muted-foreground">{deal.lead_code}</p>
                <p className="font-semibold text-sm mt-0.5 pr-16">{deal.client_name}</p>
              </div>
              <p className="text-2xl font-bold text-[#0F2D5E]">{formatCurrency(deal.value)}</p>
              <Badge className={`text-xs ${TEMP_COLOR[deal.temperature]}`}>{deal.temperature}</Badge>
              <div className="flex justify-between text-xs pt-1 border-t">
                <span className="text-muted-foreground">
                  Closer: <strong className="text-foreground">{deal.closer_name ?? '—'}</strong>
                </span>
                <span className={days > 30 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}>
                  {days} dias sem contato
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-700 font-semibold pt-1">
                <Phone className="w-3 h-3" /> Clique para abrir
              </div>
            </button>
          )
        })}
      </div>

      <CallScriptDialog
        lead={scriptLead}
        open={!!scriptLead}
        onOpenChange={(o) => !o && setScriptLead(null)}
      />
    </div>
  )
}
