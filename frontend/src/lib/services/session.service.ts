import type { PaginatedData } from '@/types/api'
import { apiDelete, apiGet, apiPost } from '@/lib/api'

/**
 * A signed-in device session. Backed by a server-side row, so revoking one ends
 * it immediately instead of waiting for the JWT to expire.
 */
export interface UserSession {
  id: number
  sessionId: string
  userId: number
  ipAddress: string | null
  userAgent: string | null
  isSso: boolean
  /** Set when an administrator opened this session by signing in as the user. */
  impersonatedById: number | null
  /** Starter dashboard session policy. */
  audience: 'admin'
  lastActiveAt: string
  /** Idle deadline; slides on refresh, never past `absoluteExpiresAt`. */
  expiresAt: string
  absoluteExpiresAt: string
  revokedAt: string | null
  createdAt: string
  updatedAt: string
  user?: {
    id: number
    fullname: string
    email: string
  }
}

/** The `/sessions/me` rows flag which one is the browser making the request. */
export interface OwnSession extends UserSession {
  isCurrent: boolean
}

export const getMySessions = () => {
  return apiGet<Array<OwnSession>>('/api/sessions/me')
}

export const revokeMySession = (id: number) => {
  return apiDelete<UserSession>(`/api/sessions/me/${id}`)
}

export const revokeMyOtherSessions = () => {
  return apiPost<{ revoked: number }>('/api/sessions/me/revoke-others', {})
}

export const getSessions = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
}) => {
  return apiGet<PaginatedData<UserSession>>('/api/sessions', { params })
}

export const revokeSession = (id: number) => {
  return apiDelete<UserSession>(`/api/sessions/${id}`)
}
