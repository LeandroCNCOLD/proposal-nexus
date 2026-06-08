import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchOverdueFollowups } from '@/modules/sdr/followups'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/app/gestao/alertas-sdr')({
  component: AlertasSdrPage,
})

function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}min`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

function AlertasSdrPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sdr-followups', 'overdue'],
    queryFn: () => fetchOverdueFollowups(30),
    refetchInterval: 60_000,
  })

  const rows = data ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> Alertas de Tentativas SDR
          </h1>
          <p className="text-sm text-muted-foreground">
            Tentativas agendadas e <strong>não cumpridas há mais de 30 min</strong>. O SDR responsável é notificado, e o gestor vê esta fila quando o lembrete é ignorado.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-emerald-700">
            ✅ Nenhuma tentativa vencida. Equipe está em dia.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Lead</th>
                <th className="px-3 py-2 text-left">SDR</th>
                <th className="px-3 py-2 text-left">Agendado para</th>
                <th className="px-3 py-2 text-left">Atraso</th>
                <th className="px-3 py-2 text-left">Plano</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const overdueMin = Math.floor((Date.now() - new Date(r.scheduled_at).getTime()) / 60_000)
                const severity = overdueMin > 1440 ? 'bg-red-100 text-red-800'
                  : overdueMin > 240 ? 'bg-orange-100 text-orange-800'
                  : 'bg-amber-100 text-amber-800'
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.lead?.client_name ?? '—'}</div>
                      <div className="text-xs font-mono text-muted-foreground">{r.lead?.lead_code}</div>
                    </td>
                    <td className="px-3 py-2">{r.sdr_name ?? r.lead?.sdr_name ?? '—'}</td>
                    <td className="px-3 py-2">{new Date(r.scheduled_at).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2">
                      <Badge className={severity}>{fmtMinutes(overdueMin)}</Badge>
                    </td>
                    <td className="px-3 py-2 max-w-[280px] truncate text-xs text-muted-foreground">
                      {r.note ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.lead?.id && (
                        <Button asChild variant="outline" size="sm">
                          <Link to="/app/sdr/leads/$id" params={{ id: r.lead.id }}>Abrir lead</Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
