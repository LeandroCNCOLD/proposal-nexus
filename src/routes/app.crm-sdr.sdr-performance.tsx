import { createFileRoute } from '@tanstack/react-router'
import { SdrPerformanceCard } from '@/modules/crm/components/SdrPerformanceCard'

export const Route = createFileRoute('/app/crm-sdr/sdr-performance')({
  component: () => (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">SDR Performance</h1>
        <p className="text-sm text-muted-foreground">Métricas de ligações e conversão — mês atual</p>
      </div>
      <SdrPerformanceCard />
    </div>
  ),
})
