import { describe, expect, it } from 'vitest'
import type { UserSession } from '@/lib/services/session.service'
import { statusOf } from '@/components/features/sessions/components/table-columns/lib/columns-helpers'

const now = new Date('2026-10-05T12:00:00Z')
const session = (overrides: Partial<UserSession>): UserSession => ({
  id: 1,
  sessionId: 's',
  userId: 1,
  ipAddress: null,
  userAgent: null,
  isSso: false,
  impersonatedById: null,
  audience: 'admin',
  lastActiveAt: '2026-10-05T11:00:00Z',
  expiresAt: '2026-10-05T13:00:00Z',
  absoluteExpiresAt: '2026-10-05T18:00:00Z',
  revokedAt: null,
  createdAt: '2026-10-05T10:00:00Z',
  updatedAt: '2026-10-05T11:00:00Z',
  ...overrides,
})

describe('session status', () => {
  it('is active before both the idle and absolute deadlines', () => {
    expect(statusOf(session({}), now).label).toBe('Active')
  })
  it('expires when the idle deadline passes without a refresh', () => {
    expect(
      statusOf(session({ expiresAt: '2026-10-05T11:30:00Z' }), now).label,
    ).toBe('Expired')
  })
  it('expires at the absolute deadline even if recently refreshed', () => {
    expect(
      statusOf(session({ absoluteExpiresAt: '2026-10-05T11:59:00Z' }), now)
        .label,
    ).toBe('Expired')
  })
  it('reports revoked before expiry', () => {
    expect(
      statusOf(
        session({
          revokedAt: '2026-10-05T11:00:00Z',
          expiresAt: '2026-10-05T11:30:00Z',
        }),
        now,
      ).label,
    ).toBe('Revoked')
  })
})
