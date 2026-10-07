import { describe, expect, it } from 'bun:test';
import { DataSource } from 'typeorm';
import { AppDataSource } from '@/database/data-source';

// Optional integration verification, only on a new disposable database.
describe('starter baseline', () => {
  it('creates only core tables and applies live email uniqueness', async () => {
    if (process.env.DB_NAME !== 'nestplate_test')
      throw new Error('Dedicated fresh test database required');
    const db = new DataSource({
      ...AppDataSource.options,
      synchronize: false,
      logging: false,
    });
    await db.initialize();
    try {
      const tables = await db.query<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      if (tables.length)
        throw new Error('Refusing migration test on a nonempty database');
      expect(await db.runMigrations()).toHaveLength(db.migrations.length);
      expect(await db.runMigrations()).toHaveLength(0);
      const indexes = await db.query<
        Array<{ indexname: string; indexdef: string }>
      >(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'users'`,
      );
      expect(
        indexes.find((index) => index.indexname === 'UQ_users_email_active')
          ?.indexdef,
      ).toContain('lower');
      const runner = db.createQueryRunner();
      try {
        for (const metadata of db.entityMetadatas) {
          expect(metadata.tableName.startsWith('portal_')).toBe(false);
          const table = await runner.getTable(`public.${metadata.tableName}`);
          expect(table?.columns.map((column) => column.name).sort()).toEqual(
            metadata.columns.map((column) => column.databaseName).sort(),
          );
        }
      } finally {
        await runner.release();
      }
    } finally {
      await db.destroy();
    }
  }, 30000);
});
