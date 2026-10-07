import type { MigrationInterface, QueryRunner } from 'typeorm';

const slug = (column: string) =>
  `TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(${column}), '[^a-z0-9]+', '-', 'g'))`;

/** Copy previously hardcoded in the portal's MOMENT_LANES. */
const CURATED_LANES = [
  [
    'Kuliner malam',
    'Makan',
    'Meja malam, porsi besar, harga yang masih masuk akal.',
    'utensils',
    1,
  ],
  [
    'Musik',
    'Nonton',
    'Panggung kecil sampai konser besar, semua di satu malam.',
    'music',
    2,
  ],
  [
    'Venue',
    'Nongkrong',
    'Tempat duduk lama, lampu rendah, dan teman yang tepat.',
    'armchair',
    3,
  ],
] as const;

/**
 * Curated coupon categories and cities, seeded from the free-text values
 * coupons/events already carry. Coupons gain a nullable `categoryId`; the
 * `category` text stays as the filter key and is normalized to the curated
 * name. Matching is case/whitespace-insensitive, first spelling wins.
 */
export class AddCouponCategoriesAndCities1791180000000 implements MigrationInterface {
  name = 'AddCouponCategoriesAndCities1791180000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "portal_coupon_categories" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "slug" character varying(80) NOT NULL,
      "name" character varying(80) NOT NULL,
      "label" character varying(40),
      "blurb" character varying(240) NOT NULL DEFAULT '',
      "icon" character varying(40),
      "position" integer NOT NULL DEFAULT 0,
      "featured" boolean NOT NULL DEFAULT false,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP(3) WITH TIME ZONE,
      CONSTRAINT "PK_portal_coupon_categories" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_coupon_categories_publicId" ON "portal_coupon_categories" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_coupon_categories_slug" ON "portal_coupon_categories" ("slug")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_coupon_categories_name" ON "portal_coupon_categories" ("name")`,
    );
    await queryRunner.query(`
      INSERT INTO "portal_coupon_categories" ("slug", "name", "position")
      SELECT CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END, name, 100
      FROM (
        SELECT name, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY name) AS rn
        FROM (
          SELECT DISTINCT ON (LOWER(TRIM("category"))) TRIM("category") AS name,
                 COALESCE(NULLIF(${slug('TRIM("category")')}, ''), 'category') AS base
          FROM "portal_coupons"
          WHERE TRIM("category") <> ''
          ORDER BY LOWER(TRIM("category")), "id"
        ) distinct_names
      ) numbered`);
    for (const [name, label, blurb, icon, position] of CURATED_LANES)
      await queryRunner.query(
        `UPDATE "portal_coupon_categories"
         SET "label" = $2, "blurb" = $3, "icon" = $4, "position" = $5, "featured" = true
         WHERE LOWER("name") = LOWER($1)`,
        [name, label, blurb, icon, position],
      );
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD "categoryId" integer`,
    );
    await queryRunner.query(`
      UPDATE "portal_coupons" coupon
      SET "categoryId" = category."id", "category" = category."name"
      FROM "portal_coupon_categories" category
      WHERE LOWER(TRIM(coupon."category")) = LOWER(category."name")`);
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_coupons_categoryId" ON "portal_coupons" ("categoryId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" ADD CONSTRAINT "FK_portal_coupons_categoryId" FOREIGN KEY ("categoryId") REFERENCES "portal_coupon_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`CREATE TABLE "portal_cities" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "slug" character varying(100) NOT NULL,
      "name" character varying(100) NOT NULL,
      "position" integer NOT NULL DEFAULT 0,
      "featured" boolean NOT NULL DEFAULT false,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP(3) WITH TIME ZONE,
      CONSTRAINT "PK_portal_cities" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_cities_publicId" ON "portal_cities" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_cities_slug" ON "portal_cities" ("slug")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_cities_name" ON "portal_cities" ("name")`,
    );
    await queryRunner.query(`
      INSERT INTO "portal_cities" ("slug", "name")
      SELECT CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END, name
      FROM (
        SELECT name, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY name) AS rn
        FROM (
          SELECT DISTINCT ON (LOWER(name)) name,
                 COALESCE(NULLIF(${slug('name')}, ''), 'city') AS base
          FROM (
            SELECT TRIM("city") AS name, 0 AS source, "id" FROM "portal_coupons"
            UNION ALL
            SELECT TRIM("city"), 1, "id" FROM "portal_events"
          ) cities
          WHERE name <> ''
          ORDER BY LOWER(name), source, "id"
        ) distinct_names
      ) numbered`);
    for (const table of ['portal_coupons', 'portal_events'])
      await queryRunner.query(`
        UPDATE "${table}" record SET "city" = city."name"
        FROM "portal_cities" city
        WHERE LOWER(TRIM(record."city")) = LOWER(city."name")
          AND record."city" <> city."name"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "portal_cities"`);
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" DROP CONSTRAINT "FK_portal_coupons_categoryId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_portal_coupons_categoryId"`);
    await queryRunner.query(
      `ALTER TABLE "portal_coupons" DROP COLUMN "categoryId"`,
    );
    await queryRunner.query(`DROP TABLE "portal_coupon_categories"`);
  }
}
