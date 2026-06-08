import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export interface Profile {
  id: string
  name: string
  email: string
  role: 'SDR' | 'Closer' | 'Gestor' | 'Admin'
  avatar_url: string | null
  active: boolean
  phone: string | null
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) {
        // Se profiles não existe ainda, retornar perfil básico
        return {
          id: user.id,
          name: user.email?.split('@')[0] ?? 'Usuário',
          email: user.email ?? '',
          role: 'SDR' as const,
          avatar_url: null,
          active: true,
          phone: null,
        }
      }
      return data as Profile
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useIsGestor() {
  const { data } = useProfile()
  return data?.role === 'Gestor' || data?.role === 'Admin'
}

export function useIsSDR() {
  const { data } = useProfile()
  return data?.role === 'SDR'
}

export function useIsCloser() {
  const { data } = useProfile()
  return data?.role === 'Closer'
}

export function useMyName() {
  const { data } = useProfile()
  return data?.name ?? ''
}

export function useMyRole() {
  const { data } = useProfile()
  return data?.role ?? 'SDR'
}
