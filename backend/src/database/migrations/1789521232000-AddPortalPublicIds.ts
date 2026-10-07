import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const tables = [
  'portal_coupons',
  'portal_events',
  'portal_event_tickets',
  'portal_bundles',
  'portal_campaigns',
  'portal_faqs',
  'portal_vouchers',
  'portal_tickets',
  'portal_orders',
  'portal_order_items',
  'portal_follows',
  'portal_campaign_progress',
] as const;

const isIdRow = (value: unknown): value is { id: number } =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof value.id === 'number';

export class AddPortalPublicIds1789521232000 implements MigrationInterface {
  name = 'AddPortalPublicIds1789521232000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of tables) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "publicId" uuid`,
      );

      const rows: unknown = await queryRunner.query(
        `SELECT "id" FROM "${table}" WHERE "publicId" IS NULL`,
      );
      if (!Array.isArray(rows)) {
        throw new Error(`Could not read existing rows from ${table}`);
      }
      for (const row of rows as Array<unknown>) {
        if (!isIdRow(row)) {
          throw new Error(`Invalid row returned while backfilling ${table}`);
        }
        await queryRunner.query(
          `UPDATE "${table}" SET "publicId" = $1 WHERE "id" = $2`,
          [randomUUID(), row.id],
        );
      }

      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "publicId" SET NOT NULL`,
      );
      await queryRunner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_${table}_publicId" ON "${table}" ("publicId")`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...tables].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_publicId"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "publicId"`,
      );
    }
  }
}
