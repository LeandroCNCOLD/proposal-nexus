import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export type TeamMember = { user_id: string; full_name: string | null; email: string | null }

async function fetchByRole(role: 'sdr' | 'vendedor' | 'gerente_comercial'): Promise<TeamMember[]> {
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

// Closers = vendedores + gerentes comerciais
export function useCloserNames() {
  const q = useQuery({
    queryKey: ['team-members', 'closers'],
    queryFn: async () => {
      const [vendedores, gerentes] = await Promise.all([
        fetchByRole('vendedor'),
        fetchByRole('gerente_comercial'),
      ])
      const byId = new Map<string, TeamMember>()
      for (const m of [...vendedores, ...gerentes]) byId.set(m.user_id, m)
      return Array.from(byId.values()).sort((a, b) =>
        nameOf(a).localeCompare(nameOf(b), 'pt-BR'),
      )
    },
    staleTime: 5 * 60_000,
  })
  const names = (q.data ?? []).map(nameOf)
  return { names, members: q.data ?? [], isLoading: q.isLoading, error: q.error }
}
