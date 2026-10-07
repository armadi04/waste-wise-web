import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutboundEmails1788928358000 implements MigrationInterface {
  name = 'AddOutboundEmails1788928358000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "outbound_emails" ("id" SERIAL NOT NULL, "to" character varying NOT NULL, "subject" character varying NOT NULL, "html" text NOT NULL, "text" text NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP NOT NULL, "lastError" text, "sentAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_outbound_emails" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_emails_status" ON "outbound_emails" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbound_emails_next_attempt" ON "outbound_emails" ("nextAttemptAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_outbound_emails_next_attempt"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_outbound_emails_status"`);
    await queryRunner.query(`DROP TABLE "outbound_emails"`);
  }
}
