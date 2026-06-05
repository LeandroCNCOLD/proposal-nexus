import { useQuery } from '@tanstack/react-query'
import { fetchSdrMetrics } from '../services'

export function useSdrMetrics(start?: string, end?: string) {
  const today = new Date()
  const s = start ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const e = end ?? today.toISOString().slice(0, 10)

  return useQuery({
    queryKey: ['crm', 'sdr-metrics', s, e],
    queryFn: () => fetchSdrMetrics(s, e),
    staleTime: 60_000,
  })
}
