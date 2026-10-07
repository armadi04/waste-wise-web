/** Test processes start from an allowlist, never from developer provider credentials. */
export function testEnvironment(
  source: Record<string, string | undefined>,
  mode: 'unit' | 'integration',
): Record<string, string> {
  const environment: Record<string, string> = {
    NODE_ENV: 'test',
    NESTPLATE_TEST_MODE: mode,
    DB_NAME: 'nestplate_test',
    DB_SYNCHRONIZE: 'false',
    DB_SEED: mode === 'unit' ? 'false' : 'true',
    DB_HOST: '127.0.0.1',
    DB_PORT: '9',
    DB_USERNAME: 'unit-only',
    DB_PASSWORD: 'unit-only',
    JWT_SECRET: 'unit-only-secret-not-for-deployment',
    ADMIN_EMAIL: 'admin@example.test',
    ADMIN_PASSWORD: 'unit-only-password',
    MEDIA_PROVIDER: 'depot',
    DEPOT_BASE_URL: 'https://depot.example.test',
    DEPOT_API_KEY: 'unit-only-key',
    TURNSTILE_ENABLED: 'false',
    LOG_LEVEL: 'silent',
    THROTTLE_LIMIT: '100000',
    APP_NAME: 'Nestplate',
    APP_URL: 'http://localhost:3001',
    TZ: 'UTC',
  };
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TERM', 'CI'])
    if (source[key]) environment[key] = source[key]!;
  if (mode === 'integration') {
    for (const field of ['HOST', 'PORT', 'USERNAME', 'PASSWORD']) {
      const value = source[`TEST_DB_${field}`];
      if (!value)
        throw new Error(`Integration tests require explicit TEST_DB_${field}`);
      environment[`DB_${field}`] = value;
      environment[`TEST_DB_${field}`] = value;
    }
    if (source.TEST_DB_NAME && source.TEST_DB_NAME !== 'nestplate_test')
      throw new Error('Integration tests require TEST_DB_NAME=nestplate_test');
  }
  return environment;
}
