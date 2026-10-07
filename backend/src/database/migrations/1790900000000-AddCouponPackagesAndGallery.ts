import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCouponPackagesAndGallery1790900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "images" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `UPDATE "portal_coupons" SET "images" = jsonb_build_array(jsonb_build_object('url', "imageUrl", 'alt', "title"))`,
    );
    await queryRunner.query(`CREATE TABLE "portal_coupon_packages" (
      "id" SERIAL PRIMARY KEY, "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "couponId" integer NOT NULL REFERENCES "portal_coupons"("id"),
      "name" varchar(180) NOT NULL, "benefits" text NOT NULL,
      "price" integer NOT NULL, "oldPrice" integer,
      "stockTotal" integer NOT NULL, "stockRemaining" integer NOT NULL,
      "position" integer NOT NULL DEFAULT 0, "active" boolean NOT NULL DEFAULT true,
      "isDefault" boolean NOT NULL DEFAULT false,
      "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "deletedAt" timestamptz,
      CONSTRAINT "CHK_coupon_package_stock" CHECK ("stockTotal" >= 0 AND "stockRemaining" >= 0 AND "stockRemaining" <= "stockTotal"),
      CONSTRAINT "CHK_coupon_package_price" CHECK ("price" >= 0 AND ("oldPrice" IS NULL OR "oldPrice" >= 0))
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupon_package_public" ON "portal_coupon_packages" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_package_order" ON "portal_coupon_packages" ("couponId", "position")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_coupon_package_default" ON "portal_coupon_packages" ("couponId") WHERE "isDefault" = true`,
    );
    await queryRunner.query(
      `INSERT INTO "portal_coupon_packages" ("couponId", "name", "benefits", "price", "oldPrice", "stockTotal", "stockRemaining", "isDefault") SELECT "id", "title", "benefits", "price", "oldPrice", "stockTotal", "stockRemaining", true FROM "portal_coupons"`,
    );
    for (const table of ['portal_vouchers', 'portal_gifts']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD "packageId" integer REFERENCES "portal_coupon_packages"("id"), ADD "packageSnapshot" jsonb`,
      );
      await queryRunner.query(
        `UPDATE "${table}" r SET "packageId" = p."id", "packageSnapshot" = jsonb_build_object('publicId', p."publicId", 'name', p."name", 'benefits', p."benefits", 'price', p."price") FROM "portal_coupon_packages" p WHERE p."couponId" = r."couponId" AND p."isDefault" = true`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_${table}_package" ON "${table}" ("packageId")`,
      );
    }
    await queryRunner.query(
      `CREATE INDEX "IDX_coupon_package_claim" ON "portal_vouchers" ("userId", "couponId", "packageId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_coupon_package_claim"`);
    for (const table of ['portal_vouchers', 'portal_gifts']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN "packageId", DROP COLUMN "packageSnapshot"`,
      );
    }
    await queryRunner.query(`DROP TABLE "portal_coupon_packages"`);
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" DROP COLUMN "images"`,
    );
  }
}
