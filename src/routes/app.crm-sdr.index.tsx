import { createFileRoute } from '@tanstack/react-router'
import { PipelineMasterTable } from '@/modules/crm/components/PipelineMasterTable'
import { seedPipelineData } from '@/modules/crm/scripts/seed-pipeline'

export const Route = createFileRoute('/app/crm-sdr/')({
  component: CrmPipelinePage,
})

function CrmPipelinePage() {
  const handleSeed = async () => {
    const n = await seedPipelineData()
    alert(`✅ ${n} propostas inseridas!`)
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0F2D5E]">Pipeline Master</h1>
        <p className="text-sm text-muted-foreground">SDR + Closer Command Center · Junho 2026</p>
      </div>
      {import.meta.env.DEV && (
        <button
          onClick={handleSeed}
          className="mb-4 px-4 py-2 bg-orange-500 text-white rounded text-sm font-bold"
        >
          🌱 Popular banco com propostas ativas
        </button>
      )}
      <PipelineMasterTable />
    </div>
  )
}

