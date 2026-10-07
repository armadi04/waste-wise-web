import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Request log fields without secrets: no headers (cookies, Authorization), no
 * query string (`?token=`), and gift codes in paths replaced by a placeholder.
 */
export function redactRequestUrl(url: string | undefined): string {
  const path = (url ?? '').split('?')[0];
  return path.replace(/\/portal\/gifts\/[^/]+/, '/portal/gifts/:code');
}

export const requestLogSerializers = {
  req: (req: IncomingMessage & { id?: unknown }) => ({
    id: req.id,
    method: req.method,
    url: redactRequestUrl(req.url),
  }),
  res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
};

/**
 * Express `trust proxy` from TRUST_PROXY. Unset/"false" keeps the default (the
 * direct peer is the client). A hop count or an address/subnet list trusts only
 * those proxies' X-Forwarded-For, e.g. the portal BFF in front of the API.
 */
export function parseTrustProxy(
  value: string | undefined,
): boolean | number | string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'false') return undefined;
  if (trimmed === 'true') return true;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}
