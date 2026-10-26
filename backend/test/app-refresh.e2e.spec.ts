import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';

describe('App refresh (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer();
    admin = await adminToken(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /app/force-refresh', () => {
    it('issues a signal for a holder of app.force_refresh', async () => {
      const res = await request(server)
        .post('/api/v1/app/force-refresh')
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);

      expect(Date.parse(res.body.issuedAt as string)).not.toBeNaN();
    });

    it('issues a fresh timestamp each time, so a client reloads only once per signal', async () => {
      const first = await request(server)
        .post('/api/v1/app/force-refresh')
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 5));

      const second = await request(server)
        .post('/api/v1/app/force-refresh')
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);

      expect(second.body.issuedAt).not.toBe(first.body.issuedAt);
    });

    it('rejects a signed-in user without the permission with 403', async () => {
      const user = await createUser(ctx, { email: 'nobroadcast@b.com' });

      await request(server)
        .post('/api/v1/app/force-refresh')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(server).post('/api/v1/app/force-refresh').expect(401);
    });
  });
});
