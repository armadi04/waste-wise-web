import { describe, expect, it } from 'bun:test';
import {
  nextIdleDeadline,
  sessionDeadlines,
  sessionPolicy,
} from '../../../src/sessions/session-policy';
import { sessionCookieMaxAge } from '../../../src/auth/session-cookies';

const HOUR = 60 * 60 * 1000;

describe('session policy', () => {
  it('defaults to 2 h idle / 8 h absolute for dashboard sessions', () => {
    expect(sessionPolicy('admin', {})).toEqual({
      idleMs: 2 * HOUR,
      absoluteMs: 8 * HOUR,
    });
  });

  it('gives mobile sessions the same lifetimes as browser sessions', () => {
    const env = { SESSION_ADMIN_IDLE_MINUTES: '45' };
    expect(sessionPolicy('mobile', env)).toEqual(sessionPolicy('admin', env));
  });

  it('rejects unknown audiences', () => {
    expect(() => sessionPolicy('kiosk' as never, {})).toThrow(
      'Unknown session audience',
    );
  });

  it('reads positive integer overrides and ignores invalid ones', () => {
    const env = {
      SESSION_ADMIN_IDLE_MINUTES: '30',
      SESSION_ADMIN_ABSOLUTE_HOURS: '0',
    };
    expect(sessionPolicy('admin', env)).toEqual({
      idleMs: 30 * 60 * 1000,
      absoluteMs: 8 * HOUR,
    });
  });

  it('never lets the idle deadline pass the absolute one', () => {
    const start = new Date('2026-10-05T00:00:00Z');
    const { absoluteExpiresAt, expiresAt } = sessionDeadlines(
      'admin',
      start,
      {},
    );
    expect(absoluteExpiresAt.getTime() - start.getTime()).toBe(8 * HOUR);
    expect(expiresAt.getTime() - start.getTime()).toBe(2 * HOUR);
    const late = new Date(start.getTime() + 7 * HOUR);
    expect(nextIdleDeadline('admin', late, absoluteExpiresAt, {})).toEqual(
      absoluteExpiresAt,
    );
  });

  it('sizes cookies to the remaining absolute lifetime', () => {
    const now = Date.UTC(2026, 9, 5);
    expect(sessionCookieMaxAge(new Date(now + HOUR), now)).toBe(HOUR);
    expect(sessionCookieMaxAge(new Date(now - HOUR), now)).toBe(0);
  });
});
