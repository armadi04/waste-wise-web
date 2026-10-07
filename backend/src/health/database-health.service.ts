import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { HealthIndicatorResult } from '@nestjs/terminus';
import pg from 'pg';
import type { DataSource } from 'typeorm';

export const HEALTH_DATABASE_POOL = Symbol('HEALTH_DATABASE_POOL');
export const HEALTH_CONNECT_TIMEOUT_MS = 1000;
export const HEALTH_STATEMENT_TIMEOUT_MS = 1000;
export const HEALTH_QUERY_TIMEOUT_MS = 1500;
export const HEALTH_POOL_SIZE = 2;

// pg is already installed by the application; its package has no bundled typings.
export interface HealthDatabaseClient {
  query(sql: string): Promise<unknown>;
  release(destroy?: boolean): void;
  on(event: 'error', listener: () => void): void;
}
export interface HealthDatabasePool {
  connect(): Promise<HealthDatabaseClient>;
  end(): Promise<void>;
  on(event: 'error', listener: () => void): void;
  on(event: 'connect', listener: (client: HealthDatabaseClient) => void): void;
}

export function createHealthDatabasePool(
  dataSource: DataSource,
): HealthDatabasePool {
  const options = dataSource.options;
  if (options.type !== 'postgres')
    throw new Error('Health probes require PostgreSQL');
  const Pool = (
    pg as unknown as { Pool: new (options: object) => HealthDatabasePool }
  ).Pool;
  const pool = new Pool({
    host: options.host,
    port: options.port,
    user: options.username,
    password: options.password,
    database: options.database,
    ssl: options.ssl,
    application_name: 'nestplate-health',
    max: HEALTH_POOL_SIZE,
    connectionTimeoutMillis: HEALTH_CONNECT_TIMEOUT_MS,
    statement_timeout: HEALTH_STATEMENT_TIMEOUT_MS,
    // Transport fallback; a failed client is destroyed, never returned for reuse.
    query_timeout: HEALTH_QUERY_TIMEOUT_MS,
    idleTimeoutMillis: 10000,
    options: '-c timezone=UTC',
  });
  pool.on('error', () => undefined);
  // Checked-out clients also emit errors during a server/network disconnect.
  pool.on('connect', (client) => client.on('error', () => undefined));
  return pool;
}

@Injectable()
export class DatabaseHealthService implements OnModuleDestroy {
  constructor(
    @Inject(HEALTH_DATABASE_POOL) private readonly pool: HealthDatabasePool,
  ) {}

  async check(): Promise<HealthIndicatorResult> {
    let client: HealthDatabaseClient | undefined;
    let failed = true;
    const start = Date.now();
    try {
      client = await this.pool.connect();
      await client.query('SELECT 1');
      failed = false;
      return { database: { status: 'up', responseTime: Date.now() - start } };
    } catch {
      return {
        database: {
          status: 'down',
          message: 'Database unavailable',
          responseTime: Date.now() - start,
        },
      };
    } finally {
      client?.release(failed);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
