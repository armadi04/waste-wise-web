import { describe, expect, it } from 'bun:test';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '@/database/data-source';
import { PartialUniqueIndexesForSoftDelete1791220000000 } from '@/database/migrations/1791220000000-PartialUniqueIndexesForSoftDelete';
import { NormalizeLegacyCommerceIndexes1791219000000 } from '@/database/migrations/1791219000000-NormalizeLegacyCommerceIndexes';
import { AddCommerceOutboxDeadLetter1791221000000 } from '@/database/migrations/1791221000000-AddCommerceOutboxDeadLetter';

// Service-level SQL verification; no HTTP harness or application database writes.
describe('commerce hardening migrations in PostgreSQL', () => {
  it.each(['migrations', 'synchronize', 'both'] as const)(
    'supports %s indexes, up/down, deleted-key reuse and outbox defaults',
    async (origin) => {
      if (process.env.DB_NAME !== 'kuponmalam_test')
        throw new Error('Dedicated test database required');
      const db = new DataSource({
        ...AppDataSource.options,
        database: 'kuponmalam_test',
        entities: [],
        migrations: [],
        synchronize: false,
      });
      await db.initialize();
      const runner = db.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        const schema = `hardening_${randomUUID().replaceAll('-', '')}`;
        await runner.query(`CREATE SCHEMA "${schema}"`);
        await runner.query(`SET LOCAL search_path TO "${schema}"`);
        await runner.query(
          `CREATE TABLE users (id serial PRIMARY KEY, email text, "deletedAt" timestamptz, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email))`,
        );
        await runner.query(
          `CREATE TABLE roles (name text, "deletedAt" timestamptz, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name))`,
        );
        for (const [table, columns, generated, legacy] of [
          [
            'portal_bookings',
            '"userId" integer, "slotId" integer',
            'IDX_b05ede3628ea44537636d75ef7',
            'IDX_portal_bookings_user_slot',
          ],
          [
            'portal_reviews',
            '"userId" integer, "targetType" text, "targetKey" text',
            'IDX_cd50e691ec9059e1c3e2d9b0e0',
            'IDX_portal_reviews_user_target',
          ],
          [
            'portal_booking_slots',
            '"eventId" integer, "startsAt" timestamptz',
            'IDX_f5b0c2c6953556480d4b00e78a',
            'IDX_portal_booking_slots_event_startsAt',
          ],
        ]) {
          await runner.query(
            `CREATE TABLE "${table}" (${columns}, "deletedAt" timestamptz)`,
          );
          const keys = columns
            .split(', ')
            .map((column) => column.split(' ')[0])
            .join(', ');
          for (const index of origin === 'both'
            ? [legacy, generated]
            : [origin === 'migrations' ? legacy : generated]) {
            await runner.query(
              `CREATE UNIQUE INDEX "${index}" ON "${table}" (${keys})`,
            );
          }
        }
        await runner.query(
          'CREATE TABLE portal_commerce_outbox (id serial PRIMARY KEY)',
        );
        const compatibility = new NormalizeLegacyCommerceIndexes1791219000000();
        if (origin !== 'both') {
          const name =
            origin === 'migrations'
              ? 'IDX_portal_bookings_user_slot'
              : 'IDX_b05ede3628ea44537636d75ef7';
          await runner.query(
            `ALTER INDEX "${name}" RENAME TO "unexpected_booking_index"`,
          );
          await expect(compatibility.up(runner)).rejects.toThrow(
            'Missing legacy unique index',
          );
          await runner.query(
            `ALTER INDEX "unexpected_booking_index" RENAME TO "${name}"`,
          );
          await runner.query(`DROP INDEX "${name}"`);
          await runner.query(
            `CREATE INDEX "${name}" ON portal_bookings ("userId", "slotId")`,
          );
          await expect(compatibility.up(runner)).rejects.toThrow(
            'Unexpected definition',
          );
          await runner.query(`DROP INDEX "${name}"`);
          await runner.query(
            `CREATE UNIQUE INDEX "${name}" ON portal_bookings ("userId", "slotId")`,
          );
        }
        await compatibility.up(runner);
        const unique = new PartialUniqueIndexesForSoftDelete1791220000000();
        const outbox = new AddCommerceOutboxDeadLetter1791221000000();
        await runner.query(
          `INSERT INTO users(email) VALUES ('Test@example.test'), ('test@example.test')`,
        );
        await expect(unique.up(runner)).rejects.toThrow(
          'Merge or delete accounts',
        );
        await runner.query('DELETE FROM users');
        await unique.up(runner);
        await outbox.up(runner);
        // Simulate already-upgraded deployments with redundant explicit legacy indexes.
        for (const [name, table, columns] of [
          [
            'IDX_portal_bookings_user_slot',
            'portal_bookings',
            '"userId", "slotId"',
          ],
          [
            'IDX_portal_reviews_user_target',
            'portal_reviews',
            '"userId", "targetType", "targetKey"',
          ],
          [
            'IDX_portal_booking_slots_event_startsAt',
            'portal_booking_slots',
            '"eventId", "startsAt"',
          ],
        ]) {
          await runner.query(
            `CREATE UNIQUE INDEX "${name}" ON "${table}" (${columns})`,
          );
        }
        // Applying and reverting compatibility must keep existing partial uniqueness intact.
        await compatibility.up(runner);
        await compatibility.down(runner);
        await runner.query(
          `INSERT INTO users(email) VALUES ('Test@example.test')`,
        );
        await runner.query('SAVEPOINT duplicate');
        try {
          await runner.query(
            `INSERT INTO users(email) VALUES ('test@example.test')`,
          );
          throw new Error('Case-only duplicate accepted');
        } catch (error: any) {
          expect(error.code).toBe('23505');
        } finally {
          await runner.query('ROLLBACK TO SAVEPOINT duplicate');
        }
        await runner.query('UPDATE users SET "deletedAt" = now()');
        await runner.query(
          `INSERT INTO users(email) VALUES ('Test@example.test')`,
        );
        for (const [table, columns, values] of [
          ['roles', 'name', "'Customer'"],
          ['portal_bookings', '"userId", "slotId"', '1, 1'],
          [
            'portal_reviews',
            '"userId", "targetType", "targetKey"',
            "1, 'event', 'test'",
          ],
          [
            'portal_booking_slots',
            '"eventId", "startsAt"',
            "1, '2027-01-01T00:00:00Z'",
          ],
        ]) {
          await runner.query(
            `INSERT INTO "${table}" (${columns}, "deletedAt") VALUES (${values}, now()), (${values}, NULL)`,
          );
          expect(
            (
              await runner.query(
                `SELECT count(*)::int AS count FROM "${table}"`,
              )
            )[0].count,
          ).toBe(2);
        }
        expect(
          (
            await runner.query(
              'INSERT INTO portal_commerce_outbox DEFAULT VALUES RETURNING attempts, "lastError", "failedAt"',
            )
          )[0],
        ).toMatchObject({ attempts: 0, lastError: null, failedAt: null });
        // Old global keys require removing fixture duplicates before rollback.
        for (const table of [
          'users',
          'roles',
          'portal_bookings',
          'portal_reviews',
          'portal_booking_slots',
        ])
          await runner.query(
            `DELETE FROM "${table}" WHERE "deletedAt" IS NOT NULL`,
          );
        await outbox.down(runner);
        await unique.down(runner);
        await compatibility.down(runner);
        const restored = await runner.getTable(`${schema}.portal_bookings`);
        expect(
          restored?.indices.some(
            (index) => index.name === 'IDX_portal_bookings_user_slot',
          ),
        ).toBe(true);
        await compatibility.up(runner);
        await unique.up(runner);
        expect(
          (
            await runner.query(
              `SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'portal_commerce_outbox'`,
              [schema],
            )
          )[0].count,
        ).toBe(1);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
        await db.destroy();
      }
    },
  );
});
