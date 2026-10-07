import type { MigrationInterface, QueryRunner } from 'typeorm';
import { sessionPolicy } from '../../sessions/session-policy';

/**
 * Sessions gain an audience (staff `admin` vs customer `portal`) and a hard
 * `absoluteExpiresAt`. Existing rows follow the new policy immediately:
 * customer-only accounts become portal sessions, the absolute deadline counts
 * from login, and `expiresAt` (idle deadline) shrinks to the new idle window —
 * so staff sessions older than the absolute limit end at deploy.
 */
export class AddSessionAudienceAndAbsoluteExpiry1791210000000 implements MigrationInterface {
  name = 'AddSessionAudienceAndAbsoluteExpiry1791210000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "audience" character varying(16) NOT NULL DEFAULT 'admin'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "absoluteExpiresAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(`
      UPDATE "user_sessions" s SET "audience" = 'portal'
      WHERE EXISTS (
        SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."roleId"
        WHERE ur."userId" = s."userId" AND r."name" = 'customer'
      ) AND NOT EXISTS (
        SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."roleId"
        WHERE ur."userId" = s."userId" AND r."name" <> 'customer'
      )`);
    for (const audience of ['admin', 'portal'] as const) {
      const { idleMs, absoluteMs } = sessionPolicy(audience);
      await queryRunner.query(
        `UPDATE "user_sessions"
         SET "absoluteExpiresAt" = "createdAt" + $2 * INTERVAL '1 millisecond'
         WHERE "audience" = $1`,
        [audience, absoluteMs],
      );
      await queryRunner.query(
        `UPDATE "user_sessions"
         SET "expiresAt" = LEAST(
           "expiresAt",
           "lastActiveAt" + $2 * INTERVAL '1 millisecond',
           "absoluteExpiresAt"
         )
         WHERE "audience" = $1`,
        [audience, idleMs],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ALTER COLUMN "absoluteExpiresAt" SET NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "absoluteExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "audience"`,
    );
  }
}
