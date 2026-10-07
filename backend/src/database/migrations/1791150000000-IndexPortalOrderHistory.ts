import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexPortalOrderHistory1791150000000 implements MigrationInterface {
  name = 'IndexPortalOrderHistory1791150000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_orders_user_history" ON "portal_orders" ("userId", "createdAt", "id") WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_portal_orders_user_history"`);
  }
}
