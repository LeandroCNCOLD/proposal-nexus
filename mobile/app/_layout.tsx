import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider, useAuth } from '../src/contexts/AuthContext'
import { TelefoniaProvider } from '../src/contexts/TelefoniaContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

function AuthGuard() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) {
      router.replace('/(auth)/login')
    } else if (session && inAuth) {
      router.replace('/(tabs)')
    }
  }, [session, loading])

  return null
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TelefoniaProvider>
          <AuthGuard />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </TelefoniaProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
