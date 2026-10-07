import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionImpersonator1788926567000 implements MigrationInterface {
  name = 'AddSessionImpersonator1788926567000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "impersonatedById" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "impersonatedById"`,
    );
  }
}
