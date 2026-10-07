/**
 * Browser session cookies live until the session's absolute deadline: past it
 * the server refuses the session anyway, and an earlier expiry would log the
 * user out client-side while the session is still valid. Idle expiry is
 * enforced server-side on refresh.
 */
export const sessionCookieMaxAge = (sessionExpiresAt: Date, now = Date.now()) =>
  Math.max(0, sessionExpiresAt.getTime() - now);
