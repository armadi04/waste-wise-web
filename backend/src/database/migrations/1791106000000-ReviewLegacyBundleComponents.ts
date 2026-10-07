import { type MigrationInterface, type QueryRunner } from 'typeorm';

/** Mark legacy component mappings as unavailable when their intent is ambiguous. */
export class ReviewLegacyBundleComponents1791106000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = String(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    ).replaceAll('"', '""');
    const table = (name: string) => `"${schema}"."${name}"`;
    await queryRunner.query(`
      ALTER TABLE ${table('portal_bundles')}
      ADD COLUMN IF NOT EXISTS "componentsNeedReview" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE ${table('portal_bundles')} b
      SET "componentsNeedReview" = (
        b."packageId" IS NULL OR b."ticketTypeId" IS NULL OR
        NOT EXISTS (
          SELECT 1 FROM ${table('portal_coupon_packages')} p
          JOIN ${table('portal_coupons')} c ON c."id" = p."couponId"
          WHERE p."id" = b."packageId" AND c."slug" = b."couponSlug"
            AND p."active" = true AND p."deletedAt" IS NULL
            AND ((p."isDefault" = true AND (
              SELECT COUNT(*) FROM ${table('portal_coupon_packages')} defaults
              WHERE defaults."couponId" = c."id" AND defaults."active" = true
                AND defaults."deletedAt" IS NULL AND defaults."isDefault" = true
            ) = 1) OR (
              SELECT COUNT(*) FROM ${table('portal_coupon_packages')} choices
              WHERE choices."couponId" = c."id" AND choices."active" = true
                AND choices."deletedAt" IS NULL
            ) = 1)
        ) OR
        NOT EXISTS (
          SELECT 1 FROM ${table('portal_event_tickets')} t
          JOIN ${table('portal_events')} e ON e."id" = t."eventId"
          WHERE t."id" = b."ticketTypeId" AND e."slug" = b."eventSlug"
            AND t."deletedAt" IS NULL
            AND ((lower(t."name") = 'early bird' AND (
              SELECT COUNT(*) FROM ${table('portal_event_tickets')} early_birds
              WHERE early_birds."eventId" = e."id"
                AND early_birds."deletedAt" IS NULL
                AND lower(early_birds."name") = 'early bird'
            ) = 1) OR (
              SELECT COUNT(*) FROM ${table('portal_event_tickets')} choices
              WHERE choices."eventId" = e."id" AND choices."deletedAt" IS NULL
            ) = 1)
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = String(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    ).replaceAll('"', '""');
    await queryRunner.query(
      `ALTER TABLE "${schema}"."portal_bundles" DROP COLUMN IF EXISTS "componentsNeedReview"`,
    );
  }
}
