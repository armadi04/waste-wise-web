import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarCleanupState1790848800000 implements MigrationInterface {
  name = 'AddAvatarCleanupState1790848800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD "managedAvatar" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupLeaseUntil" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_avatarCleanup" ON "media"  ("managedAvatar", "cleanupAt", "cleanupLeaseUntil") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_media_avatarCleanup"`);
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "cleanupLeaseUntil"`,
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "cleanupAt"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "managedAvatar"`);
  }
}
