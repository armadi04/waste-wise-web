import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOAuthClients1784278679329 implements MigrationInterface {
  name = 'AddOAuthClients1784278679329';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("id" SERIAL NOT NULL, "clientId" character varying NOT NULL, "clientSecret" character varying NOT NULL, "name" character varying NOT NULL, "scopes" text NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_b0c094fe1ef0a6c4af8f2b10be7" UNIQUE ("clientId"), CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients" ("clientId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0c094fe1ef0a6c4af8f2b10be"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
  }
}
