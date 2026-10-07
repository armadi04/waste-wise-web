import { ForbiddenException } from '@nestjs/common';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';

export const PAYMENT_TTL_MS = 24 * 60 * 60 * 1_000;

export function paymentSandboxEnabled() {
  const config = portalRuntimeConfig();
  const production = ['production', 'staging'].includes(config.environment);
  return !production && config.paymentMode === 'sandbox';
}

export function assertPaymentSandbox() {
  if (!paymentSandboxEnabled())
    throw new ForbiddenException('Payment sandbox is disabled');
}

export function paymentExpired(
  deadline: Date | null | undefined,
  now = new Date(),
) {
  return Boolean(deadline && deadline.getTime() <= now.getTime());
}
