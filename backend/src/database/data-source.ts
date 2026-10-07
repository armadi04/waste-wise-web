import './business-time.config';
import { join } from 'path';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run/revert).
 * The Nest app configures its own connection in `app.module.ts`; this mirrors
 * it for tooling. Entities/migrations are globbed (entities use relative
 * imports, so no `@/` alias resolution is needed under Bun).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  useUTC: true,
  extra: { options: '-c timezone=UTC' },
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});
