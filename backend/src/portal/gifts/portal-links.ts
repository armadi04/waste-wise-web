import { portalRuntimeConfig } from '@/config/portal-runtime.config';

/** Public portal URL for a gift; the portal route is `/gifts/$code`. */
export function portalGiftUrl(
  code: string,
  base = portalRuntimeConfig().portalAppUrl,
): string {
  return `${base.replace(/\/+$/, '')}/gifts/${encodeURIComponent(code)}`;
}
