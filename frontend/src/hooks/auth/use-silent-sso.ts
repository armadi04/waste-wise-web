import Cookies from 'js-cookie'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/stores/auth.store'

const SILENT_ENABLED = import.meta.env.VITE_SSO_SILENT === 'true'

/**
 * One-shot OIDC silent login (`prompt=none`).
 *
 * On the login page, if SSO silent login is enabled and the visitor is not
 * authenticated, redirect once to the backend silent endpoint. The IdP logs the
 * user straight in if a session exists, otherwise returns `login_required` and
 * the backend bounces back here. The backend sets a short-lived `sso_silent`
 * cookie on each attempt; we only retry after it expires, so a missing IdP
 * session shows the login form instead of looping.
 */
export function useSilentSso(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  useEffect(() => {
    if (!SILENT_ENABLED) return
    if (isAuthenticated) return
    if (Cookies.get('sso_silent')) return
    window.location.href = '/api/auth/sso/silent'
  }, [isAuthenticated])
}
