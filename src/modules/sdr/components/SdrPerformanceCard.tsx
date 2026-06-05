import { useSdrMetrics } from '../hooks/use-sdr-metrics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const EMOJIS = ['🥇','🥈','🥉','#4']

export function SdrPerformanceCard() {
  const { data = [], isLoading } = useSdrMetrics()
  const sorted = [...data].sort((a, b) => b.meetingsBooked - a.meetingsBooked)

  return (
    <div className="space-y-4">
      {isLoading && <p className="text-sm text-muted-foreground">Calculando métricas...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((sdr, i) => (
          <Card key={sdr.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span>{EMOJIS[i] ?? `#${i+1}`}</span> {sdr.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label:'Ligações', value: sdr.totalCalls },
                  { label:'Atendidas', value: sdr.realAnswers },
                  { label:'Reuniões', value: sdr.meetingsBooked },
                  { label:'Quentes', value: sdr.hotDeals },
                ].map(s => (
                  <div key={s.label} className="bg-muted/40 rounded p-2 text-center">
                    <p className="text-lg font-bold">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Taxa atendimento</span><span className="font-semibold">{sdr.answerRate}%</span>
                </div>
                <Progress value={sdr.answerRate} className="h-1.5" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Lig → reunião</span><span className="font-semibold">{sdr.conversionRate}%</span>
                </div>
                <Progress value={sdr.conversionRate} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
        {!sorted.length && !isLoading && (
          <p className="col-span-2 text-sm text-muted-foreground text-center py-8">Nenhuma ligação registrada ainda.</p>
        )}
      </div>
    </div>
  )
}
