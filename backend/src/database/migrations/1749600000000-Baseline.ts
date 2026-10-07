import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1749600000000 implements MigrationInterface {
  name = 'Baseline1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If the schema was already provisioned out-of-band (e.g. an
    // environment first booted with `synchronize` on), the tables already
    // exist. Skip the baseline so `migration:run` records it as applied
    // instead of failing on `relation "..." already exists`. Fresh
    // databases run the full body below.
    if (await queryRunner.hasTable('email_verification_tokens')) {
      return;
    }

    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3d1613f95c6a564a3b588d161ae" UNIQUE ("token"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d1613f95c6a564a3b588d161a" ON "email_verification_tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "media" ("id" SERIAL NOT NULL, "filename" character varying NOT NULL, "originalName" character varying, "mimetype" character varying NOT NULL, "size" bigint, "path" character varying, "url" character varying, "driveId" character varying, "webviewLink" character varying, "userId" integer, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48ce552495d14eae9b187bb671" ON "permissions" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "fullname" character varying, "phone" character varying, "emailVerifiedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "avatarId" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "REL_3e1f52ec904aed992472f2be14" UNIQUE ("avatarId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON "roles" ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "invitations" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "email" character varying NOT NULL, "roleIds" text, "invitedBy" integer, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e577dcf9bb6d084373ed3998509" UNIQUE ("token"), CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e577dcf9bb6d084373ed399850" ON "invitations" ("token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97ab59cb592c7cec109741b592" ON "invitations" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('info', 'success', 'warning', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "userId" integer, "targetRole" character varying, "actorId" integer, "title" character varying NOT NULL, "message" text NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'info', "isRead" boolean NOT NULL DEFAULT false, "link" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_626e2ada494617867c40748eb9" ON "notifications" ("targetRole") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_44412a2d6f162ff4dc1697d0db" ON "notifications" ("actorId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ab673f0e63eac966762155508ee" UNIQUE ("token"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ab673f0e63eac966762155508e" ON "password_reset_tokens" ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "blacklisted_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "invalidatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2b8c5de96ce5460b558e94f1505" UNIQUE ("token"), CONSTRAINT "PK_8fb1bc7333c3b9f249f9feaa55d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "revoked_sso_sessions" ("id" SERIAL NOT NULL, "sid" character varying NOT NULL, "sub" character varying, "revokedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_044ece14beb0b72d1d4c2f857a1" UNIQUE ("sid"), CONSTRAINT "PK_8cbb9b68a7844d450cb1e47c528" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("user_id" integer NOT NULL, "role_id" integer NOT NULL, CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_permissions" ("user_id" integer NOT NULL, "permission_id" integer NOT NULL, CONSTRAINT "PK_a537c48b1f80e8626a71cb56589" PRIMARY KEY ("user_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3495bd31f1862d02931e8e8d2e" ON "user_permissions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8145f5fadacd311693c15e41f1" ON "user_permissions" ("permission_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permissions" ("role_id" integer NOT NULL, "permission_id" integer NOT NULL, CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_178199805b901ccd220ab7740e" ON "role_permissions" ("role_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_17022daf3f885f7d35423e9971" ON "role_permissions" ("permission_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_0db866835bf356d896e1892635d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_3e1f52ec904aed992472f2be147" FOREIGN KEY ("avatarId") REFERENCES "media"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_3495bd31f1862d02931e8e8d2e8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_8145f5fadacd311693c15e41f10" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_8145f5fadacd311693c15e41f10"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_3495bd31f1862d02931e8e8d2e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_3e1f52ec904aed992472f2be147"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "FK_0db866835bf356d896e1892635d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`,
    );
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8145f5fadacd311693c15e41f1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3495bd31f1862d02931e8e8d2e"`,
    );
    await queryRunner.query(`DROP TABLE "user_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`,
    );
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "revoked_sso_sessions"`);
    await queryRunner.query(`DROP TABLE "blacklisted_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ab673f0e63eac966762155508e"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44412a2d6f162ff4dc1697d0db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_626e2ada494617867c40748eb9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97ab59cb592c7cec109741b592"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e577dcf9bb6d084373ed399850"`,
    );
    await queryRunner.query(`DROP TABLE "invitations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_648e3f5447f725579d7d4ffdfb"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48ce552495d14eae9b187bb671"`,
    );
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d1613f95c6a564a3b588d161a"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
  }
}
