import { type MigrationInterface, type QueryRunner } from 'typeorm';
export class CheckoutQuantity1791102000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "maxPerOrder" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "maxPerUser" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "salesEndsAt" timestamptz(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "validityDays" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_events" ADD "maxPerOrder" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_events" ADD "maxPerUser" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_event_tickets" ADD "salesEndsAt" timestamptz(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD "maxPerOrder" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD "maxPerUser" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD "packageId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD "ticketTypeId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD "quantity" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD "requestFingerprint" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD "purchaseSnapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD "paymentState" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD "reservationReleasedAt" timestamptz(3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_order_items" ADD "unitIndex" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_order_items" ADD "benefitSnapshot" jsonb`,
    );
    await queryRunner.query(
      `CREATE TABLE "portal_commerce_outbox" ("id" serial PRIMARY KEY, "operationKey" varchar NOT NULL UNIQUE, "eventName" varchar NOT NULL, "payload" jsonb NOT NULL, "deliveredAt" timestamptz(3), "createdAt" timestamptz(3) NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_portal_vouchers_order_item" ON "portal_vouchers" ("orderItemId") WHERE "orderItemId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_portal_tickets_order_item" ON "portal_tickets" ("orderItemId") WHERE "orderItemId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD CONSTRAINT "FK_bundle_packageId" FOREIGN KEY ("packageId") REFERENCES "portal_coupon_packages"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" ADD CONSTRAINT "FK_bundle_ticketTypeId" FOREIGN KEY ("ticketTypeId") REFERENCES "portal_event_tickets"("id") ON DELETE RESTRICT`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" DROP CONSTRAINT "FK_bundle_packageId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_bundles" DROP CONSTRAINT "FK_bundle_ticketTypeId"`,
    );
    await queryRunner.query(`DROP INDEX "UQ_portal_vouchers_order_item"`);
    await queryRunner.query(`DROP INDEX "UQ_portal_tickets_order_item"`);
    await queryRunner.query(`DROP TABLE "portal_commerce_outbox"`);
    await queryRunner.query(
      `ALTER TABLE "portal_order_items" DROP "benefitSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_order_items" DROP "unitIndex"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" DROP "reservationReleasedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "portal_orders" DROP "paymentState"`);
    await queryRunner.query(
      `ALTER TABLE "portal_orders" DROP "purchaseSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" DROP "requestFingerprint"`,
    );
    await queryRunner.query(`ALTER TABLE "portal_orders" DROP "quantity"`);
    await queryRunner.query(`ALTER TABLE "portal_bundles" DROP "ticketTypeId"`);
    await queryRunner.query(`ALTER TABLE "portal_bundles" DROP "packageId"`);
    await queryRunner.query(`ALTER TABLE "portal_bundles" DROP "maxPerUser"`);
    await queryRunner.query(`ALTER TABLE "portal_bundles" DROP "maxPerOrder"`);
    await queryRunner.query(
      `ALTER TABLE "portal_event_tickets" DROP "salesEndsAt"`,
    );
    await queryRunner.query(`ALTER TABLE "portal_events" DROP "maxPerUser"`);
    await queryRunner.query(`ALTER TABLE "portal_events" DROP "maxPerOrder"`);
    await queryRunner.query(`ALTER TABLE "portal_coupons" DROP "validityDays"`);
    await queryRunner.query(`ALTER TABLE "portal_coupons" DROP "salesEndsAt"`);
    await queryRunner.query(`ALTER TABLE "portal_coupons" DROP "maxPerUser"`);
    await queryRunner.query(`ALTER TABLE "portal_coupons" DROP "maxPerOrder"`);
  }
}
