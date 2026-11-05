import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema hardening: foreign keys for plain id columns that referenced `users`
 * without a constraint, and CHECK constraints for report coordinates and
 * confidence and for session deadlines.
 *
 * Constraints are added in one transaction; if any existing row violates one,
 * PostgreSQL rejects it and nothing is applied. The audit of the dev database
 * found no violating rows, but run the diagnostic queries in the pull request
 * against staging and production data before deploying.
 */
export class AddSchemaHardeningConstraints1793720000000 implements MigrationInterface {
  name = 'AddSchemaHardeningConstraints1793720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_actorId" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" ADD CONSTRAINT "FK_invitations_invitedBy" FOREIGN KEY ("invitedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_user_sessions_impersonatedById" FOREIGN KEY ("impersonatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "CHK_reports_geo" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "CHK_reports_confidence" CHECK ("confidence" IS NULL OR ("confidence" BETWEEN 0 AND 1))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "CHK_user_sessions_deadlines" CHECK ("expiresAt" <= "absoluteExpiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "CHK_user_sessions_deadlines"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "CHK_reports_confidence"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "CHK_reports_geo"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_impersonatedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invitations" DROP CONSTRAINT "FK_invitations_invitedBy"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_actorId"`,
    );
  }
}
