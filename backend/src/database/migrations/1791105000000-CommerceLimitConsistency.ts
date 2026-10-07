import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Normalize legacy reservations and only infer bundle components when data has
 * one clear choice. Ambiguous products stay unavailable until admin configures them.
 */
export class CommerceLimitConsistency1791105000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = String(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    ).replaceAll('"', '""');
    const table = (name: string) => `"${schema}"."${name}"`;
    const index = `"IDX_portal_orders_user_purchase_limit"`;
    await queryRunner.query(`
      UPDATE ${table('portal_orders')}
      SET "paymentExpiresAt" = "createdAt" + INTERVAL '24 hours'
      WHERE "status" = 'Pending' AND "paymentExpiresAt" IS NULL
    `);
    await queryRunner.query(`
      UPDATE ${table('portal_bundles')} b
      SET "packageId" = COALESCE(b."packageId", (
        SELECT p."id" FROM ${table('portal_coupon_packages')} p
        JOIN ${table('portal_coupons')} c ON c."id" = p."couponId"
        WHERE c."slug" = b."couponSlug" AND c."active" = true
          AND p."active" = true AND p."deletedAt" IS NULL
          AND (p."isDefault" = true OR (
            SELECT COUNT(*) FROM ${table('portal_coupon_packages')} only_package
            WHERE only_package."couponId" = c."id" AND only_package."active" = true
              AND only_package."deletedAt" IS NULL
          ) = 1)
        ORDER BY p."isDefault" DESC, p."id" ASC LIMIT 1
      )),
      "ticketTypeId" = COALESCE(b."ticketTypeId", (
        SELECT t."id" FROM ${table('portal_event_tickets')} t
        JOIN ${table('portal_events')} e ON e."id" = t."eventId"
        WHERE e."slug" = b."eventSlug" AND e."active" = true
          AND t."deletedAt" IS NULL
          AND (lower(t."name") = 'early bird' OR (
            SELECT COUNT(*) FROM ${table('portal_event_tickets')} only_ticket
            WHERE only_ticket."eventId" = e."id" AND only_ticket."deletedAt" IS NULL
          ) = 1)
        ORDER BY (lower(t."name") = 'early bird') DESC, t."id" ASC LIMIT 1
      ))
      WHERE b."packageId" IS NULL OR b."ticketTypeId" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${index}
      ON ${table('portal_orders')} ("userId", "status", "paymentExpiresAt")
      WHERE "status" IN ('Paid', 'Pending')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = String(
      (queryRunner.connection.options as { schema?: string }).schema ??
        'public',
    ).replaceAll('"', '""');
    await queryRunner.query(
      `DROP INDEX IF EXISTS "${schema}"."IDX_portal_orders_user_purchase_limit"`,
    );
    // Backfilled deadlines and bundle selections remain valid business data.
  }
}
