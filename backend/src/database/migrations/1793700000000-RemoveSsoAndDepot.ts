import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the retired SSO (OIDC) login and Depot media storage.
 *
 * Destructive by design: SSO-registered users and Depot-backed media rows are
 * deleted. The migration runs in a transaction, so a foreign-key violation
 * (for example an SSO user who owns reports) aborts it with nothing changed.
 * Files stored in Depot itself are not touched.
 */
export class RemoveSsoAndDepot1793700000000 implements MigrationInterface {
  name = 'RemoveSsoAndDepot1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Data first, so the narrower constraints below can be applied.
    await queryRunner.query(`DELETE FROM "media" WHERE "provider" = 'depot'`);
    await queryRunner.query(
      `DELETE FROM "users" WHERE "registerMethod" = 'SSO'`,
    );

    // SSO session tracking.
    await queryRunner.query(`DROP TABLE "revoked_sso_sessions"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "isSso"`);

    // Register method enum without SSO.
    await queryRunner.query(
      `ALTER TYPE "public"."users_register_method_enum" RENAME TO "users_register_method_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_register_method_enum" AS ENUM('EMAIL_OTP', 'GOOGLE', 'INVITATION', 'SEEDER', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" TYPE "public"."users_register_method_enum" USING "registerMethod"::"text"::"public"."users_register_method_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" SET DEFAULT 'UNKNOWN'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."users_register_method_enum_old"`,
    );

    // Depot media storage.
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_ready_object"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_provider"`,
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "depotFileId"`);
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "provider" SET DEFAULT 's3'`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_provider" CHECK ("provider" IN ('s3'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_ready_object" CHECK ("state" <> 'ready' OR "path" IS NOT NULL)`,
    );
  }

  /** Restores the schema only; deleted users and media rows are not recovered. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_ready_object"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "provider" SET DEFAULT 'depot'`,
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "depotFileId" integer`);
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_provider" CHECK ("provider" IN ('depot', 's3'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_ready_object" CHECK ("state" <> 'ready' OR ("path" IS NOT NULL AND ("provider" <> 'depot' OR "depotFileId" IS NOT NULL)))`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."users_register_method_enum" RENAME TO "users_register_method_enum_new"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_register_method_enum" AS ENUM('EMAIL_OTP', 'GOOGLE', 'INVITATION', 'SSO', 'SEEDER', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" TYPE "public"."users_register_method_enum" USING "registerMethod"::"text"::"public"."users_register_method_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "registerMethod" SET DEFAULT 'UNKNOWN'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."users_register_method_enum_new"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "isSso" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE TABLE "revoked_sso_sessions" ("id" SERIAL NOT NULL, "sid" character varying NOT NULL, "sub" character varying, "revokedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_044ece14beb0b72d1d4c2f857a1" UNIQUE ("sid"), CONSTRAINT "PK_8cbb9b68a7844d450cb1e47c528" PRIMARY KEY ("id"))`,
    );
  }
}
