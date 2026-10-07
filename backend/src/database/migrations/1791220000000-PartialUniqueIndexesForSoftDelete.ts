import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unique keys now ignore soft-deleted rows, so a deleted booking, review, slot,
 * role or account no longer blocks recreating it (the insert used to fail with
 * a raw 23505). Account email becomes unique case-insensitively: logins look
 * accounts up by LOWER(email), and `Budi@x` / `budi@x` must be one person.
 */
export class PartialUniqueIndexesForSoftDelete1791220000000 implements MigrationInterface {
  name = 'PartialUniqueIndexesForSoftDelete1791220000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicates = (await queryRunner.query(
      `SELECT LOWER("email") AS "email" FROM "users" WHERE "deletedAt" IS NULL
       GROUP BY LOWER("email") HAVING COUNT(*) > 1`,
    )) as Array<{ email: string }>;
    if (duplicates.length > 0) {
      throw new Error(
        `Merge or delete accounts whose emails differ only by case before migrating: ${duplicates
          .map((row) => row.email)
          .join(', ')}`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_active" ON "users" (LOWER("email")) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_name_active" ON "roles" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_b05ede3628ea44537636d75ef7"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_portal_bookings_user_slot" ON "portal_bookings" ("userId", "slotId") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_cd50e691ec9059e1c3e2d9b0e0"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_portal_reviews_user_target" ON "portal_reviews" ("userId", "targetType", "targetKey") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_f5b0c2c6953556480d4b00e78a"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_portal_booking_slots_event_start" ON "portal_booking_slots" ("eventId", "startsAt") WHERE "deletedAt" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_portal_booking_slots_event_start"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f5b0c2c6953556480d4b00e78a" ON "portal_booking_slots" ("eventId", "startsAt")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_portal_reviews_user_target"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_cd50e691ec9059e1c3e2d9b0e0" ON "portal_reviews" ("userId", "targetType", "targetKey")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_portal_bookings_user_slot"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b05ede3628ea44537636d75ef7" ON "portal_bookings" ("userId", "slotId")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_roles_name_active"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name")`,
    );
    await queryRunner.query(`DROP INDEX "UQ_users_email_active"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
  }
}
