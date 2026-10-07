import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupTestApp, type TestContext } from './utils/setup-app';

describe('Health (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/health reports the database as up', async () => {
    const res = await request(ctx.app.getHttpServer() as App)
      .get('/api/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
  });
});
