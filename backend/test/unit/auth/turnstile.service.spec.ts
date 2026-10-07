import { afterAll, afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from '@/auth/turnstile.service';
import {
  resolveTurnstileConfig,
  TURNSTILE_TEST_SECRETS,
  type TurnstileEnvironment,
} from '@/auth/turnstile-config';

const fetchSpy = spyOn(globalThis, 'fetch');
const warnSpy = spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
const logSpy = spyOn(Logger.prototype, 'log').mockImplementation(() => {});
const build = (values: TurnstileEnvironment = {}) =>
  new TurnstileService({
    get: (key: keyof TurnstileEnvironment) => values[key],
  } as unknown as ConfigService);
const success = (overrides = {}) =>
  new Response(
    JSON.stringify({
      success: true,
      action: 'admin-login',
      hostname: 'app.example.test',
      ...overrides,
    }),
  );
const verify = (service: TurnstileService, token = 'test-token') =>
  service.verify(token, '1.2.3.4', 'admin-login');

afterEach(() => {
  fetchSpy.mockReset();
  warnSpy.mockClear();
  logSpy.mockClear();
});
afterAll(() => {
  fetchSpy.mockRestore();
  warnSpy.mockRestore();
  logSpy.mockRestore();
});

describe('Turnstile configuration policy', () => {
  it('disables unconfigured local development but requires configuration in deployed environments', () => {
    expect(resolveTurnstileConfig({}).enabled).toBe(false);
    for (const NODE_ENV of ['production', 'staging']) {
      expect(() => resolveTurnstileConfig({ NODE_ENV })).toThrow(
        'TURNSTILE_SECRET',
      );
      expect(() =>
        resolveTurnstileConfig({ NODE_ENV, TURNSTILE_SECRET: 'real-secret' }),
      ).toThrow('TURNSTILE_ALLOWED_HOSTNAMES');
      expect(
        resolveTurnstileConfig({
          NODE_ENV,
          TURNSTILE_SECRET: 'real-secret',
          TURNSTILE_ALLOWED_HOSTNAMES: 'app.example.test, ADMIN.example.test',
        }).hostnames,
      ).toEqual(['app.example.test', 'admin.example.test']);
      expect(
        resolveTurnstileConfig({ NODE_ENV, TURNSTILE_ENABLED: 'false' })
          .enabled,
      ).toBe(false);
    }
  });
  it.each(TURNSTILE_TEST_SECRETS)(
    'rejects test secret %s in staging and production',
    (TURNSTILE_SECRET) => {
      for (const NODE_ENV of ['production', 'staging'])
        expect(() =>
          resolveTurnstileConfig({
            NODE_ENV,
            TURNSTILE_SECRET,
            TURNSTILE_ENABLED: 'false',
          }),
        ).toThrow('test secrets');
      expect(resolveTurnstileConfig({ TURNSTILE_SECRET }).testSecret).toBe(
        true,
      );
    },
  );
  it('validates activation flags and hostname syntax without exposing credentials', () => {
    expect(() => resolveTurnstileConfig({ TURNSTILE_ENABLED: 'typo' })).toThrow(
      'true or false',
    );
    expect(() => resolveTurnstileConfig({ TURNSTILE_ENABLED: 'true' })).toThrow(
      'TURNSTILE_SECRET',
    );
    for (const host of [
      'https://app.example.test',
      'localhost:3001',
      '*.example.test',
      'example.test/path',
    ])
      expect(() =>
        resolveTurnstileConfig({ TURNSTILE_ALLOWED_HOSTNAMES: host }),
      ).toThrow('hostnames');
  });
});

describe('Turnstile provider validation', () => {
  it('does not contact Cloudflare when intentionally disabled', async () => {
    await verify(build());
    await verify(
      build({ TURNSTILE_SECRET: 'real-secret', TURNSTILE_ENABLED: false }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'x'.repeat(2049)])(
    'rejects missing/oversized input before network requests',
    async (token) => {
      await expect(
        verify(build({ TURNSTILE_SECRET: 'real-secret' }), token),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
  it.each([
    [{ TURNSTILE_SECRET: 'primary' }, 'primary'],
    [{ TURNSTILE_SECRET_KEY: 'legacy' }, 'legacy'],
    [
      { TURNSTILE_SECRET: 'primary', TURNSTILE_SECRET_KEY: 'legacy' },
      'primary',
    ],
  ])(
    'uses the configured secret and bounded request timeout %j',
    async (values, secret) => {
      fetchSpy.mockResolvedValue(success());
      await verify(build(values));
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      );
      expect((options?.body as URLSearchParams).get('secret')).toBe(secret);
      expect((options?.body as URLSearchParams).get('remoteip')).toBe(
        '1.2.3.4',
      );
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'verified',
          action: 'admin-login',
        }),
      );
    },
  );
  it.each([
    { action: 'other-action' },
    { action: undefined },
    { hostname: 'attacker.example.test' },
    { hostname: undefined },
  ])('rejects a valid token with wrong context %j', async (fields) => {
    fetchSpy.mockResolvedValue(success(fields));
    await expect(
      verify(
        build({
          TURNSTILE_SECRET: 'real-secret',
          TURNSTILE_ALLOWED_HOSTNAMES: 'app.example.test,admin.example.test',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects unrelated actions even with a shared secret', async () => {
    fetchSpy.mockResolvedValue(success({ action: 'other-action' }));
    await expect(
      build({ TURNSTILE_SECRET: 'real-secret' }).verify(
        'token',
        undefined,
        'admin-login',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('allows official dummy keys only in development and skips dummy origin/action metadata', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ success: true })));
    await verify(build({ TURNSTILE_SECRET: TURNSTILE_TEST_SECRETS[0] }));
  });
  it.each(['timeout-or-duplicate', 'invalid-input-response'])(
    'rejects challenge failures with 400 and a safe operational reason %s',
    async (code) => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: false, 'error-codes': [code] })),
      );
      await expect(
        verify(
          build({ TURNSTILE_SECRET: 'never-log-this-secret' }),
          'never-log-this-token',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      const logs = JSON.stringify(warnSpy.mock.calls);
      expect(logs).not.toContain('never-log-this');
      expect(logs).toContain('rejected');
    },
  );
  it.each(['internal-error', 'invalid-input-secret'])(
    'classifies provider/configuration errors as unavailable %s',
    async (code) => {
      fetchSpy.mockResolvedValue(
        new Response(JSON.stringify({ success: false, 'error-codes': [code] })),
      );
      await expect(
        verify(build({ TURNSTILE_SECRET: 'real-secret' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );
  it.each([
    new Response('not-json'),
    new Response('null'),
    new Response('{"success":"true"}'),
    new Response('', { status: 503 }),
  ])(
    'fails closed on malformed and unavailable provider responses',
    async (response) => {
      fetchSpy.mockResolvedValue(response);
      await expect(
        verify(build({ TURNSTILE_SECRET: 'real-secret' })),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    },
  );
  it.each([
    new Error('network error'),
    new DOMException('timeout', 'TimeoutError'),
  ])('classifies network/timeouts as 503', async (error) => {
    fetchSpy.mockRejectedValue(error);
    await expect(
      verify(build({ TURNSTILE_SECRET: 'real-secret' })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
