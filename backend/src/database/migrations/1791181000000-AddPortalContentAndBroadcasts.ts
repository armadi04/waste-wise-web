import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Editable portal copy entries and customer broadcast history. */
export class AddPortalContentAndBroadcasts1791181000000 implements MigrationInterface {
  name = 'AddPortalContentAndBroadcasts1791181000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "portal_content_entries" (
      "id" SERIAL NOT NULL,
      "key" character varying(80) NOT NULL,
      "title" character varying(180) NOT NULL,
      "summary" character varying(500) NOT NULL DEFAULT '',
      "sections" jsonb NOT NULL DEFAULT '[]',
      "data" jsonb NOT NULL DEFAULT '{}',
      "published" boolean NOT NULL DEFAULT false,
      "updatedById" integer,
      "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_portal_content_entries" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_content_entries_key" ON "portal_content_entries" ("key")`,
    );
    await queryRunner.query(`CREATE TABLE "portal_broadcasts" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "operationKey" character varying(120) NOT NULL,
      "title" character varying(120) NOT NULL,
      "message" character varying(500) NOT NULL,
      "link" character varying(255),
      "type" character varying(20) NOT NULL DEFAULT 'info',
      "audience" character varying(20) NOT NULL,
      "userIds" jsonb,
      "recipientCount" integer NOT NULL DEFAULT 0,
      "createdById" integer NOT NULL,
      "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_portal_broadcasts" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_broadcasts_publicId" ON "portal_broadcasts" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_broadcasts_operationKey" ON "portal_broadcasts" ("operationKey")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "portal_broadcasts"`);
    await queryRunner.query(`DROP TABLE "portal_content_entries"`);
  }
}
