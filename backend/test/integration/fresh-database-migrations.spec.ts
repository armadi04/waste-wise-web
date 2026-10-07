import { describe, expect, it } from 'bun:test';
import { DataSource } from 'typeorm';
import { AppDataSource } from '@/database/data-source';

// Run only against a newly provisioned, disposable kuponmalam_test database.
// This test deliberately never resets, synchronizes or seeds a database.
describe('fresh database migration chain', () => {
  it('creates the entity schema, applies live indexes, and skips already recorded migrations', async () => {
    if (process.env.DB_NAME !== 'kuponmalam_test')
      throw new Error('Dedicated fresh test database required');
    if (process.env.LEGACY_TIMESTAMP_TIME_ZONE !== 'UTC')
      throw new Error(
        'Historical timezone migration requires UTC acknowledgement',
      );
    const db = new DataSource({
      ...AppDataSource.options,
      synchronize: false,
      logging: false,
    });
    await db.initialize();
    try {
      const tables = await db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      if (tables.length)
        throw new Error('Refusing migration test on a nonempty database');
      const applied = await db.runMigrations();
      expect(applied.length).toBe(db.migrations.length);
      const names = applied.map((migration) => migration.name);
      expect(
        names.indexOf('NormalizeLegacyCommerceIndexes1791219000000'),
      ).toBeLessThan(
        names.indexOf('PartialUniqueIndexesForSoftDelete1791220000000'),
      );
      expect(await db.runMigrations()).toHaveLength(0);
      const indexes = await db.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('portal_bookings', 'portal_reviews', 'portal_booking_slots')`,
      );
      for (const name of [
        'UQ_portal_bookings_user_slot',
        'UQ_portal_reviews_user_target',
        'UQ_portal_booking_slots_event_start',
      ]) {
        expect(
          indexes.find(
            (index: { indexname: string }) => index.indexname === name,
          )?.indexdef,
        ).toContain('WHERE ("deletedAt" IS NULL)');
      }
      for (const name of [
        'IDX_portal_bookings_user_slot',
        'IDX_b05ede3628ea44537636d75ef7',
        'IDX_portal_reviews_user_target',
        'IDX_cd50e691ec9059e1c3e2d9b0e0',
        'IDX_portal_booking_slots_event_startsAt',
        'IDX_f5b0c2c6953556480d4b00e78a',
      ])
        expect(
          indexes.some(
            (index: { indexname: string }) => index.indexname === name,
          ),
        ).toBe(false);
      const runner = db.createQueryRunner();
      try {
        for (const metadata of db.entityMetadatas) {
          const table = await runner.getTable(`public.${metadata.tableName}`);
          expect(table, metadata.tableName).toBeDefined();
          expect(
            table!.columns.map((column) => column.name).sort(),
            metadata.tableName,
          ).toEqual(
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
