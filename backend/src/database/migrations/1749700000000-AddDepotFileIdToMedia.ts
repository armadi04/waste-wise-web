import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepotFileIdToMedia1749700000000 implements MigrationInterface {
  name = 'AddDepotFileIdToMedia1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "depotFileId" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN IF EXISTS "depotFileId"`,
    );
  }
}
