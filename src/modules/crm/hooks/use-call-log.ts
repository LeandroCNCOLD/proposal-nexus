import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCallLogs, insertCallLog } from '../services'
import type { CrmCallLog } from '../types'

export function useCallLog(opts?: { pipelineId?: string; date?: string }) {
  const qc = useQueryClient()
  const key = ['crm', 'call-logs', opts] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchCallLogs(opts),
    staleTime: 15_000,
  })

  const insert = useMutation({
    mutationFn: (log: Omit<CrmCallLog, 'id' | 'created_at'>) => insertCallLog(log),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'call-logs'] })
      qc.invalidateQueries({ queryKey: ['crm', 'pipeline'] })
      qc.invalidateQueries({ queryKey: ['crm', 'dashboard'] })
    },
  })

  return { ...query, insert }
}
