import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Distinguish refresh tokens retired by rotation from tokens revoked at logout, so a
 * rotated token presented again after the grace window is detected as reuse.
 */
export class AddBlacklistReason1791191000000 implements MigrationInterface {
  name = 'AddBlacklistReason1791191000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklisted_tokens" ADD "reason" character varying(16) NOT NULL DEFAULT 'logout'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklisted_tokens" DROP COLUMN "reason"`,
    );
  }
}
