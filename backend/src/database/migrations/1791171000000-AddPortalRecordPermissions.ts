import type { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  ['portal.customers.read', 'Read portal customers'],
  ['portal.gifts.read', 'Read portal gifts'],
  ['portal.gifts.revoke', 'Revoke unredeemed portal gifts'],
  ['portal.referrals.read', 'Read portal referrals'],
  ['portal.wallets.read', 'Read portal wallets'],
  ['portal.wallets.adjust', 'Manually adjust portal wallet balances'],
  ['portal.wallet_transactions.read', 'Read portal wallet transactions'],
  ['portal.saved_offers.read', 'Read portal saved offers'],
  ['portal.campaign_ledger.read', 'Read the portal campaign points ledger'],
  ['portal.commerce_outbox.read', 'Read the portal commerce event outbox'],
] as const;

/**
 * Production skips the seeder, so admin data-view permissions are provisioned
 * here and granted to superadmin only; other roles opt in through role admin.
 */
export class AddPortalRecordPermissions1791171000000 implements MigrationInterface {
  name = 'AddPortalRecordPermissions1791171000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, description] of PERMISSIONS) {
      await queryRunner.query(
        `INSERT INTO "permissions" ("name", "description") VALUES ($1, $2)
         ON CONFLICT ("name") DO UPDATE SET "deletedAt" = NULL`,
        [name, description],
      );
    }
    await queryRunner.query(
      `INSERT INTO "role_permissions" ("roleId", "permissionId")
       SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
       WHERE r."name" = 'superadmin' AND p."name" = ANY($1)
       ON CONFLICT DO NOTHING`,
      [PERMISSIONS.map(([name]) => name)],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const names = PERMISSIONS.map(([name]) => name);
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
