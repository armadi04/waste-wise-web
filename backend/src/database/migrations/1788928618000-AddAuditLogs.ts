import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogs1788928618000 implements MigrationInterface {
  name = 'AddAuditLogs1788928618000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" SERIAL NOT NULL, "action" character varying NOT NULL, "actorId" integer, "actorEmail" character varying, "subjectType" character varying, "subjectId" character varying, "summary" character varying, "metadata" jsonb, "ipAddress" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actorId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_audit_logs_actor" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_actor"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_action"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
