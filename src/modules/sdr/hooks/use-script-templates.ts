import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface ObjectionItem { obj: string; resp: string }

export interface ScriptTemplate {
  id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  opening: string
  discovery_questions: string[]
  objections: ObjectionItem[]
  closing: string
  whatsapp_followup: string
  created_at: string
  updated_at: string
}

export type ScriptTemplateInput = Omit<ScriptTemplate, 'id' | 'created_at' | 'updated_at'>

const TABLE = 'crm_call_script_templates' as any

export function useScriptTemplates() {
  return useQuery({
    queryKey: ['script-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase.from(TABLE) as any)
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ScriptTemplate[]
    },
  })
}

export function useScriptTemplateMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['script-templates'] })

  const create = useMutation({
    mutationFn: async (input: ScriptTemplateInput) => {
      const { data, error } = await (supabase.from(TABLE) as any).insert(input).select().single()
      if (error) throw error
      return data as ScriptTemplate
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<ScriptTemplateInput>) => {
      const { data, error } = await (supabase.from(TABLE) as any).update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as ScriptTemplate
    },
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from(TABLE) as any).delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, remove }
}

/** Substitui placeholders {chave} no texto. */
export function renderTemplate(text: string, ctx: Record<string, string>): string {
  return (text || '').replace(/\{(\w+)\}/g, (_m, k) => (ctx[k] ?? `{${k}}`))
}
