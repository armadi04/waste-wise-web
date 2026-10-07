import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalRefundRequests1789614000000 implements MigrationInterface {
  name = 'AddPortalRefundRequests1789614000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "refundReason" character varying(500)',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "refundRequestedAt" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "refundRequestedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "refundReason"',
    );
  }
}
