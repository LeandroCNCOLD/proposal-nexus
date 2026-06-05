import { supabase } from '@/integrations/supabase/client'

export async function seedPipelineData() {
  const BATCH_SIZE = 50
  let total = 0

  for (let i = 0; i < PIPELINE_DATA.length; i += BATCH_SIZE) {
    const batch = PIPELINE_DATA.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('crm_pipeline')
      .upsert(batch, { onConflict: 'proposal_number' })
    if (error) {
      console.error(`Erro no lote ${i}:`, error.message)
      continue
    }
    total += batch.length
    console.log(`✅ ${total}/${PIPELINE_DATA.length} inseridos`)
  }

  console.log(`🏁 Seed concluído: ${total} registros`)
  return total
}

// TODO: cole aqui o array de propostas ativas
const PIPELINE_DATA: any[] = []
