import type { MigrationInterface, QueryRunner } from 'typeorm';

const ACTIONS = [
  [
    'portal.vouchers.redeem',
    'Redeem portal vouchers by id or QR scan',
    'portal.vouchers.update',
  ],
  [
    'portal.tickets.check_in',
    'Check in portal tickets by id or QR scan',
    'portal.tickets.update',
  ],
  [
    'portal.orders.refund',
    'Approve or reject portal order refunds',
    'portal.orders.update',
  ],
  [
    'portal.campaign_progress.adjust',
    'Adjust portal campaign points through the ledger',
    'portal.campaign_progress.update',
  ],
] as const;

const UNSUPPORTED = ['portal.reviews.create', 'portal.bookings.create'];

/**
 * Pass, refund and points actions used to share the record `.update`
 * permission. Production skips the seeder, so the dedicated permissions are
 * inserted here and granted to every role/user that held the old one, keeping
 * existing access intact. Unused create permissions guarded no route.
 */
export class AddPortalActionPermissions1791160000000 implements MigrationInterface {
  name = 'AddPortalActionPermissions1791160000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, description, source] of ACTIONS) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("name", "description") VALUES ($1, $2)
         ON CONFLICT ("name") DO UPDATE SET "deletedAt" = NULL`,
        [name, description],
      );
      for (const table of ['role_permissions', 'user_permissions']) {
        const owner = table === 'role_permissions' ? 'roleId' : 'userId';
        await queryRunner.query(
          `INSERT INTO "${table}" ("${owner}", "permissionId")
           SELECT grant_row."${owner}", target."id"
           FROM "${table}" grant_row
           JOIN "permissions" source ON source."id" = grant_row."permissionId"
           CROSS JOIN "permissions" target
           WHERE source."name" = $1 AND target."name" = $2
           ON CONFLICT DO NOTHING`,
          [source, name],
        );
      }
    }
    for (const table of ['role_permissions', 'user_permissions']) {
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "permissionId" IN
         (SELECT "id" FROM "permissions" WHERE "name" = ANY($1))`,
        [UNSUPPORTED],
      );
    }
    await queryRunner.query(
      `UPDATE "permissions" SET "deletedAt" = now()
       WHERE "name" = ANY($1) AND "deletedAt" IS NULL`,
      [UNSUPPORTED],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "permissions" SET "deletedAt" = NULL WHERE "name" = ANY($1)`,
      [UNSUPPORTED],
    );
    const names = ACTIONS.map(([name]) => name);
    for (const table of ['role_permissions', 'user_permissions']) {
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "permissionId" IN
         (SELECT "id" FROM "permissions" WHERE "name" = ANY($1))`,
        [names],
      );
    }
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = ANY($1)`,
      [names],
    );
  }
}
