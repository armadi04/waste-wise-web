/**
 * Browser session cookies live until the session's absolute deadline: past it
 * the server refuses the session anyway, and an earlier expiry would log the
 * user out client-side while the session is still valid. Idle expiry is
 * enforced server-side on refresh.
 */
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';

export const sessionCookieMaxAge = (sessionExpiresAt: Date, now = Date.now()) =>
  Math.max(0, sessionExpiresAt.getTime() - now);

/** Domain durations remain milliseconds; Fastify serializes Max-Age in seconds. */
export function setSessionCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  options: CookieSerializeOptions,
) {
  const { maxAge, ...rest } = options;
  reply.setCookie(name, value, {
    path: '/',
    ...rest,
    ...(maxAge === undefined
      ? {}
      : {
          maxAge: Math.floor(maxAge / 1000),
          expires: new Date(Date.now() + maxAge),
        }),
  });
}
