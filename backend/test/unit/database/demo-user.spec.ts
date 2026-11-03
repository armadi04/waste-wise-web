import { describe, expect, it } from 'bun:test';
import { resolveDemoUser } from '../../../src/database/seeder/demo-user';

describe('demo user credentials', () => {
  it('uses development defaults when env is absent', () => {
    expect(resolveDemoUser({ NODE_ENV: 'development' })).toEqual({
      email: 'user@smart-waste.local',
      password: 'DemoUser123!',
    });
  });

  it('allows explicit overrides in deployed environments', () => {
    expect(
      resolveDemoUser({
        NODE_ENV: 'staging',
        DEMO_USER_EMAIL: 'demo@example.test',
        DEMO_USER_PASSWORD: 'long-password',
      }),
    ).toEqual({
      email: 'demo@example.test',
      password: 'long-password',
    });
  });

  it('refuses implicit defaults outside development and test', () => {
    expect(resolveDemoUser({ NODE_ENV: 'production' })).toBeNull();
    expect(resolveDemoUser({ NODE_ENV: 'staging' })).toBeNull();
  });
});
