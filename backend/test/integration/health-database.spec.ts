import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createHttpAdapter } from '@/config/http';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configureApiRouting } from '@/config/api-routing';
import { HealthModule } from '@/health/health.module';
import {
  createHealthDatabasePool,
  HEALTH_DATABASE_POOL,
  HEALTH_POOL_SIZE,
  type HealthDatabasePool,
  type HealthDatabaseClient,
} from '@/health/database-health.service';

interface InspectablePool extends HealthDatabasePool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

describe('PostgreSQL health probes on a disposable database', () => {
  let db: DataSource;
  let pool: InspectablePool;
  let app: NestFastifyApplication;
  let sql = 'SELECT 1';
  let sqlState: string | undefined;

  beforeAll(async () => {
    if (
      process.env.NESTPLATE_TEST_MODE !== 'integration' ||
      process.env.DB_NAME !== 'nestplate_test' ||
      process.env.DB_HOST !== '127.0.0.1' ||
      process.env.DB_PORT !== '55439'
    ) {
      throw new Error('Dedicated disposable PostgreSQL on port 55439 required');
    }
    db = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: 'nestplate_test',
      synchronize: false,
      poolSize: 2,
    });
    await db.initialize();
    pool = createHealthDatabasePool(db) as InspectablePool;
    const module = await Test.createTestingModule({ imports: [HealthModule] })
      .overrideProvider(HEALTH_DATABASE_POOL)
      .useValue({
        connect: async (): Promise<HealthDatabaseClient> => {
          const client = await pool.connect();
          return {
            query: async () => {
              try {
                return await client.query(sql);
              } catch (error) {
                sqlState = (error as { code?: string }).code;
                throw error;
              }
            },
            release: (destroy?: boolean) => client.release(destroy),
            on: (event, listener) => client.on(event, listener),
          };
        },
        end: () => pool.end(),
      })
      .compile();
    app = module.createNestApplication<NestFastifyApplication>(
      createHttpAdapter(),
      { logger: false },
    );
    configureApiRouting(app);
    const { AllExceptionsFilter } =
      await import('@/common/filters/all-exceptions.filter');
    app.useGlobalFilters(new AllExceptionsFilter({ error: () => {} }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) await db.destroy();
  });

  async function assertNoSlowQuery() {
    const rows = await db.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE application_name = 'nestplate-health' AND state = 'active' AND query LIKE 'SELECT pg_sleep(10)%'",
    );
    expect(rows[0].count).toBe(0);
  }

  it('cancels a slow query on the server, releases the failed client and recovers', async () => {
    sql = 'SELECT pg_sleep(10) /* health-slow */';
    sqlState = undefined;
    const start = Date.now();
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(503);
    expect(Date.now() - start).toBeLessThan(2500);
    expect(sqlState).toBe('57014'); // PostgreSQL query_canceled, not a Promise race.
    expect(JSON.stringify(response.body)).not.toContain('pg_sleep');
    expect(pool.totalCount).toBe(0);
    expect(pool.waitingCount).toBe(0);
    await assertNoSlowQuery();
    sql = 'SELECT 1';
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(pool.idleCount).toBe(1);
  });

  it('bounds acquisition when the health pool is full and removes queued waiters', async () => {
    const clients = await Promise.all(
      Array.from({ length: HEALTH_POOL_SIZE }, () => pool.connect()),
    );
    try {
      const start = Date.now();
      await request(app.getHttpServer()).get('/api/v1/health').expect(503);
      expect(Date.now() - start).toBeLessThan(2500);
      expect(pool.waitingCount).toBe(0);
      expect(pool.totalCount).toBe(HEALTH_POOL_SIZE);
    } finally {
      clients.forEach((client) => client.release());
    }
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('bounds concurrent slow probes without leaking clients or background queries', async () => {
    sql = 'SELECT pg_sleep(10) /* health-slow */';
    try {
      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app.getHttpServer()).get('/api/v1/health'),
        ),
      );
      expect(responses.every((response) => response.status === 503)).toBe(true);
      expect(pool.waitingCount).toBe(0);
      expect(pool.totalCount).toBe(0);
      await assertNoSlowQuery();
    } finally {
      sql = 'SELECT 1';
    }
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('survives a terminated probe connection and recovers with a fresh client', async () => {
    sql = 'SELECT pg_sleep(10) /* health-slow */';
    const pending = request(app.getHttpServer())
      .get('/api/v1/health')
      .then((response) => response);
    try {
      let pid: number | undefined;
      const deadline = Date.now() + 700;
      while (!pid && Date.now() < deadline) {
        const rows = await db.query(
          "SELECT pid FROM pg_stat_activity WHERE application_name = 'nestplate-health' AND state = 'active' AND query LIKE 'SELECT pg_sleep(10)%'",
        );
        pid = rows[0]?.pid;
        if (!pid) await Bun.sleep(10);
      }
      expect(pid).toBeDefined();
      await db.query('SELECT pg_terminate_backend($1)', [pid]);
      const response = await pending;
      expect(response.status).toBe(503);
      expect(response.body.error.database.message).toBe('Database unavailable');
      expect(pool.totalCount).toBe(0);
      await assertNoSlowQuery();
    } finally {
      sql = 'SELECT 1';
      await pending;
    }
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('keeps timeouts confined to probe connections and leaves business sessions usable', async () => {
    const client = await pool.connect();
    try {
      const result = (await client.query('SHOW statement_timeout')) as {
        rows: Array<{ statement_timeout: string }>;
      };
      expect(result.rows[0].statement_timeout).toBe('1s');
    } finally {
      client.release();
    }
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const nextClient = await pool.connect();
    try {
      const result = (await nextClient.query('SHOW statement_timeout')) as {
        rows: Array<{ statement_timeout: string }>;
      };
      expect(result.rows[0].statement_timeout).toBe('1s');
    } finally {
      nextClient.release();
    }
    const business = await db.query('SHOW statement_timeout');
    expect(business[0].statement_timeout).toBe('0');
    await db.query('SELECT pg_sleep(1.1)');
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('measures connectivity independently of exhaustion in the business pool', async () => {
    const runners = [db.createQueryRunner(), db.createQueryRunner()];
    try {
      await Promise.all(runners.map((runner) => runner.connect()));
      await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    } finally {
      await Promise.all(runners.map((runner) => runner.release()));
    }
    expect(await db.query('SELECT 1 AS result')).toEqual([{ result: 1 }]);
  });
});
