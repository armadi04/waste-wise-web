import axios from 'axios'
import api from '../api'
import { clearAuthFlag } from '../utils/cookies'
import type {
  CurrentUser,
  LoginCredentials,
  LoginResponse,
  UserProfile,
} from '@/types/auth'
import { getCsrfToken } from '@/lib/utils/csrf'

/**
 * Login user with credentials. The backend sets the httpOnly accessToken +
 * `authenticated` flag cookies; nothing is stored client-side.
 */
export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', credentials)
  return response.data
}

/**
 * Login user with Google. Cookies are set by the backend.
 */
export async function loginWithGoogle(token: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/google', { token })
  return response.data
}

/**
 * Re-issue the session scoped to a role the user holds. The backend swaps the
 * httpOnly cookies, so the caller only needs to re-read `GET /auth/me`.
 */
export async function switchRole(role: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    '/api/auth/switch-role',
    { role },
    { headers: { 'X-CSRF-Token': getCsrfToken() } },
  )
  return response.data
}

/**
 * Open a session as another user. The backend swaps the cookies and stamps the
 * administrator's own id on the new token, so it can be handed back.
 */
export async function impersonate(userId: number): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    `/api/auth/impersonate/${userId}`,
    {},
    { headers: { 'X-CSRF-Token': getCsrfToken() } },
  )
  return response.data
}

/** Return to the administrator's own account. */
export async function stopImpersonating(): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    '/api/auth/stop-impersonating',
    {},
    { headers: { 'X-CSRF-Token': getCsrfToken() } },
  )
  return response.data
}

/**
 * Get user profile
 */
export async function getProfile(): Promise<UserProfile> {
  const response = await api.get<UserProfile>('/api/auth/profile')
  return response.data
}

/**
 * Logout user — clear server session and redirect. `sid` (when the session was
 * minted via SSO) routes through RP-initiated logout so the IdP session ends too.
 */
export async function logout(sid?: string): Promise<void> {
  if (sid) {
    clearAuthFlag()
    window.location.href = '/api/auth/sso/logout'
    return
  }

  try {
    await api.post(
      '/api/auth/logout',
      {},
      { headers: { 'X-CSRF-Token': getCsrfToken() } },
    )
  } catch {
    // ignore errors — always clear local state
  }
  clearAuthFlag()
  window.location.href = '/login'
}

/**
 * Fetch the current session identity (flattened roles + permissions) from the
 * server. The token is httpOnly and never decoded client-side; `GET /auth/me`
 * returns exactly what the JWT strategy resolved. Returns null if unauthenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const { data } = await api.get<{
      userId: number
      email: string
      roles: Array<string>
      permissions: Array<string>
      emailVerified: boolean
      activeRole?: string
      sid?: string
      impersonatorId?: number
    }>('/api/auth/me')
    return {
      sub: data.userId,
      email: data.email,
      roles: data.roles ?? [],
      permissions: data.permissions ?? [],
      emailVerified: data.emailVerified ?? false,
      activeRole: data.activeRole,
      sid: data.sid,
      impersonatorId: data.impersonatorId,
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAuthFlag()
      return null
    }
    throw error
  }
}

/**
 * Request a password reset email
 */
export async function forgotPassword(
  email: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/api/auth/forgot-password',
    { email },
  )
  return response.data
}

/**
 * Reset password using token from email
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/api/auth/reset-password',
    { token, password },
  )
  return response.data
}

/**
 * Silently refresh the access token and persist it.
 * Call this after out-of-band state changes (e.g. email verification) to get
 * an up-to-date JWT without making the user log in again.
 */
export async function refreshAccessToken(): Promise<void> {
  const csrfToken = getCsrfToken()
  // Raw axios avoids the interceptor loop, but must target the configured API
  // base URL so the API-origin-scoped refresh cookie is sent (cross-origin setup).
  // The backend resets the httpOnly accessToken cookie; nothing to store here.
  await axios.post(
    `${api.defaults.baseURL ?? ''}/api/auth/refresh`,
    {},
    { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken } },
  )
}

/**
 * Verify email address using token from email
 */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  const response = await api.get<{ message: string }>(
    `/api/auth/verify-email?token=${token}`,
  )
  return response.data
}

/**
 * Resend email verification link
 */
export async function resendVerification(
  email: string,
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/api/auth/resend-verification',
    { email },
  )
  return response.data
}

/**
 * Resolve an invitation by its token — returns the invitee email for prefill.
 */
export async function getInvitation(token: string): Promise<{ email: string }> {
  const response = await api.get<{ email: string }>(
    `/api/invitations/accept?token=${token}`,
  )
  return response.data
}

/**
 * Accept an invitation and create the account.
 */
export async function acceptInvitation(
  token: string,
  data: { fullname?: string; phone?: string; password: string },
): Promise<{ message: string }> {
  const response = await api.post<{ message: string }>(
    '/api/invitations/accept',
    { token, ...data },
  )
  return response.data
}
