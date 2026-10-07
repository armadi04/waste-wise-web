export interface TurnstileEnvironment {
  NODE_ENV?: string;
  TURNSTILE_ENABLED?: boolean | string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_ALLOWED_HOSTNAMES?: string;
}

export const TURNSTILE_TEST_SECRETS = [
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
];

export function resolveTurnstileConfig(env: TurnstileEnvironment) {
  const secret =
    env.TURNSTILE_SECRET?.trim() || env.TURNSTILE_SECRET_KEY?.trim();
  const deployed = ['production', 'staging'].includes(
    env.NODE_ENV ?? 'development',
  );
  const testSecret = TURNSTILE_TEST_SECRETS.includes(secret ?? '');
  const flag = env.TURNSTILE_ENABLED;
  const normalizedFlag =
    typeof flag === 'string' ? flag.trim().toLowerCase() : flag;
  if (
    normalizedFlag !== undefined &&
    ![true, false, 'true', 'false', '1', '0'].includes(normalizedFlag)
  ) {
    throw new Error('TURNSTILE_ENABLED must be true or false');
  }
  const enabled =
    normalizedFlag === undefined
      ? deployed || Boolean(secret)
      : [true, 'true', '1'].includes(normalizedFlag);
  const hostnames = (env.TURNSTILE_ALLOWED_HOSTNAMES ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    hostnames.some(
      (host) =>
        host.length > 253 ||
        host
          .split('.')
          .some(
            (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
          ),
    )
  ) {
    throw new Error(
      'TURNSTILE_ALLOWED_HOSTNAMES must contain hostnames without scheme, port or path',
    );
  }
  if (deployed && testSecret)
    throw new Error(
      'Turnstile test secrets are forbidden in staging/production',
    );
  if (enabled && !secret)
    throw new Error('TURNSTILE_SECRET is required when Turnstile is enabled');
  if (enabled && deployed && hostnames.length === 0)
    throw new Error(
      'TURNSTILE_ALLOWED_HOSTNAMES is required when Turnstile is enabled in staging/production',
    );
  return { enabled, secret, testSecret, hostnames };
}
