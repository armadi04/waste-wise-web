import type { MigrationInterface, QueryRunner } from 'typeorm';

const PERMISSIONS = [
  ['portal.coupon_categories.create', 'Create portal coupon categories'],
  ['portal.coupon_categories.read', 'Read portal coupon categories'],
  ['portal.coupon_categories.update', 'Update portal coupon categories'],
  ['portal.coupon_categories.delete', 'Delete portal coupon categories'],
  ['portal.cities.create', 'Create portal cities'],
  ['portal.cities.read', 'Read portal cities'],
  ['portal.cities.update', 'Update portal cities'],
  ['portal.cities.delete', 'Delete portal cities'],
  ['portal.content.read', 'Read portal site content'],
  ['portal.content.update', 'Edit and publish portal site content'],
  ['portal.broadcasts.read', 'Read portal customer broadcasts'],
  ['portal.broadcasts.create', 'Send portal customer broadcasts'],
] as const;

/** Provisions catalog/content permissions for superadmin; production skips the seeder. */
export class AddPortalCatalogContentPermissions1791182000000 implements MigrationInterface {
  name = 'AddPortalCatalogContentPermissions1791182000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, description] of PERMISSIONS)
      await queryRunner.query(
        `INSERT INTO "permissions" ("name", "description") VALUES ($1, $2)
         ON CONFLICT ("name") DO UPDATE SET "deletedAt" = NULL`,
        [name, description],
      );
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
    for (const table of ['role_permissions', 'user_permissions'])
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "permissionId" IN
         (SELECT "id" FROM "permissions" WHERE "name" = ANY($1))`,
        [names],
      );
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" = ANY($1)`,
      [names],
    );
  }
}
