import { supabase } from '@/integrations/supabase/client'
import type { CrmPipeline } from '@/modules/crm/types'

export type SeedRow = Pick<CrmPipeline,
  | 'proposal_number'
  | 'client_name'
  | 'city'
  | 'state'
  | 'value'
  | 'sdr_name'
  | 'closer_name'
  | 'sdr_status'
  | 'temperature'
  | 'priority'
  | 'last_contact_at'
>

/**
 * Faz upsert em lotes de 50 na tabela crm_pipeline, usando
 * proposal_number como chave de conflito (não duplica).
 *
 * Uso (uma vez, no console do browser ou via botão temporário):
 *   import { seedPipeline } from '@/modules/crm/scripts/seed-pipeline'
 *   await seedPipeline([...rows])
 */
export async function seedPipeline(rows: SeedRow[]): Promise<number> {
  const BATCH = 50
  let inserted = 0

  console.log(`🚀 Iniciando seed de ${rows.length} linhas em lotes de ${BATCH}...`)

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('crm_pipeline')
      .upsert(batch as never, { onConflict: 'proposal_number' })

    if (error) {
      console.error(`❌ Erro no lote iniciando em ${i}:`, error.message)
      continue
    }

    inserted += batch.length
    console.log(`✅ ${inserted}/${rows.length} inseridos`)
  }

  console.log(`🏁 Seed concluído: ${inserted}/${rows.length} linhas processadas`)
  return inserted
}
