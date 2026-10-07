import type { UserSession } from '@/lib/services/session.service'

/**
 * Revoked beats expired: an admin cares that someone ended it, not that it aged
 * out. Expiry is whichever deadline passed first: idle (no refresh in time) or
 * the absolute limit since sign-in.
 */
export const statusOf = (session: UserSession, now = new Date()) => {
  if (session.revokedAt) return { label: 'Revoked', color: 'danger' as const }
  if (
    new Date(session.expiresAt) <= now ||
    new Date(session.absoluteExpiresAt) <= now
  )
    return { label: 'Expired', color: 'default' as const }
  return { label: 'Active', color: 'success' as const }
}
