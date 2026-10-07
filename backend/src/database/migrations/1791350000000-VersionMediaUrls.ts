import { MigrationInterface, QueryRunner } from 'typeorm';

const BACKUP = 'api_migration_backup.media_v1_urls';

/** Only the application's public media view URL changes; storage keys do not. */
export class VersionMediaUrls1791350000000 implements MigrationInterface {
  name = 'VersionMediaUrls1791350000000';

  async up(runner: QueryRunner): Promise<void> {
    const configured = process.env.APP_URL;
    if (!configured)
      throw new Error('Media URL migration requires explicit APP_URL');
    const appUrl = new URL(configured);
    if (
      !['http:', 'https:'].includes(appUrl.protocol) ||
      appUrl.username ||
      appUrl.password ||
      appUrl.pathname !== '/' ||
      appUrl.search ||
      appUrl.hash
    )
      throw new Error(
        'Media URL migration requires APP_URL to be an HTTP(S) origin',
      );

    await this.withTransaction(runner, async () => {
      // Separate from application tables so schema checks retain their meaning.
      await runner.query('CREATE SCHEMA IF NOT EXISTS api_migration_backup');
      await runner.query(`CREATE TABLE IF NOT EXISTS ${BACKUP} (
        "id" integer PRIMARY KEY, "oldUrl" text NOT NULL, "newUrl" text NOT NULL
      )`);
      const rows = (await runner.query(
        `SELECT "id", "url" FROM "media" WHERE "url" LIKE '%/api/media/%' FOR UPDATE`,
      )) as Array<{ id: number; url: string }>;
      let changed = 0;
      for (const row of rows) {
        // Keep the original spelling and query/fragment bytes, rather than
        // serializing URL (which can normalize or encode unrelated characters).
        const parts =
          /^(https?:\/\/[^/?#]+)(\/api\/media\/([1-9][0-9]*)\/view)([?#].*)?$/.exec(
            row.url,
          );
        if (!parts || parts[3] !== String(row.id)) continue;
        let url: URL;
        try {
          url = new URL(row.url);
        } catch {
          continue;
        }
        if (
          url.origin !== appUrl.origin ||
          url.username ||
          url.password ||
          url.pathname !== parts[2]
        )
          continue;
        const next = `${parts[1]}/api/v1/media/${row.id}/view${parts[4] ?? ''}`;
        await runner.query(
          `INSERT INTO ${BACKUP} ("id", "oldUrl", "newUrl") VALUES ($1, $2, $3)`,
          [row.id, row.url, next],
        );
        const updated = (await runner.query(
          'WITH updated AS (UPDATE "media" SET "url" = $1 WHERE "id" = $2 AND "url" = $3 RETURNING "id") SELECT "id" FROM updated',
          [next, row.id, row.url],
        )) as Array<{ id: number }>;
        if (updated.length !== 1)
          throw new Error('Media URL changed during migration');
        changed++;
      }
      console.log(`Media URL migration updated ${changed} rows`);
    });
  }

  async down(runner: QueryRunner): Promise<void> {
    await this.withTransaction(runner, async () => {
      await runner.query(
        `SELECT m."id" FROM "media" m JOIN ${BACKUP} b ON b."id" = m."id" FOR UPDATE OF m`,
      );
      const conflicts = (await runner.query(
        `SELECT b."id" FROM ${BACKUP} b LEFT JOIN "media" m ON m."id" = b."id"
         WHERE m."id" IS NULL OR m."url" IS DISTINCT FROM b."newUrl"`,
      )) as Array<{ id: number }>;
      if (conflicts.length)
        throw new Error(
          `Media URL rollback blocked: ${conflicts.length} changed or missing rows; backup retained`,
        );
      const restored = (await runner.query(
        `WITH restored AS (UPDATE "media" m SET "url" = b."oldUrl" FROM ${BACKUP} b
         WHERE m."id" = b."id" AND m."url" = b."newUrl" RETURNING m."id") SELECT "id" FROM restored`,
      )) as Array<{ id: number }>;
      await runner.query(`DROP TABLE ${BACKUP}`);
      console.log(`Media URL rollback restored ${restored.length} rows`);
    });
  }

  private async withTransaction(
    runner: QueryRunner,
    action: () => Promise<void>,
  ): Promise<void> {
    const ownsTransaction = !runner.isTransactionActive;
    if (ownsTransaction) await runner.startTransaction();
    try {
      await action();
      if (ownsTransaction) await runner.commitTransaction();
    } catch (error) {
      if (ownsTransaction) await runner.rollbackTransaction();
      throw error;
    }
  }
}
