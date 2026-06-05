import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { fetchDashboardKpis, fetchHotDeals, fetchCallLogs } from '../services'

export function useWarRoom() {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const kpis = useQuery({
    queryKey: ['crm', 'dashboard'],
    queryFn: fetchDashboardKpis,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const hotDeals = useQuery({
    queryKey: ['crm', 'hot-deals'],
    queryFn: () => fetchHotDeals(10),
    staleTime: 30_000,
  })

  const todayCalls = useQuery({
    queryKey: ['crm', 'call-logs', { date: today }],
    queryFn: () => fetchCallLogs({ date: today }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['crm'] }), [qc])

  return { kpis, hotDeals, todayCalls, refresh }
}
