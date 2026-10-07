import { DataSource } from 'typeorm';
import { SEEDED_PERMISSIONS } from '@/database/seeder/seeder.service';

/**
 * Roles and permissions seeded by `SeederService` — these are preserved across
 * cleans so the superadmin keeps its full permission set and IDs stay stable.
 * The permission names come from the seeder itself, so adding one there cannot
 * leave this list behind.
 */
const SEEDED_ROLE_NAMES = ['superadmin', 'user'];
const SEEDED_PERMISSION_NAMES = SEEDED_PERMISSIONS.map((p) => p.name);

/**
 * Resets volatile state between tests while preserving the seeded superadmin,
 * roles and permissions.
 *
 * `TRUNCATE ... CASCADE` is deliberately avoided: `users.avatarId` references
 * `media`, so cascading from `media` would also wipe `users` (including the
 * admin). Ordered `DELETE`s sidestep that — avatars are detached first so media
 * rows can be removed, then non-admin users and any test-created roles /
 * permissions are deleted (cascading through the junction tables). Raw deletes
 * also clear soft-deleted rows, so unique names are freed for re-creation.
 */
export async function cleanDatabase(
  dataSource: DataSource,
  adminEmail: string,
): Promise<void> {
  if (
    dataSource.options.type !== 'postgres' ||
    dataSource.options.database !== 'kuponmalam_test'
  )
    throw new Error('Cleanup requires the dedicated kuponmalam_test database');
  await dataSource.query('UPDATE users SET "avatarId" = NULL');
  await dataSource.query('DELETE FROM media');
  await dataSource.query('DELETE FROM notifications');
  // Append-only business records are removed only in this guarded test cleanup.
  // Delete dependants before RESTRICT-linked orders, items and users.
  await dataSource.query('DELETE FROM portal_campaign_ledger');
  await dataSource.query('DELETE FROM portal_referrals');
  await dataSource.query(
    'DELETE FROM portal_promo_codes WHERE "campaignId" IS NOT NULL OR "ownerUserId" IS NOT NULL',
  );
  await dataSource.query('DELETE FROM portal_tickets');
  await dataSource.query('DELETE FROM portal_vouchers');
  await dataSource.query('DELETE FROM portal_order_items');
  await dataSource.query('DELETE FROM portal_orders');
  await dataSource.query('DELETE FROM portal_follows');
  await dataSource.query('DELETE FROM portal_campaign_progress');
  await dataSource.query('DELETE FROM portal_email_otp_challenges');
  await dataSource.query('DELETE FROM invitations');
  await dataSource.query('DELETE FROM blacklisted_tokens');
  await dataSource.query('DELETE FROM password_reset_tokens');
  await dataSource.query('DELETE FROM email_verification_tokens');
  await dataSource.query('DELETE FROM users WHERE email != $1', [adminEmail]);

  // Test-created roles (cascades user_roles + role_permissions).
  await dataSource.query('DELETE FROM roles WHERE name <> ALL($1::text[])', [
    SEEDED_ROLE_NAMES,
  ]);

  // Test-created permissions: detach from junction tables first, then delete.
  await dataSource.query(
    'DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name <> ALL($1::text[]))',
    [SEEDED_PERMISSION_NAMES],
  );
  await dataSource.query(
    'DELETE FROM user_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE name <> ALL($1::text[]))',
    [SEEDED_PERMISSION_NAMES],
  );
  await dataSource.query(
    'DELETE FROM permissions WHERE name <> ALL($1::text[])',
    [SEEDED_PERMISSION_NAMES],
  );
}
