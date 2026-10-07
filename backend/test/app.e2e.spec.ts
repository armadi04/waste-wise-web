import { API_VERSION } from '../src/config/api-routing';
import { SWAGGER_UI_PATH } from '../src/config/swagger.config';
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

  it('GET /api/v1 returns API identity', () => {
    return request(ctx.app.getHttpServer() as App)
      .get('/api/v1')
      .expect(200)
      .expect({
        name: 'Nestplate API',
        apiVersion: API_VERSION,
        docs: SWAGGER_UI_PATH,
      });
  });
});
