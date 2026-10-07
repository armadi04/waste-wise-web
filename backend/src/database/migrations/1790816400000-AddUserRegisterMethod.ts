import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRegisterMethod1790816400000 implements MigrationInterface {
  name = 'AddUserRegisterMethod1790816400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."users_register_method_enum" AS ENUM ('EMAIL_OTP', 'GOOGLE', 'INVITATION', 'SSO', 'SEEDER', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "registerMethod" "public"."users_register_method_enum" NOT NULL DEFAULT 'UNKNOWN'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_registerMethod" ON "users" ("registerMethod")`,
    );
    // Only seed identity and an accepted invitation aligned with account creation
    // are used. Login history and fast verification do not establish provenance.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await queryRunner.query(
        `UPDATE "users" u SET "registerMethod" = 'SEEDER'
        WHERE lower(u."email") = lower($1) AND EXISTS (
          SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."roleId"
          WHERE ur."userId" = u."id" AND r."name" = 'superadmin'
        )`,
        [adminEmail],
      );
    }
    await queryRunner.query(`UPDATE "users" u SET "registerMethod" = 'INVITATION'
      WHERE u."registerMethod" = 'UNKNOWN' AND EXISTS (
        SELECT 1 FROM "invitations" i WHERE lower(i."email") = lower(u."email")
          AND i."acceptedAt" >= u."createdAt"
          AND i."acceptedAt" <= u."createdAt" + interval '60 seconds'
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_registerMethod"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "registerMethod"`);
    await queryRunner.query(`DROP TYPE "public"."users_register_method_enum"`);
  }
}
