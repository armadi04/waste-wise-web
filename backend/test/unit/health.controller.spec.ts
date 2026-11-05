import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHttpAdapter } from '@/config/http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from 'bun:test';
import { Test } from '@nestjs/testing';
import { MemoryHealthIndicator } from '@nestjs/terminus';
import { HEALTH_DATABASE_POOL } from '@/health/database-health.service';
import type { Logger } from 'nestjs-pino';
import request from 'supertest';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { API_VERSION, configureApiRouting } from '@/config/api-routing';
import { SWAGGER_UI_PATH } from '@/config/swagger.config';
import { HealthModule } from '@/health/health.module';

const internalError =
  'postgres://private-user:private-password@private-host/db internal stack trace';
const query = mock<() => Promise<unknown>>(async () => []);
const release = mock();
const connect = mock(async () => ({ query, release }));
const checkHeap = mock(async () => ({ memory_heap: { status: 'up' } }));

describe('Health HTTP contract with real Terminus checks and a database driver mock', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [AppController],
      providers: [AppService],
    })
      .overrideProvider(HEALTH_DATABASE_POOL)
      .useValue({ connect, end: async () => {}, on: () => {} })
      .overrideProvider(MemoryHealthIndicator)
      .useValue({ checkHeap })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      createHttpAdapter(),
      { logger: false },
    );
    configureApiRouting(app);
    app.useGlobalFilters(
      new AllExceptionsFilter({ error: mock() } as unknown as Logger),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    query.mockClear();
    release.mockClear();
    connect.mockImplementation(async () => ({ query, release }));
    query.mockImplementation(async () => []);
    checkHeap.mockImplementation(async () => ({
      memory_heap: { status: 'up' },
    }));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns 200 only after PostgreSQL and heap checks succeed', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);
    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(checkHeap).toHaveBeenCalledWith('memory_heap', 300 * 1024 * 1024);
    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' }, memory_heap: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' }, memory_heap: { status: 'up' } },
    });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(release).toHaveBeenCalledWith(false);
  });

  it('returns sanitized 503 on database failure while root still returns identity', async () => {
    query.mockImplementation(async () => {
      throw new Error(internalError);
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);
    expect(response.body).toMatchObject({
      status: 'error',
      code: 'SERVICE_UNAVAILABLE',
      error: { database: { status: 'down', message: 'Database unavailable' } },
      details: { database: { status: 'down' }, memory_heap: { status: 'up' } },
    });
    expect(JSON.stringify(response.body)).not.toContain(internalError);
    expect(response.body.details.database).not.toHaveProperty('stack');
    expect(release).toHaveBeenCalledWith(true);
    await request(app.getHttpServer()).get('/api/v1').expect(200, {
      name: 'WasteWise API',
      apiVersion: API_VERSION,
      docs: SWAGGER_UI_PATH,
    });
    expect(query.mock.calls.length).toBe(1);
  });

  it('returns sanitized 503 when pool acquisition fails', async () => {
    connect.mockImplementation(async () => {
      throw new Error(internalError);
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);
    expect(response.body.error.database).toMatchObject({
      status: 'down',
      message: 'Database unavailable',
    });
    expect(JSON.stringify(response.body)).not.toContain(internalError);
    expect(release).not.toHaveBeenCalled();
  });

  it('returns 503 for a reported heap threshold violation', async () => {
    checkHeap.mockImplementation(async () => ({
      memory_heap: { status: 'down' },
    }));
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);
    expect(response.body.error.memory_heap).toEqual({
      status: 'down',
      message: 'Heap check failed',
    });
    expect(response.body.info.database.status).toBe('up');
  });

  it('keeps the heap dependency check and returns sanitized 503 when it fails', async () => {
    checkHeap.mockImplementation(async () => {
      throw new Error(internalError);
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);
    expect(response.body.error.memory_heap).toEqual({
      status: 'down',
      message: 'Heap check failed',
    });
    expect(response.body.info.database.status).toBe('up');
    expect(JSON.stringify(response.body)).not.toContain(internalError);
  });
});
