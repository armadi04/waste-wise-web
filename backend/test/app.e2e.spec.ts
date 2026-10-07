import { describe, it, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupTestApp, type TestContext } from './utils/setup-app';

describe('AppController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api returns the greeting', () => {
    return request(ctx.app.getHttpServer() as App)
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
