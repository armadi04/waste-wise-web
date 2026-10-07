import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationSoftDelete1789600000000 implements MigrationInterface {
  name = 'AddInvitationSoftDelete1789600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP WITH TIME ZONE',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "invitations" DROP COLUMN IF EXISTS "deletedAt"',
    );
  }
}
