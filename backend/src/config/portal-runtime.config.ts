const DEFAULT_PORTAL_APP_URL = 'http://localhost:3002';

export function portalRuntimeConfig(
  source: Record<string, string | undefined> = process.env,
) {
  return {
    environment: source.NODE_ENV ?? 'development',
    paymentMode: source.PORTAL_PAYMENT_MODE ?? 'sandbox',
    paymentWebhookSecret: source.PORTAL_PAYMENT_WEBHOOK_SECRET?.trim(),
    portalAppUrl: source.PORTAL_APP_URL ?? DEFAULT_PORTAL_APP_URL,
    disableScheduledJobs: source.NODE_ENV === 'test',
  };
}
