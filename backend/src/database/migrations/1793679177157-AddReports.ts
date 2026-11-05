import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReports1793679177157 implements MigrationInterface {
  name = 'AddReports1793679177157';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reports_predicted_category_enum" AS ENUM('ORGANIC_WASTE', 'PLASTIC_WASTE', 'PAPER_WASTE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_classification_status_enum" AS ENUM('COMPLETED', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reports_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reports" ("id" SERIAL NOT NULL, "reporterId" integer NOT NULL, "mediaId" integer NOT NULL, "description" text NOT NULL, "latitude" numeric(9,6), "longitude" numeric(9,6), "predictedCategory" "public"."reports_predicted_category_enum", "confidence" numeric(5,4), "modelVersion" character varying, "classificationStatus" "public"."reports_classification_status_enum" NOT NULL DEFAULT 'COMPLETED', "classificationError" character varying, "status" "public"."reports_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "PK_reports" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_reporterId" ON "reports" ("reporterId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_predictedCategory" ON "reports" ("predictedCategory")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_status" ON "reports" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reports_createdAt" ON "reports" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_reports_reporterId" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" ADD CONSTRAINT "FK_reports_mediaId" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_mediaId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reports" DROP CONSTRAINT "FK_reports_reporterId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_createdAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_reports_predictedCategory"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_reports_reporterId"`);
    await queryRunner.query(`DROP TABLE "reports"`);
    await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."reports_classification_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."reports_predicted_category_enum"`,
    );
  }
}
