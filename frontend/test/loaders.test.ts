// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { CurrentUser } from '@/types/auth'
import { loadAdminRoute } from '@/lib/query/loaders'
import { usersQueryOptions } from '@/lib/query/options'
import { requireAuth } from '@/lib/utils/route-guard'
import { getUsers } from '@/lib/services/user.service'
import { getCurrentUser } from '@/lib/services/auth.service'

vi.mock('@/lib/services/user.service', () => ({
  getUsers: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
}))
vi.mock('@/lib/services/auth.service', () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
  getProfile: vi.fn(),
  getInvitation: vi.fn(),
}))
vi.mock('@/lib/stores/auth.store', () => ({
  useAuthStore: { setState: vi.fn() },
}))
const session: CurrentUser = {
  sub: 1,
  email: 'admin@example.test',
  roles: ['admin'],
  permissions: ['users.read'],
  emailVerified: true,
}
describe('admin loaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('uses the same query cache as hooks and preserves URL filters', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    })
    const search = {
      page: 2,
      limit: 20,
      search: 'Alice',
      sort: 'createdAt',
      direction: 'desc' as const,
      createdIn: '7d' as const,
      registerMethod: 'EMAIL_OTP' as const,
    }
    await loadAdminRoute({ queryClient, session }, '/users', search)
    await queryClient.ensureQueryData(usersQueryOptions(search))
    expect(getUsers).toHaveBeenCalledTimes(1)
    expect(getUsers).toHaveBeenCalledWith({ ...search, paginated: true })
  })
  it('does not preload data without permission', async () => {
    await loadAdminRoute(
      {
        queryClient: new QueryClient(),
        session: { ...session, permissions: [] },
      },
      '/users',
    )
    expect(getUsers).not.toHaveBeenCalled()
  })
  it('checks server identity rather than trusting the browser flag', async () => {
    await expect(
      requireAuth({ context: { queryClient: new QueryClient() } }),
    ).rejects.toMatchObject({ options: { to: '/login' } })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
  })
})
