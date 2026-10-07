import { MigrationInterface, QueryRunner } from 'typeorm';

export class StarterBaseline1791345163716 implements MigrationInterface {
  name = 'StarterBaseline1791345163716';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      throw new Error(
        'StarterBaseline requires a new database; existing application databases are not supported.',
      );
    }
    await queryRunner.query(
      `CREATE TABLE "oauth_clients" ("id" SERIAL NOT NULL, "clientId" character varying NOT NULL, "clientSecret" character varying NOT NULL, "name" character varying NOT NULL, "scopes" text NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "UQ_b0c094fe1ef0a6c4af8f2b10be7" UNIQUE ("clientId"), CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients"  ("clientId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "permissions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_48ce552495d14eae9b187bb671" ON "permissions"  ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_roles_name_active" ON "roles"  ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON "roles"  ("name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "media" ("id" SERIAL NOT NULL, "provider" character varying NOT NULL DEFAULT 'depot', "filename" character varying NOT NULL, "originalName" character varying, "mimetype" character varying NOT NULL, "size" bigint, "path" character varying, "depotFileId" integer, "url" character varying, "driveId" character varying, "webviewLink" character varying, "userId" integer, "isPrivate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "PK_f4e0fcac36e050de337b670d8bd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_register_method_enum" AS ENUM('EMAIL_OTP', 'GOOGLE', 'INVITATION', 'SSO', 'SEEDER', 'UNKNOWN')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("timeZone" character varying(100), "lastDetectedTimeZone" character varying(100), "id" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "fullname" character varying, "phone" character varying, "notificationsEnabled" boolean NOT NULL DEFAULT true, "emailVerifiedAt" TIMESTAMP(3) WITH TIME ZONE, "failedLoginAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP(3) WITH TIME ZONE, "twoFactorSecret" text, "twoFactorEnabledAt" TIMESTAMP(3) WITH TIME ZONE, "twoFactorLastStep" bigint, "registerMethod" "public"."users_register_method_enum" NOT NULL DEFAULT 'UNKNOWN', "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, "avatarId" integer, CONSTRAINT "REL_3e1f52ec904aed992472f2be14" UNIQUE ("avatarId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_registerMethod" ON "users"  ("registerMethod") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_active" ON "users" (LOWER("email")) WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" SERIAL NOT NULL, "sessionId" character varying NOT NULL, "userId" integer NOT NULL, "ipAddress" character varying, "userAgent" text, "impersonatedById" integer, "isSso" boolean NOT NULL DEFAULT false, "audience" character varying(16) NOT NULL DEFAULT 'admin', "lastActiveAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "absoluteExpiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "UQ_f1d56cb09724333a500af7fe914" UNIQUE ("sessionId"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1d56cb09724333a500af7fe91" ON "user_sessions"  ("sessionId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_55fa4db8406ed66bc704432842" ON "user_sessions"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('info', 'success', 'warning', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("eventId" character varying, "id" SERIAL NOT NULL, "userId" integer, "targetRole" character varying, "actorId" integer, "title" character varying NOT NULL, "message" text NOT NULL, "type" "public"."notifications_type_enum" NOT NULL DEFAULT 'info', "isRead" boolean NOT NULL DEFAULT false, "link" character varying, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3337493bfdc5d0fccd4bd5f51e" ON "notifications"  ("eventId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_626e2ada494617867c40748eb9" ON "notifications"  ("targetRole") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_44412a2d6f162ff4dc1697d0db" ON "notifications"  ("actorId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "outbound_emails" ("id" SERIAL NOT NULL, "to" character varying NOT NULL, "subject" character varying NOT NULL, "html" text NOT NULL, "text" text NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "lastError" text, "sentAt" TIMESTAMP(3) WITH TIME ZONE, "redactAfterSend" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d07cd54ab4e5dd921ff509203ae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b49d1a088beb13cdb51a93dbd" ON "outbound_emails"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a5a4a43f6951d0f1fcec9106a" ON "outbound_emails"  ("nextAttemptAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "two_factor_recovery_codes" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "codeHash" character varying NOT NULL, "usedAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6f535a18c9fb9da8cc9b7ea70dc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b8bb7fb08d5097dc938cef1e4a" ON "two_factor_recovery_codes"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "email_verification_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3d1613f95c6a564a3b588d161ae" UNIQUE ("token"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d1613f95c6a564a3b588d161a" ON "email_verification_tokens"  ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "password_reset_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "userId" integer NOT NULL, "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ab673f0e63eac966762155508ee" UNIQUE ("token"), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ab673f0e63eac966762155508e" ON "password_reset_tokens"  ("token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "blacklisted_tokens" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "reason" character varying(16) NOT NULL DEFAULT 'logout', "invalidatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2b8c5de96ce5460b558e94f1505" UNIQUE ("token"), CONSTRAINT "PK_8fb1bc7333c3b9f249f9feaa55d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "revoked_sso_sessions" ("id" SERIAL NOT NULL, "sid" character varying NOT NULL, "sub" character varying, "revokedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_044ece14beb0b72d1d4c2f857a1" UNIQUE ("sid"), CONSTRAINT "PK_8cbb9b68a7844d450cb1e47c528" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invitations" ("id" SERIAL NOT NULL, "token" character varying NOT NULL, "email" character varying NOT NULL, "roleIds" text, "invitedBy" integer, "expiresAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP(3) WITH TIME ZONE, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP(3) WITH TIME ZONE, CONSTRAINT "UQ_e577dcf9bb6d084373ed3998509" UNIQUE ("token"), CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e577dcf9bb6d084373ed399850" ON "invitations"  ("token") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97ab59cb592c7cec109741b592" ON "invitations"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("eventId" character varying, "id" SERIAL NOT NULL, "action" character varying NOT NULL, "actorId" integer, "actorEmail" character varying, "subjectType" character varying, "subjectId" character varying, "summary" character varying, "metadata" jsonb, "ipAddress" character varying, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f953f2cb581d00109a05741e13" ON "audit_logs"  ("eventId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2dc33f7f3c22e2e7badafca1d1" ON "audit_logs"  ("actorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs"  ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permissions" ("roleId" integer NOT NULL, "permissionId" integer NOT NULL, CONSTRAINT "PK_d430a02aad006d8a70f3acd7d03" PRIMARY KEY ("roleId", "permissionId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b4599f8b8f548d35850afa2d12" ON "role_permissions"  ("roleId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06792d0c62ce6b0203c03643cd" ON "role_permissions"  ("permissionId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("userId" integer NOT NULL, "roleId" integer NOT NULL, CONSTRAINT "PK_88481b0c4ed9ada47e9fdd67475" PRIMARY KEY ("userId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_472b25323af01488f1f66a06b6" ON "user_roles"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86033897c009fcca8b6505d6be" ON "user_roles"  ("roleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_permissions" ("userId" integer NOT NULL, "permissionId" integer NOT NULL, CONSTRAINT "PK_4d0e283b03781d1796e62dc6195" PRIMARY KEY ("userId", "permissionId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f05ccc7935f14874d7f89ba030" ON "user_permissions"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cf38f85e52ee274ba9a01901ed" ON "user_permissions"  ("permissionId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_0db866835bf356d896e1892635d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_3e1f52ec904aed992472f2be147" FOREIGN KEY ("avatarId") REFERENCES "media"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_55fa4db8406ed66bc7044328427" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_2dc33f7f3c22e2e7badafca1d12" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_472b25323af01488f1f66a06b67" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_86033897c009fcca8b6505d6be2" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" ADD CONSTRAINT "FK_cf38f85e52ee274ba9a01901ed2" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_cf38f85e52ee274ba9a01901ed2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" DROP CONSTRAINT "FK_f05ccc7935f14874d7f89ba030f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_86033897c009fcca8b6505d6be2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "FK_472b25323af01488f1f66a06b67"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_06792d0c62ce6b0203c03643cdd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_b4599f8b8f548d35850afa2d12c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_2dc33f7f3c22e2e7badafca1d12"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_55fa4db8406ed66bc7044328427"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_3e1f52ec904aed992472f2be147"`,
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "FK_0db866835bf356d896e1892635d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cf38f85e52ee274ba9a01901ed"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f05ccc7935f14874d7f89ba030"`,
    );
    await queryRunner.query(`DROP TABLE "user_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86033897c009fcca8b6505d6be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_472b25323af01488f1f66a06b6"`,
    );
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_06792d0c62ce6b0203c03643cd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b4599f8b8f548d35850afa2d12"`,
    );
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2dc33f7f3c22e2e7badafca1d1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f953f2cb581d00109a05741e13"`,
    );
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97ab59cb592c7cec109741b592"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e577dcf9bb6d084373ed399850"`,
    );
    await queryRunner.query(`DROP TABLE "invitations"`);
    await queryRunner.query(`DROP TABLE "revoked_sso_sessions"`);
    await queryRunner.query(`DROP TABLE "blacklisted_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ab673f0e63eac966762155508e"`,
    );
    await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d1613f95c6a564a3b588d161a"`,
    );
    await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8bb7fb08d5097dc938cef1e4a"`,
    );
    await queryRunner.query(`DROP TABLE "two_factor_recovery_codes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a5a4a43f6951d0f1fcec9106a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b49d1a088beb13cdb51a93dbd"`,
    );
    await queryRunner.query(`DROP TABLE "outbound_emails"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44412a2d6f162ff4dc1697d0db"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_626e2ada494617867c40748eb9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3337493bfdc5d0fccd4bd5f51e"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_55fa4db8406ed66bc704432842"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f1d56cb09724333a500af7fe91"`,
    );
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_registerMethod"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_register_method_enum"`);
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_648e3f5447f725579d7d4ffdfb"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_roles_name_active"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48ce552495d14eae9b187bb671"`,
    );
    await queryRunner.query(`DROP TABLE "permissions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b0c094fe1ef0a6c4af8f2b10be"`,
    );
    await queryRunner.query(`DROP TABLE "oauth_clients"`);
  }
}
