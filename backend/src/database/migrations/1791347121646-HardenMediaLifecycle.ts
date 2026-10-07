import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenMediaLifecycle1791347121646 implements MigrationInterface {
  name = 'HardenMediaLifecycle1791347121646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "media" ADD "storageProfile" character varying(64)`,
    );
    await queryRunner.query(
      `UPDATE "media" SET "storageProfile" = "provider" || '-default'`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ALTER COLUMN "storageProfile" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "storageFingerprint" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "state" character varying NOT NULL DEFAULT 'ready'`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "remoteName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupLeaseUntil" TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "media" ADD "cleanupLeaseToken" uuid`);
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupAttempts" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD "cleanupErrorCode" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_cleanup" ON "media"  ("state", "cleanupAt", "cleanupLeaseUntil") `,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_ready_object" CHECK ("state" <> 'ready' OR ("path" IS NOT NULL AND ("provider" <> 'depot' OR "depotFileId" IS NOT NULL)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_size" CHECK ("size" IS NULL OR ("size" >= 0 AND "size" <= 9007199254740991))`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_state" CHECK ("state" IN ('pending', 'ready', 'deleting'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "CHK_media_provider" CHECK ("provider" IN ('depot', 's3'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const unsafe = (await queryRunner.query(
      `SELECT 1 FROM "media" WHERE "deletedAt" IS NULL AND ("state" <> 'ready' OR "storageProfile" NOT IN ('depot-default', 's3-default')) LIMIT 1`,
    )) as unknown[];
    if (unsafe.length)
      throw new Error(
        'Drain media cleanup and migrate named storage profiles before reverting this migration',
      );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_provider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_state"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_size"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "CHK_media_ready_object"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_media_cleanup"`);
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "cleanupErrorCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "cleanupAttempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "cleanupLeaseToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "cleanupLeaseUntil"`,
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "cleanupAt"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "remoteName"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "state"`);
    await queryRunner.query(
      `ALTER TABLE "media" DROP COLUMN "storageFingerprint"`,
    );
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "storageProfile"`);
  }
}
