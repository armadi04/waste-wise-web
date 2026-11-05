import { describe, expect, it } from 'bun:test';
import { testEnvironment } from '../utils/test-environment';

describe('test environment isolation', () => {
  it('discards developer credentials, provider configuration and database targets', () => {
    const environment = testEnvironment(
      {
        DB_HOST: 'production.example.test',
        DB_PASSWORD: 'developer-password',
        JWT_SECRET: 'developer-secret',
        S3_SECRET_ACCESS_KEY: 'developer-s3',
        SMTP_PASS: 'developer-mail',
        MEDIA_STORAGE_PROFILES: '{"real":"credentials"}',
        PATH: '/bin',
      },
      'unit',
    );
    expect(environment.DB_HOST).toBe('127.0.0.1');
    expect(environment.DB_PORT).toBe('9');
    expect(environment.S3_SECRET_ACCESS_KEY).toBe('unit-only-key');
    expect(environment.JWT_SECRET).toBe('unit-only-secret-not-for-deployment');
    for (const key of ['SMTP_PASS', 'MEDIA_STORAGE_PROFILES'])
      expect(environment[key]).toBeUndefined();
  });
  it('refuses integration tests without explicit TEST_DB credentials', () => {
    expect(() =>
      testEnvironment({ DB_HOST: 'developer-db' }, 'integration'),
    ).toThrow('TEST_DB_HOST');
    expect(() =>
      testEnvironment(
        {
          TEST_DB_HOST: 'localhost',
          TEST_DB_PORT: '5432',
          TEST_DB_USERNAME: 'test',
          TEST_DB_PASSWORD: 'test',
          TEST_DB_NAME: 'application',
        },
        'integration',
      ),
    ).toThrow('nestplate_test');
  });
});
