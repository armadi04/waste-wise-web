import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSessions1788923684556 implements MigrationInterface {
  name = 'AddUserSessions1788923684556';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" SERIAL NOT NULL, "sessionId" character varying NOT NULL, "userId" integer NOT NULL, "ipAddress" character varying, "userAgent" text, "isSso" boolean NOT NULL DEFAULT false, "lastActiveAt" TIMESTAMP NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_f1d56cb09724333a500af7fe914" UNIQUE ("sessionId"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1d56cb09724333a500af7fe91" ON "user_sessions"  ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55fa4db8406ed66bc704432842" ON "user_sessions"  ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_55fa4db8406ed66bc7044328427" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_55fa4db8406ed66bc7044328427"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55fa4db8406ed66bc704432842"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1d56cb09724333a500af7fe91"`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
