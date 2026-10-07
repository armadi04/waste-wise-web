import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalAvatarImports1791230000000 implements MigrationInterface {
  name = 'AddPortalAvatarImports1791230000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "portal_avatar_imports" (
      "userId" integer NOT NULL,
      "pictureUrl" character varying(2048),
      "attempts" integer NOT NULL DEFAULT 0,
      "availableAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "leaseUntil" TIMESTAMP(3) WITH TIME ZONE,
      "completedAt" TIMESTAMP(3) WITH TIME ZONE,
      "failedAt" TIMESTAMP(3) WITH TIME ZONE,
      "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT "PK_portal_avatar_imports" PRIMARY KEY ("userId"),
      CONSTRAINT "FK_portal_avatar_imports_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_avatar_imports_due" ON "portal_avatar_imports" ("availableAt", "leaseUntil") WHERE "pictureUrl" IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "portal_avatar_imports"');
  }
}
