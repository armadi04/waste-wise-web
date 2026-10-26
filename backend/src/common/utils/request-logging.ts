import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Request log fields without secrets: no headers (cookies, Authorization), no
 * query string (`?token=`).
 */
export function redactRequestUrl(url: string | undefined): string {
  return (url ?? '').split('?')[0];
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
 * Fastify `trustProxy` from TRUST_PROXY. Unset/"false" keeps the default (the
 * direct peer is the client). Only an address/subnet list authenticates the
 * immediate proxy peer. Hop counts and blanket trust permit direct spoofing.
 */
export function parseTrustProxy(
  value: string | undefined,
): string[] | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'false') return undefined;
  if (trimmed === 'true' || /^\d+$/.test(trimmed)) {
    throw new Error(
      'TRUST_PROXY must list trusted proxy addresses/CIDRs, not true or a hop count',
    );
  }
  return trimmed
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}
