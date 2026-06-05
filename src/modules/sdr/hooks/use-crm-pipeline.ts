import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { fetchPipeline, upsertPipelineRow, updatePipelineField } from '../services'
import type { CrmPipeline, PipelineFilters } from '../types'

export const PIPELINE_KEY = ['crm', 'pipeline'] as const

export function useCrmPipeline(initial: Partial<PipelineFilters> = {}) {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<Partial<PipelineFilters>>(initial)

  const query = useQuery({
    queryKey: [...PIPELINE_KEY, filters],
    queryFn: () => fetchPipeline(filters),
    staleTime: 30_000,
  })

  const upsert = useMutation({
    mutationFn: (row: Partial<CrmPipeline> & { id?: string }) => upsertPipelineRow(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: PIPELINE_KEY }),
  })

  const updateField = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: keyof CrmPipeline; value: unknown }) =>
      updatePipelineField(id, field, value),
    onMutate: async ({ id, field, value }) => {
      await qc.cancelQueries({ queryKey: PIPELINE_KEY })
      const prev = qc.getQueriesData({ queryKey: PIPELINE_KEY })
      qc.setQueriesData({ queryKey: PIPELINE_KEY }, (old: CrmPipeline[] | undefined) =>
        old?.map(r => r.id === id ? { ...r, [field]: value } : r)
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PIPELINE_KEY }),
  })

  const applyFilter = useCallback((patch: Partial<PipelineFilters>) => setFilters(f => ({ ...f, ...patch })), [])
  const resetFilters = useCallback(() => setFilters({}), [])

  return { ...query, filters, applyFilter, resetFilters, upsert, updateField }
}
