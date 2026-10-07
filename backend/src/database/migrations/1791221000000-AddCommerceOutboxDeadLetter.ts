import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Commerce outbox rows record failed deliveries (attempts, lastError) and are
 * dead-lettered with failedAt after repeated failures, so one failing listener
 * no longer blocks every event queued after it.
 */
export class AddCommerceOutboxDeadLetter1791221000000 implements MigrationInterface {
  name = 'AddCommerceOutboxDeadLetter1791221000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" ADD "attempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" ADD "lastError" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" ADD "failedAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" DROP COLUMN "failedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" DROP COLUMN "lastError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_commerce_outbox" DROP COLUMN "attempts"`,
    );
  }
}
