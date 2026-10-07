import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompletePortalCheckout1791101000000 implements MigrationInterface {
  name = 'CompletePortalCheckout1791101000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "portal_order_items"
      ADD COLUMN "packageId" integer,
      ADD COLUMN "packageSnapshot" jsonb,
      ADD CONSTRAINT "FK_order_item_coupon_package" FOREIGN KEY ("packageId")
        REFERENCES "portal_coupon_packages"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "portal_orders"
      ADD COLUMN "paymentExpiresAt" timestamptz(3),
      ADD COLUMN "virtualAccount" jsonb`);
    await queryRunner.query(`CREATE INDEX "IDX_portal_orders_payment_deadline"
      ON "portal_orders" ("paymentExpiresAt") WHERE "status" = 'Pending'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_portal_orders_payment_deadline"');
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN "virtualAccount", DROP COLUMN "paymentExpiresAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_order_items" DROP CONSTRAINT "FK_order_item_coupon_package", DROP COLUMN "packageSnapshot", DROP COLUMN "packageId"',
    );
  }
}
