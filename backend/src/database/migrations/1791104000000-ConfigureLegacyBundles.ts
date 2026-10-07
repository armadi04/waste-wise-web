import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class ConfigureLegacyBundles1791104000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "portal_bundles" b
      SET "packageId" = COALESCE(b."packageId", (
        SELECT p."id" FROM "portal_coupon_packages" p
        JOIN "portal_coupons" c ON c."id" = p."couponId"
        WHERE c."slug" = b."couponSlug" AND c."active" = true
          AND p."active" = true AND p."deletedAt" IS NULL
        ORDER BY p."isDefault" DESC, p."position" ASC, p."id" ASC LIMIT 1
      )),
      "ticketTypeId" = COALESCE(b."ticketTypeId", (
        SELECT t."id" FROM "portal_event_tickets" t
        JOIN "portal_events" e ON e."id" = t."eventId"
        WHERE e."slug" = b."eventSlug" AND e."active" = true
          AND t."deletedAt" IS NULL
        ORDER BY (lower(t."name") = 'early bird') DESC, t."price" ASC, t."id" ASC LIMIT 1
      ))
      WHERE b."packageId" IS NULL OR b."ticketTypeId" IS NULL
    `);
  }

  async down(): Promise<void> {
    // Component selections become explicit admin configuration after deployment.
  }
}
