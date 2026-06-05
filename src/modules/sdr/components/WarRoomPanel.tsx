import { useWarRoom } from '../hooks/use-war-room'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, Phone, Flame, AlertTriangle, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function WarRoomPanel() {
  const { kpis, hotDeals, todayCalls, refresh } = useWarRoom()
  const d = kpis.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0F2D5E]">War Room</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
            {' · War Room diário 17h'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <TrendingUp className="h-5 w-5 text-blue-600"/>, label:'Pipeline Ativo', value: d?.totalActive ?? '—', sub: formatCurrency(d?.totalValue ?? 0) },
          { icon: <Flame className="h-5 w-5 text-orange-500"/>, label:'Quentes', value: d?.hotDeals ?? '—', sub: 'precisam ação hoje' },
          { icon: <AlertTriangle className="h-5 w-5 text-red-500"/>, label:'Sem contato >10d', value: d?.overdue10Days ?? '—', sub: 'prioridade alta' },
          { icon: <Phone className="h-5 w-5 text-green-600"/>, label:'Ligações Hoje', value: d?.callsToday ?? '—', sub: 'registradas' },
        ].map((k, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                  <p className="text-2xl font-bold mt-1">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
                </div>
                {k.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-red-800">Hot Deals — Ação Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hotDeals.data?.map((deal, i) => (
              <div key={deal.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className={`text-xs font-bold w-5 ${i < 3 ? 'text-red-600' : 'text-muted-foreground'}`}>{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{deal.client_name}</p>
                  <p className="text-xs text-muted-foreground">{deal.closer_name} · {deal.days_without_contact ?? 0}d sem contato</p>
                </div>
                <span className="text-sm font-bold shrink-0">{formatCurrency(deal.value)}</span>
              </div>
            ))}
            {!hotDeals.data?.length && <p className="text-xs text-muted-foreground">Nenhum hot deal.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Ligações de Hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {todayCalls.data?.map(call => (
              <div key={call.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="text-xs font-semibold text-[#0F2D5E] w-12 shrink-0">{call.call_time?.slice(0,5) ?? '—'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{call.sdr_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{call.result ?? '—'}</p>
                </div>
                {call.meeting_booked && <Badge className="text-xs bg-green-100 text-green-800 shrink-0">Reunião</Badge>}
              </div>
            ))}
            {!todayCalls.data?.length && <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma ligação hoje ainda.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
