import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Report photos were publicly readable by sequential id. Mark every media row
 * attached to a report as private so `/media/:id/view` requires a session and
 * an ownership/permission check. Data-only; `down` is a no-op because the
 * previous per-row values are not recoverable (all were public).
 */
export class PrivateReportMedia1793730000000 implements MigrationInterface {
  name = 'PrivateReportMedia1793730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "media" SET "isPrivate" = true WHERE "id" IN (SELECT "mediaId" FROM "reports")`,
    );
  }

  public async down(): Promise<void> {
    // Irreversible by design: never re-publish private photos automatically.
  }
}
