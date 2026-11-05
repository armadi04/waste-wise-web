import { describe, expect, it } from 'bun:test';
import { DataSource } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { VersionMediaUrls1791350000000 } from '@/database/migrations/1791350000000-VersionMediaUrls';

describe('media URI migration on a disposable database', () => {
  it('updates only verified application view URLs and safely rolls back', async () => {
    if (process.env.DB_NAME !== 'nestplate_test')
      throw new Error('Dedicated fresh test database required');
    const db = new DataSource({
      ...AppDataSource.options,
      synchronize: false,
      logging: false,
    });
    await db.initialize();
    const runner = db.createQueryRunner();
    try {
      const tables = await db.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      if (tables.length)
        throw new Error('Refusing migration test on a nonempty database');
      const migration = new VersionMediaUrls1791350000000();
      (db as { migrations: typeof db.migrations }).migrations =
        db.migrations.filter((item) => item.name !== migration.name);
      await db.runMigrations();
      const origin = process.env.APP_URL;
      try {
        delete process.env.APP_URL;
        await expect(migration.up(runner)).rejects.toThrow('explicit APP_URL');
        process.env.APP_URL = 'https://app.example.test/unverified-base';
        await expect(migration.up(runner)).rejects.toThrow('HTTP(S) origin');
      } finally {
        process.env.APP_URL = origin;
      }
      const urls: Array<string | null> = [
        'http://localhost:3001/api/media/1/view',
        'http://localhost:3001/api/media/2/view?filename=a%20b.pdf&token=x%2Fy#page=2',
        'http://LOCALHOST:3001/api/media/3/view#original',
        'http://localhost:3001/api/v1/media/4/view',
        'https://cdn.example.test/api/media/5/view?filename=external.pdf#keep',
        'http://localhost.example.test:3001/api/media/6/view',
        'http://localhost:3001/api/media/7/view/filename.pdf',
        null,
        'http://localhost:3001/api/media/1/view',
        'http://localhost:3001/api/media/10/stream',
        'http://localhost:3001/api/media/11/view/extra',
        '//localhost:3001/api/media/12/view',
        'http://user@localhost:3001/api/media/13/view',
        'http://localhost:3001/other?next=/api/media/14/view',
        'http://localhost:3001/api/media/%31%35/view',
        'http://localhost:3001/api/v1/media/16/view?file=unchanged.pdf#keep',
      ];
      for (const [index, url] of urls.entries()) {
        await runner.query(
          `INSERT INTO "media" ("id", "filename", "originalName", "mimetype", "provider", "storageProfile", "path", "url") VALUES ($1, 'original.pdf', 'original.pdf', 'application/pdf', 's3', 's3-default', 'unchanged/key', $2)`,
          [index + 1, url],
        );
      }
      await runner.query(
        `UPDATE "media" SET "deletedAt" = now() WHERE "id" = 3`,
      );
      await runner.query(
        `INSERT INTO "users" ("email", "password", "avatarId") VALUES ('avatar@example.test', 'fixture-only', 2)`,
      );
      const read = async () =>
        (await runner.query(
          'SELECT "id", "url", "filename", "path" FROM "media" ORDER BY "id"',
        )) as Array<{
          id: number;
          url: string | null;
          filename: string;
          path: string;
        }>;
      const before = await read();
      db.migrations.push(migration);
      expect(await db.runMigrations()).toHaveLength(1);
      const after = await read();
      expect(
        after.filter((row, index) => row.url !== before[index].url),
      ).toHaveLength(3);
      for (const [index, row] of after.entries()) {
        expect(row.url).toBe(
          index < 3
            ? urls[index]!.replace('/api/media/', '/api/v1/media/')
            : urls[index],
        );
        expect(row.filename).toBe(before[index].filename);
        expect(row.path).toBe(before[index].path);
      }
      expect(
        (
          await runner.query(
            `SELECT m."url" FROM "users" u JOIN "media" m ON m."id" = u."avatarId"`,
          )
        )[0].url,
      ).toBe(after[1].url);
      expect(
        (
          await runner.query(
            'SELECT count(*)::int AS count FROM api_migration_backup.media_v1_urls',
          )
        )[0].count,
      ).toBe(3);
      expect(await db.runMigrations()).toHaveLength(0);
      await migration.up(runner);
      expect(await read()).toEqual(after);

      // A write after migration must never be overwritten by rollback.
      await runner.query('UPDATE "media" SET "url" = $1 WHERE "id" = 2', [
        'https://cdn.example.test/replacement.pdf',
      ]);
      await expect(db.undoLastMigration()).rejects.toThrow('rollback blocked');
      expect((await read())[0].url).toBe(after[0].url);
      expect(
        (
          await runner.query(
            'SELECT count(*)::int AS count FROM api_migration_backup.media_v1_urls',
          )
        )[0].count,
      ).toBe(3);
      await runner.query('UPDATE "media" SET "url" = $1 WHERE "id" = 2', [
        after[1].url,
      ]);
      await db.undoLastMigration();
      expect(await read()).toEqual(before);
      expect(
        (
          await runner.query(
            "SELECT to_regclass('api_migration_backup.media_v1_urls') AS backup",
          )
        )[0].backup,
      ).toBeNull();
      // Leave the disposable database at the current schema for contract checks.
      expect(await db.runMigrations()).toHaveLength(1);
    } finally {
      await runner.release();
      await db.destroy();
    }
  }, 30000);
});
