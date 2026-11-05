import type { Permission, Role, User } from '@/types/api'
import type { LoginFormData } from '@/lib/schemas/auth'

export interface LoginCredentials {
  email: string
  password: string
  turnstileToken?: string
}

export interface LoginResponse {
  access_token?: string
  /**
   * Set instead of `access_token` when the account has a second factor: the
   * password was right, but the session isn't issued until the code is verified.
   */
  twoFactorRequired?: boolean
  challengeToken?: string
}

/**
 * What an auth action reports back. `twoFactorRequired` means the caller must
 * collect a code and finish through `verifyTwoFactor`.
 */
export interface AuthResult {
  success: boolean
  error?: string
  twoFactorRequired?: boolean
  challengeToken?: string
}

/**
 * Session identity as returned by `GET /auth/me` (flattened roles/permissions).
 * The access token is httpOnly and never decoded client-side.
 */
export interface CurrentUser {
  email: string
  sub: number
  roles: Array<string>
  permissions: Array<string>
  emailVerified: boolean
  // The role the user is currently acting as; absent until a multi-role user
  // picks one. When set, `roles`/`permissions` are scoped to it.
  activeRole?: string
  // Set while an administrator is signed in as this user; holds their own id.
  impersonatorId?: number
}

// Re-export or alias for backward compatibility
export type { Permission, Role }

export type UserProfile = User

export interface AuthState {
  isAuthenticated: boolean
  user: CurrentUser | null
  isLoading: boolean
  error: string | null
}

export interface UseAuthReturn extends AuthState {
  login: (data: LoginFormData, turnstileToken?: string) => Promise<AuthResult>
  loginWithGoogle: (token: string) => Promise<AuthResult>
  verifyTwoFactor: (challengeToken: string, code: string) => Promise<AuthResult>
  impersonate: (userId: number) => Promise<AuthResult>
  stopImpersonating: () => Promise<AuthResult>
  switchRole: (role: string) => Promise<AuthResult>
  logout: () => void
  syncAuth: () => void
  hasRole: (role: string) => boolean
  hasPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: Array<string>) => boolean
  hasAllPermissions: (permissions: Array<string>) => boolean
  clearError: () => void
}

export interface AuthGuardOptions {
  isAuthPage?: boolean
  redirectPath?: string
}
