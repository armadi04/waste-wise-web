// Cookie / auth-flag utilities
export { clearAuthFlag, isAuthenticated } from '@/lib/utils/cookies'

// API wrapper with cookie-based auth interceptors
export {
  default as api,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '@/lib/api'

// Auth service utilities
export {
  getCurrentUser,
  getProfile,
  login,
  loginWithGoogle,
  logout,
} from '@/lib/services/auth.service'

export type { CurrentUser, LoginCredentials, LoginResponse } from '@/types/auth'
