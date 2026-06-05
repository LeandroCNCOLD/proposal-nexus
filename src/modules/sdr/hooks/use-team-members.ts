import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type TeamMember = { user_id: string; full_name: string | null; email: string | null }

async function fetchByRole(role: 'sdr' | 'vendedor'): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('get_team_members_by_role', { _role: role })
  if (error) throw error
  return (data ?? []) as TeamMember[]
}

function nameOf(m: TeamMember): string {
  return (m.full_name?.trim() || m.email?.split('@')[0] || 'Sem nome')
}

export function useSdrNames() {
  const q = useQuery({
    queryKey: ['team-members', 'sdr'],
    queryFn: () => fetchByRole('sdr'),
    staleTime: 5 * 60_000,
  })
  const names = (q.data ?? []).map(nameOf)
  return { names, members: q.data ?? [], isLoading: q.isLoading, error: q.error }
}

export function useCloserNames() {
  const q = useQuery({
    queryKey: ['team-members', 'vendedor'],
    queryFn: () => fetchByRole('vendedor'),
    staleTime: 5 * 60_000,
  })
  const names = (q.data ?? []).map(nameOf)
  return { names, members: q.data ?? [], isLoading: q.isLoading, error: q.error }
}
