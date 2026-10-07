import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTwoFactorAuth1788925311000 implements MigrationInterface {
  name = 'AddTwoFactorAuth1788925311000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "two_factor_recovery_codes" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "codeHash" character varying NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6f535a18c9fb9da8cc9b7ea70dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8bb7fb08d5097dc938cef1e4a" ON "two_factor_recovery_codes" ("userId")`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "twoFactorSecret" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorEnabledAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "twoFactorLastStep" bigint`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorLastStep"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorEnabledAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "twoFactorSecret"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8bb7fb08d5097dc938cef1e4a"`,
    );
    await queryRunner.query(`DROP TABLE "two_factor_recovery_codes"`);
  }
}
