import { supabase } from '@/integrations/supabase/client'
import type { CrmScript, CrmScriptBlock, CrmScriptObjection, CrmScriptFull, SdrStatus } from './types'

export async function fetchScripts(etapa?: SdrStatus) {
  let q = supabase
    .from('crm_scripts')
    .select('*')
    .order('created_at', { ascending: false })

  if (etapa) q = q.eq('etapa', etapa)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as CrmScript[]
}

export async function fetchScriptFull(id: string) {
  const [script, blocks, objections] = await Promise.all([
    supabase.from('crm_scripts').select('*').eq('id', id).single(),
    supabase.from('crm_script_blocks').select('*').eq('script_id', id).order('order_index', { ascending: true }),
    supabase.from('crm_script_objections').select('*').eq('script_id', id),
  ])

  if (script.error) throw script.error
  if (blocks.error) throw blocks.error
  if (objections.error) throw objections.error

  return {
    ...(script.data as CrmScript),
    blocks: (blocks.data ?? []) as CrmScriptBlock[],
    objections: (objections.data ?? []) as CrmScriptObjection[],
  } as CrmScriptFull
}

export async function saveScript(
  script: Partial<CrmScript> & { id?: string },
  blocks: Omit<CrmScriptBlock, 'id' | 'script_id'>[],
  objections: Omit<CrmScriptObjection, 'id' | 'script_id'>[],
) {
  const { data: savedScript, error: scriptError } = await supabase
    .from('crm_scripts')
    .upsert({ ...script, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single()
  if (scriptError) throw scriptError

  const scriptId = (savedScript as CrmScript).id

  await supabase.from('crm_script_blocks').delete().eq('script_id', scriptId)
  await supabase.from('crm_script_objections').delete().eq('script_id', scriptId)

  const [blocksRes, objectionsRes] = await Promise.all([
    blocks.length
      ? supabase.from('crm_script_blocks').insert(blocks.map(b => ({ ...b, script_id: scriptId }))).select()
      : Promise.resolve({ data: [], error: null }),
    objections.length
      ? supabase.from('crm_script_objections').insert(objections.map(o => ({ ...o, script_id: scriptId }))).select()
      : Promise.resolve({ data: [], error: null }),
  ])
  if (blocksRes.error) throw blocksRes.error
  if (objectionsRes.error) throw objectionsRes.error

  return {
    ...(savedScript as CrmScript),
    blocks: (blocksRes.data ?? []) as CrmScriptBlock[],
    objections: (objectionsRes.data ?? []) as CrmScriptObjection[],
  } as CrmScriptFull
}

export async function duplicateScript(id: string) {
  const original = await fetchScriptFull(id)
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...scriptCopy } = original
  return saveScript(
    { ...scriptCopy, title: `${original.title} (cópia)` },
    original.blocks.map(({ order_index, title, content }) => ({ order_index, title, content })),
    original.objections.map(({ objection, response }) => ({ objection, response })),
  )
}

export async function deleteScript(id: string) {
  const { error } = await supabase.from('crm_scripts').delete().eq('id', id)
  if (error) throw error
}

export async function fetchScriptSuggestion(sdrStatus: SdrStatus) {
  const { data, error } = await supabase
    .from('crm_scripts')
    .select('*')
    .eq('etapa', sdrStatus)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as CrmScript | null
}
