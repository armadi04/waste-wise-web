import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One-time codes must not live on in the mail outbox: sensitive rows are redacted
 * after delivery, and a code that expired while queued is never sent.
 */
export class AddOutboundEmailRedaction1791190000000 implements MigrationInterface {
  name = 'AddOutboundEmailRedaction1791190000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbound_emails" ADD "redactAfterSend" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbound_emails" ADD "expiresAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    // Codes already sitting in the outbox are cleared too; they expired long ago.
    await queryRunner.query(
      `UPDATE "outbound_emails" SET "html" = '[redacted after delivery]', "text" = '[redacted after delivery]', "redactAfterSend" = true WHERE "subject" = 'Kode masuk KuponMalam' AND "status" <> 'pending'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbound_emails" DROP COLUMN "expiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbound_emails" DROP COLUMN "redactAfterSend"`,
    );
  }
}
