import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { AuthGuardOptions, UseAuthReturn } from '@/types/auth'
import { profileQueryOptions } from '@/lib/query/options'

import { useAuthStore } from '@/lib/stores/auth.store'
import { isAuthenticated } from '@/lib/utils/cookies'

/**
 * Auth accessor. Thin wrapper over {@link useAuthStore} so the ~12 existing
 * call sites keep the same `UseAuthReturn` shape.
 */
export function useAuth(): UseAuthReturn {
  return useAuthStore()
}

/** Redirects based on auth state and whether the current page is an auth page. */
export function useAuthGuard(options: AuthGuardOptions = {}) {
  const { isAuthPage = false, redirectPath } = options
  const navigate = useNavigate()
  const isAuth = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (isAuthPage) {
      // On an auth page while logged in → go to dashboard
      if (isAuth) {
        void navigate({ to: redirectPath || '/' })
      }
    } else {
      // On a protected page while logged out → go to login
      if (!isAuth) {
        void navigate({ to: redirectPath || '/login' })
      }
    }
  }, [isAuth, isAuthPage, navigate, redirectPath])

  return { isAuthenticated: isAuth }
}

/** Server-state profile query (react-query). */
export function useProfile() {
  return useQuery({ ...profileQueryOptions(), enabled: isAuthenticated() })
}

export default useAuth
