import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every coupon belongs to a curated category. Coupons still unlinked are matched by
 * their text label, the rest go to "Lainnya"; `categoryId` becomes NOT NULL.
 *
 * The `category` text column stays as a read mirror for existing clients, but the
 * database now owns it: a trigger copies the category name on every coupon write and
 * renaming a category rewrites its coupons, so manual SQL can no longer make them
 * disagree. Filtering uses `categoryId` only.
 */
export class RequireCouponCategory1791192000000 implements MigrationInterface {
  name = 'RequireCouponCategory1791192000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "portal_coupon_categories" ("slug", "name", "position")
      SELECT
        CASE
          WHEN EXISTS (SELECT 1 FROM "portal_coupon_categories" WHERE "slug" = 'lainnya')
            THEN 'lainnya-' || SUBSTRING(MD5(RANDOM()::text) FOR 6)
          ELSE 'lainnya'
        END,
        'Lainnya',
        1000
      WHERE NOT EXISTS (
        SELECT 1 FROM "portal_coupon_categories" WHERE LOWER("name") = 'lainnya'
      )`);
    // A previously deleted "Lainnya" is restored rather than duplicated.
    await queryRunner.query(`
      UPDATE "portal_coupon_categories"
      SET "deletedAt" = NULL, "active" = true
      WHERE LOWER("name") = 'lainnya' AND "deletedAt" IS NOT NULL`);
    await queryRunner.query(`
      UPDATE "portal_coupons" AS coupon
      SET "categoryId" = category."id"
      FROM "portal_coupon_categories" AS category
      WHERE coupon."categoryId" IS NULL
        AND category."deletedAt" IS NULL
        AND LOWER(TRIM(coupon."category")) = LOWER(category."name")`);
    await queryRunner.query(`
      UPDATE "portal_coupons"
      SET "categoryId" = (
        SELECT "id" FROM "portal_coupon_categories"
        WHERE LOWER("name") = 'lainnya'
        ORDER BY "id"
        LIMIT 1
      )
      WHERE "categoryId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ALTER COLUMN "categoryId" SET NOT NULL`,
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "portal_coupons_mirror_category"() RETURNS trigger AS $$
      BEGIN
        SELECT "name" INTO NEW."category"
        FROM "portal_coupon_categories" WHERE "id" = NEW."categoryId";
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_portal_coupons_mirror_category"
      BEFORE INSERT OR UPDATE ON "portal_coupons"
      FOR EACH ROW EXECUTE FUNCTION "portal_coupons_mirror_category"()`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "portal_coupon_categories_rename"() RETURNS trigger AS $$
      BEGIN
        UPDATE "portal_coupons" SET "category" = NEW."name"
        WHERE "categoryId" = NEW."id";
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql`);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_portal_coupon_categories_rename"
      AFTER UPDATE OF "name" ON "portal_coupon_categories"
      FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name")
      EXECUTE FUNCTION "portal_coupon_categories_rename"()`);
    // Align every existing mirror with its category once.
    await queryRunner.query(`
      UPDATE "portal_coupons" AS coupon
      SET "category" = category."name"
      FROM "portal_coupon_categories" AS category
      WHERE category."id" = coupon."categoryId"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER "TRG_portal_coupon_categories_rename" ON "portal_coupon_categories"`,
    );
    await queryRunner.query(
      `DROP FUNCTION "portal_coupon_categories_rename"()`,
    );
    await queryRunner.query(
      `DROP TRIGGER "TRG_portal_coupons_mirror_category" ON "portal_coupons"`,
    );
    await queryRunner.query(`DROP FUNCTION "portal_coupons_mirror_category"()`);
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ALTER COLUMN "categoryId" DROP NOT NULL`,
    );
  }
}
