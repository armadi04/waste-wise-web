import { MigrationInterface, QueryRunner } from 'typeorm';
export const legacy: Array<[string, string]> = [
  ['revoked_sso_sessions', 'revokedAt'],
  ['blacklisted_tokens', 'invalidatedAt'],
  ['password_reset_tokens', 'createdAt'],
  ['email_verification_tokens', 'createdAt'],
  ['two_factor_recovery_codes', 'usedAt'],
  ['two_factor_recovery_codes', 'createdAt'],
  ['users', 'emailVerifiedAt'],
  ['users', 'lockedUntil'],
  ['users', 'twoFactorEnabledAt'],
  ['users', 'createdAt'],
  ['users', 'updatedAt'],
  ['users', 'deletedAt'],
  ['invitations', 'createdAt'],
  ['invitations', 'deletedAt'],
  ['media', 'createdAt'],
  ['media', 'updatedAt'],
  ['media', 'deletedAt'],
  ['permissions', 'createdAt'],
  ['permissions', 'updatedAt'],
  ['permissions', 'deletedAt'],
  ['roles', 'createdAt'],
  ['roles', 'updatedAt'],
  ['roles', 'deletedAt'],
  ['outbound_emails', 'nextAttemptAt'],
  ['outbound_emails', 'sentAt'],
  ['outbound_emails', 'createdAt'],
  ['notifications', 'createdAt'],
  ['notifications', 'updatedAt'],
  ['portal_order_items', 'createdAt'],
  ['portal_order_items', 'updatedAt'],
  ['portal_order_items', 'deletedAt'],
  ['portal_wallets', 'createdAt'],
  ['portal_wallets', 'updatedAt'],
  ['portal_wallets', 'deletedAt'],
  ['portal_follows', 'createdAt'],
  ['portal_follows', 'updatedAt'],
  ['portal_follows', 'deletedAt'],
  ['portal_coupons', 'createdAt'],
  ['portal_coupons', 'updatedAt'],
  ['portal_coupons', 'deletedAt'],
  ['portal_tickets', 'createdAt'],
  ['portal_tickets', 'updatedAt'],
  ['portal_tickets', 'deletedAt'],
  ['portal_campaign_progress', 'createdAt'],
  ['portal_campaign_progress', 'updatedAt'],
  ['portal_campaign_progress', 'deletedAt'],
  ['portal_bundles', 'createdAt'],
  ['portal_bundles', 'updatedAt'],
  ['portal_bundles', 'deletedAt'],
  ['portal_gifts', 'createdAt'],
  ['portal_gifts', 'updatedAt'],
  ['portal_gifts', 'deletedAt'],
  ['portal_saved_offers', 'createdAt'],
  ['portal_saved_offers', 'updatedAt'],
  ['portal_saved_offers', 'deletedAt'],
  ['portal_email_otp_challenges', 'createdAt'],
  ['portal_email_otp_challenges', 'updatedAt'],
  ['portal_email_otp_challenges', 'deletedAt'],
  ['portal_reviews', 'createdAt'],
  ['portal_reviews', 'updatedAt'],
  ['portal_reviews', 'deletedAt'],
  ['portal_orders', 'createdAt'],
  ['portal_orders', 'updatedAt'],
  ['portal_orders', 'deletedAt'],
  ['portal_bookings', 'createdAt'],
  ['portal_bookings', 'updatedAt'],
  ['portal_bookings', 'deletedAt'],
  ['portal_faqs', 'createdAt'],
  ['portal_faqs', 'updatedAt'],
  ['portal_faqs', 'deletedAt'],
  ['portal_events', 'createdAt'],
  ['portal_events', 'updatedAt'],
  ['portal_events', 'deletedAt'],
  ['portal_booking_slots', 'createdAt'],
  ['portal_booking_slots', 'updatedAt'],
  ['portal_booking_slots', 'deletedAt'],
  ['portal_promo_codes', 'createdAt'],
  ['portal_promo_codes', 'updatedAt'],
  ['portal_promo_codes', 'deletedAt'],
  ['portal_campaigns', 'createdAt'],
  ['portal_campaigns', 'updatedAt'],
  ['portal_campaigns', 'deletedAt'],
  ['portal_event_tickets', 'createdAt'],
  ['portal_event_tickets', 'updatedAt'],
  ['portal_event_tickets', 'deletedAt'],
  ['portal_vouchers', 'createdAt'],
  ['portal_vouchers', 'updatedAt'],
  ['portal_vouchers', 'deletedAt'],
  ['portal_wallet_transactions', 'createdAt'],
  ['user_sessions', 'lastActiveAt'],
  ['user_sessions', 'expiresAt'],
  ['user_sessions', 'revokedAt'],
  ['user_sessions', 'createdAt'],
  ['user_sessions', 'updatedAt'],
  ['user_sessions', 'deletedAt'],
  ['audit_logs', 'createdAt'],
  ['oauth_clients', 'createdAt'],
  ['oauth_clients', 'updatedAt'],
  ['oauth_clients', 'deletedAt'],
];
export const aware: Array<[string, string]> = [
  ['password_reset_tokens', 'expiresAt'],
  ['password_reset_tokens', 'usedAt'],
  ['email_verification_tokens', 'expiresAt'],
  ['email_verification_tokens', 'usedAt'],
  ['invitations', 'expiresAt'],
  ['invitations', 'acceptedAt'],
  ['media', 'cleanupAt'],
  ['media', 'cleanupLeaseUntil'],
  ['portal_coupons', 'expiresAt'],
  ['portal_tickets', 'checkedInAt'],
  ['portal_gifts', 'expiresAt'],
  ['portal_gifts', 'redeemedAt'],
  ['portal_email_otp_challenges', 'expiresAt'],
  ['portal_email_otp_challenges', 'consumedAt'],
  ['portal_email_otp_challenges', 'lastSentAt'],
  ['portal_orders', 'paidAt'],
  ['portal_orders', 'refundRequestedAt'],
  ['portal_orders', 'refundedAt'],
  ['portal_coupon_packages', 'createdAt'],
  ['portal_coupon_packages', 'updatedAt'],
  ['portal_coupon_packages', 'deletedAt'],
  ['portal_events', 'startsAt'],
  ['portal_booking_slots', 'startsAt'],
  ['portal_booking_slots', 'endsAt'],
  ['portal_promo_codes', 'expiresAt'],
  ['portal_vouchers', 'expiresAt'],
  ['portal_vouchers', 'redeemedAt'],
];
export class StandardizeTimeZones1791000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.LEGACY_TIMESTAMP_TIME_ZONE !== 'UTC')
      throw new Error(
        'Verify legacy timestamp provenance and set LEGACY_TIMESTAMP_TIME_ZONE=UTC before this migration',
      );
    await queryRunner.query(`SET LOCAL TIME ZONE 'UTC'`);
    for (const [table, column] of legacy)
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz(3) USING "${column}" AT TIME ZONE 'UTC'`,
      );
    for (const [table, column] of aware)
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz(3)`,
      );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "timeZone" varchar(100), ADD COLUMN "lastDetectedTimeZone" varchar(100)`,
    );
    for (const table of [
      'portal_coupons',
      'portal_events',
      'portal_vouchers',
      'portal_gifts',
    ])
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN "timeZone" varchar(100) NOT NULL DEFAULT 'Asia/Jakarta', ADD CONSTRAINT "CHK_${table}_timeZone" CHECK ("timeZone" IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'))`,
      );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL TIME ZONE 'UTC'`);
    for (const table of [
      'portal_coupons',
      'portal_events',
      'portal_vouchers',
      'portal_gifts',
    ])
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT "CHK_${table}_timeZone", DROP COLUMN "timeZone"`,
      );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "timeZone", DROP COLUMN "lastDetectedTimeZone"`,
    );
    for (const [table, column] of legacy)
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamp USING "${column}" AT TIME ZONE 'UTC'`,
      );
    for (const [table, column] of aware)
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE timestamptz`,
      );
  }
}
