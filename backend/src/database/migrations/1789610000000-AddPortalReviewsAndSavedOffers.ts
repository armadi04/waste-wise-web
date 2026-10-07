import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalReviewsAndSavedOffers1789610000000 implements MigrationInterface {
  name = 'AddPortalReviewsAndSavedOffers1789610000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "portal_reviews" (
        "id" SERIAL NOT NULL,
        "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "targetType" character varying(32) NOT NULL,
        "targetKey" character varying(180) NOT NULL,
        "authorName" character varying(180) NOT NULL,
        "rating" smallint NOT NULL,
        "body" text NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "merchantReply" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_portal_reviews_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_reviews_publicId" ON "portal_reviews" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_reviews_userId" ON "portal_reviews" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_reviews_target" ON "portal_reviews" ("targetType", "targetKey")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_reviews_user_target" ON "portal_reviews" ("userId", "targetType", "targetKey")`,
    );

    await queryRunner.query(`
      CREATE TABLE "portal_saved_offers" (
        "id" SERIAL NOT NULL,
        "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" integer NOT NULL,
        "targetType" character varying(32) NOT NULL,
        "targetKey" character varying(180) NOT NULL,
        "targetName" character varying(180) NOT NULL,
        "imageUrl" character varying(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_portal_saved_offers_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_saved_offers_publicId" ON "portal_saved_offers" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_portal_saved_offers_userId" ON "portal_saved_offers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_saved_offers_user_target" ON "portal_saved_offers" ("userId", "targetType", "targetKey")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "portal_saved_offers"`);
    await queryRunner.query(`DROP TABLE "portal_reviews"`);
  }
}
