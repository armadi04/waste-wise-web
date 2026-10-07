import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalPaymentLifecycle1789613000000 implements MigrationInterface {
  name = 'AddPortalPaymentLifecycle1789613000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "paymentReference" character varying(120)',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "refundStatus" character varying(32)',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "refundedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "refundStatus"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "paymentReference"',
    );
  }
}
