import { createFileRoute } from '@tanstack/react-router'
import { PipelineMasterTable } from '@/modules/crm/components/PipelineMasterTable'

export const Route = createFileRoute('/app/crm-sdr/')({
  component: CrmPipelinePage,
})

function CrmPipelinePage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Pipeline Master</h1>
        <p className="text-sm text-muted-foreground">SDR + Closer Command Center · Junho 2026</p>
      </div>
      <PipelineMasterTable />
    </div>
  )
}
