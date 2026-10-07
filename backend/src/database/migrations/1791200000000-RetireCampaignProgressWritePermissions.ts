import type { MigrationInterface, QueryRunner } from 'typeorm';

const RETIRED = [
  'portal.campaign_progress.create',
  'portal.campaign_progress.update',
  'portal.campaign_progress.delete',
];

/**
 * Campaign progress is written only through the points ledger
 * (`portal.campaign_progress.adjust`); the generic create/update/delete routes
 * always answered 409 and were removed, so their permissions guard nothing.
 * Grants are dropped and the permissions soft-deleted; down restores the
 * permission rows only (grants were meaningless).
 */
export class RetireCampaignProgressWritePermissions1791200000000 implements MigrationInterface {
  name = 'RetireCampaignProgressWritePermissions1791200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['role_permissions', 'user_permissions'])
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "permissionId" IN
         (SELECT "id" FROM "permissions" WHERE "name" = ANY($1))`,
        [RETIRED],
      );
    await queryRunner.query(
      `UPDATE "permissions" SET "deletedAt" = now()
       WHERE "name" = ANY($1) AND "deletedAt" IS NULL`,
      [RETIRED],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "permissions" SET "deletedAt" = NULL WHERE "name" = ANY($1)`,
      [RETIRED],
    );
  }
}
