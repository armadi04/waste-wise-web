/**
 * Session lifetime policy per audience (OWASP idle + absolute timeouts).
 *
 * - `admin`: dashboard password/Google/2FA, SSO and impersonation sessions.
 * - `portal`: customer email-OTP/Google sessions.
 *
 * Idle = longest gap between refreshes; each refresh slides the session's
 * `expiresAt` forward, never past `absoluteExpiresAt`. Absolute = hard limit
 * since login, after which the user must sign in again. Values come from env
 * (validated in config/env.ts) and are read per call so tests can override.
 */
export type SessionAudience = 'admin' | 'portal';

export const SESSION_AUDIENCES: readonly SessionAudience[] = [
  'admin',
  'portal',
];

/** Access JWT lifetime for every audience; clients refresh on 401. */
export const ACCESS_TOKEN_TTL = '15m';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export interface SessionPolicy {
  idleMs: number;
  absoluteMs: number;
}

export function sessionPolicy(
  audience: SessionAudience,
  source: Record<string, string | undefined> = process.env,
): SessionPolicy {
  if (audience === 'portal')
    return {
      idleMs: positive(source.SESSION_PORTAL_IDLE_DAYS, 14) * DAY,
      absoluteMs: positive(source.SESSION_PORTAL_ABSOLUTE_DAYS, 30) * DAY,
    };
  return {
    idleMs: positive(source.SESSION_ADMIN_IDLE_MINUTES, 120) * MINUTE,
    absoluteMs: positive(source.SESSION_ADMIN_ABSOLUTE_HOURS, 8) * HOUR,
  };
}

/** Deadlines for a session created at `startedAt`. */
export function sessionDeadlines(
  audience: SessionAudience,
  startedAt: Date,
  source?: Record<string, string | undefined>,
) {
  const { absoluteMs } = sessionPolicy(audience, source);
  const absoluteExpiresAt = new Date(startedAt.getTime() + absoluteMs);
  return {
    absoluteExpiresAt,
    expiresAt: nextIdleDeadline(audience, startedAt, absoluteExpiresAt, source),
  };
}

/** Idle deadline after activity at `now`, capped by the absolute deadline. */
export function nextIdleDeadline(
  audience: SessionAudience,
  now: Date,
  absoluteExpiresAt: Date,
  source?: Record<string, string | undefined>,
) {
  const { idleMs } = sessionPolicy(audience, source);
  return new Date(
    Math.min(now.getTime() + idleMs, absoluteExpiresAt.getTime()),
  );
}

/** Customer-only accounts get portal sessions; anyone else is staff (admin). */
export const audienceForRoles = (roleNames: string[]): SessionAudience =>
  roleNames.length > 0 && roleNames.every((name) => name === 'customer')
    ? 'portal'
    : 'admin';
