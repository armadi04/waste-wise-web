import { describe, expect, it } from 'bun:test';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';

describe('portal runtime config', () => {
  it('keeps development defaults and test scheduler behavior', () => {
    expect(portalRuntimeConfig({})).toEqual({
      environment: 'development',
      paymentMode: 'sandbox',
      paymentWebhookSecret: undefined,
      portalAppUrl: 'http://localhost:3002',
      disableScheduledJobs: false,
    });
    expect(portalRuntimeConfig({ NODE_ENV: 'test' }).disableScheduledJobs).toBe(
      true,
    );
  });

  it('preserves configured values and trims webhook secret', () => {
    expect(
      portalRuntimeConfig({
        NODE_ENV: 'production',
        PORTAL_PAYMENT_MODE: 'sandbox',
        PORTAL_PAYMENT_WEBHOOK_SECRET: ' secret ',
        PORTAL_APP_URL: 'https://portal.example.test',
      }),
    ).toEqual({
      environment: 'production',
      paymentMode: 'sandbox',
      paymentWebhookSecret: 'secret',
      portalAppUrl: 'https://portal.example.test',
      disableScheduledJobs: false,
    });
  });
});
