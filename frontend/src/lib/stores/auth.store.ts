import { create } from 'zustand'
import axios from 'axios'
import type { LoginFormData } from '@/lib/schemas/auth'
import type { AuthResult, AuthState } from '@/types/auth'
import { clearAuthQueryCache } from '@/lib/query/auth-cache'
import {
  impersonate as authImpersonate,
  login as authLogin,
  loginWithGoogle as authLoginWithGoogle,
  logout as authLogout,
  stopImpersonating as authStopImpersonating,
  switchRole as authSwitchRole,
  getCurrentUser,
} from '@/lib/services/auth.service'
import { isAuthenticated as checkAuthenticated } from '@/lib/utils/cookies'
import { rememberActiveRole } from '@/lib/utils/active-role'
import { verifyTwoFactorLogin } from '@/lib/services/two-factor.service'

/**
 * Auth store — replaces the former AuthProvider/Context.
 *
 * The access token is an httpOnly cookie the SPA cannot read. This store holds
 * identity loaded from `GET /auth/me`; `isAuthenticated` is seeded synchronously
 * from the non-sensitive `authenticated` flag cookie (so route guards work
 * before the profile resolves) and `syncAuth()` (async) populates `user`.
 *
 * Note: actions do NOT navigate — a store cannot use the router. They return
 * `{ success, error }` and the caller (e.g. `useLogin`) performs navigation.
 */

interface AuthStore extends AuthState {
  login: (data: LoginFormData, turnstileToken?: string) => Promise<AuthResult>
  loginWithGoogle: (token: string) => Promise<AuthResult>
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<AuthResult>
  impersonate: (userId: number) => Promise<AuthResult>
  stopImpersonating: () => Promise<AuthResult>
  switchRole: (role: string) => Promise<AuthResult>
  logout: () => void
  syncAuth: () => Promise<void>
  clearError: () => void
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: Array<string>) => boolean
  hasAllPermissions: (permissions: Array<string>) => boolean
}

function mapLoginError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401)
      return err.response.data?.message || 'Invalid email or password.'
    if (err.response?.status === 404)
      return 'Server endpoint not found. Please contact support.'
    if (err.response?.status === 500)
      return 'Server error. Please try again later.'
    if (!err.response)
      return 'Network error. Please check your internet connection.'
  } else if (err instanceof Error) {
    return err.message
  }
  return 'Login failed. Please check your credentials.'
}

function mapGoogleError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401)
      return err.response.data?.message || 'Google account not authorized.'
    if (err.response?.status === 404)
      return 'Google auth endpoint not found. Please contact support.'
    if (err.response?.status === 500)
      return 'Internal server error during Google authentication.'
    if (!err.response) return 'Network error. Could not reach the server.'
  } else if (err instanceof Error) {
    return err.message
  }
  return 'Google login failed. Please ensure your account is registered.'
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: checkAuthenticated(),
  user: null,
  isLoading: false,
  error: null,

  // Load identity from the server. `isAuthenticated` follows the flag cookie AND
  // a successful /me (a stale flag with no valid session resolves to logged-out).
  syncAuth: async () => {
    if (!checkAuthenticated()) {
      set({ isAuthenticated: false, user: null })
      return
    }
    const user = await getCurrentUser()
    set({ isAuthenticated: user !== null, user })
  },

  login: async (data, turnstileToken) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authLogin({
        email: data.email,
        password: data.password,
        turnstileToken,
      })
      clearAuthQueryCache()
      // With a second factor the password buys a challenge, not a session —
      // don't sync identity yet, the caller collects a code next.
      if (response.twoFactorRequired && response.challengeToken) {
        return {
          success: false,
          twoFactorRequired: true,
          challengeToken: response.challengeToken,
        }
      }
      await get().syncAuth()
      return { success: true }
    } catch (err) {
      const finalError = mapLoginError(err)
      sessionStorage.setItem('auth_error', finalError)
      set({ error: finalError })
      return { success: false, error: finalError }
    } finally {
      set({ isLoading: false })
    }
  },

  loginWithGoogle: async (token) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authLoginWithGoogle(token)
      clearAuthQueryCache()
      if (response.twoFactorRequired && response.challengeToken) {
        return {
          success: false,
          twoFactorRequired: true,
          challengeToken: response.challengeToken,
        }
      }
      await get().syncAuth()
      return { success: true }
    } catch (err) {
      const finalError = mapGoogleError(err)
      sessionStorage.setItem('auth_error', finalError)
      set({ error: finalError })
      return { success: false, error: finalError }
    } finally {
      set({ isLoading: false })
    }
  },

  // Second step of a login that stopped at the two-factor challenge.
  verifyTwoFactor: async (challengeToken, code) => {
    set({ isLoading: true, error: null })
    try {
      await verifyTwoFactorLogin(challengeToken, code)
      clearAuthQueryCache()
      await get().syncAuth()
      return { success: true }
    } catch (err) {
      const finalError = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'That code is not valid.')
        : 'That code is not valid.'
      set({ error: finalError })
      return { success: false, error: finalError }
    } finally {
      set({ isLoading: false })
    }
  },

  // Sign in as another user. The backend swaps the cookies, so identity is
  // re-read from /auth/me rather than patched locally.
  impersonate: async (userId) => {
    try {
      await authImpersonate(userId)
      clearAuthQueryCache()
      await get().syncAuth()
      return { success: true }
    } catch (err) {
      const finalError = mapLoginError(err)
      set({ error: finalError })
      return { success: false, error: finalError }
    }
  },

  stopImpersonating: async () => {
    try {
      await authStopImpersonating()
      clearAuthQueryCache()
      await get().syncAuth()
      return { success: true }
    } catch (err) {
      const finalError = mapLoginError(err)
      set({ error: finalError })
      return { success: false, error: finalError }
    }
  },

  // Re-scope the session to another assigned role. The backend swaps the
  // cookies, so identity is re-read from /auth/me rather than patched locally.
  switchRole: async (role) => {
    try {
      await authSwitchRole(role)
      clearAuthQueryCache()
      await get().syncAuth()
      const sub = get().user?.sub
      if (sub != null) rememberActiveRole(sub, role)
      return { success: true }
    } catch (err) {
      const finalError = mapLoginError(err)
      set({ error: finalError })
      return { success: false, error: finalError }
    }
  },

  logout: () => {
    const { sid } = get().user ?? {}
    set({ isAuthenticated: false, user: null })
    clearAuthQueryCache()
    void authLogout(sid)
  },

  clearError: () => set({ error: null }),

  hasRole: (role) => get().user?.roles?.includes(role) ?? false,
  hasPermission: (permission) =>
    get().user?.permissions?.includes(permission) ?? false,
  hasAnyPermission: (permissions) =>
    permissions.some((p) => get().user?.permissions?.includes(p)),
  hasAllPermissions: (permissions) =>
    permissions.every((p) => get().user?.permissions?.includes(p)),
}))

// Hydrate identity from the server on app load when the flag cookie says we are
// logged in (e.g. a returning user, or after an SSO redirect that set cookies
// server-side). The httpOnly token is sent automatically with the /me request.
if (checkAuthenticated()) {
  void useAuthStore
    .getState()
    .syncAuth()
    .catch(() => {
      useAuthStore.setState({ error: 'Session could not be loaded.' })
    })
}
