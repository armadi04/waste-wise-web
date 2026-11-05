import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the retired OAuth2 client-credentials feature.
 *
 * Destructive by design: every registered OAuth client (and its secret hash)
 * is dropped, and the `menu.oauth` / `oauth.clients.*` permissions are deleted
 * together with the role and user grants that reference them (the
 * `permissionId` foreign keys cascade).
 */
export class RemoveOAuthClients1793710000000 implements MigrationInterface {
  name = 'RemoveOAuthClients1793710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "name" IN ('menu.oauth', 'oauth.clients.read', 'oauth.clients.create', 'oauth.clients.update', 'oauth.clients.delete')`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0c094fe1ef0a6c4af8f2b10be"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
  }

  /** Restores the table only; deleted clients, permissions and grants are not recovered. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("id" SERIAL NOT NULL, "clientId" character varying NOT NULL, "clientSecret" character varying NOT NULL, "name" character varying NOT NULL, "scopes" text NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "UQ_b0c094fe1ef0a6c4af8f2b10be7" UNIQUE ("clientId"), CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients"  ("clientId") `,
    );
  }
}
