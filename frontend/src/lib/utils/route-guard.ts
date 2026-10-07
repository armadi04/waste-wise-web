import { redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { sessionQueryOptions } from '@/lib/query/options'
import { useAuthStore } from '@/lib/stores/auth.store'

export async function requireAuth({
  context,
}: {
  context: { queryClient: QueryClient }
}) {
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions())
  if (!user) {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    throw redirect({ to: '/login' })
  }
  useAuthStore.setState({ isAuthenticated: true, user })
  return { session: user }
}
