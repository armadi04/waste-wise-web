import { describe, expect, it } from 'bun:test';
import {
  parseTrustProxy,
  redactRequestUrl,
  requestLogSerializers,
} from '@/common/utils/request-logging';
import type { IncomingMessage } from 'node:http';

describe('request logging', () => {
  it('drops query strings and masks gift codes', () => {
    expect(redactRequestUrl('/api/portal/me/orders?token=secret')).toBe(
      '/api/portal/me/orders',
    );
    expect(redactRequestUrl('/api/portal/gifts/GFT-ABC/redeem')).toBe(
      '/api/portal/gifts/:code/redeem',
    );
  });

  it('never serializes headers or cookies', () => {
    const logged = requestLogSerializers.req({
      id: 'req-1',
      method: 'POST',
      url: '/api/auth/refresh?token=x',
      headers: {
        cookie: 'refreshToken=secret',
        authorization: 'Bearer secret',
      },
    } as unknown as IncomingMessage & { id: string });
    expect(logged).toEqual({
      id: 'req-1',
      method: 'POST',
      url: '/api/auth/refresh',
    });
    expect(JSON.stringify(logged)).not.toContain('secret');
  });

  it('parses TRUST_PROXY into an express trust proxy setting', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy('false')).toBeUndefined();
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe(
      'loopback, 10.0.0.0/8',
    );
  });
});
