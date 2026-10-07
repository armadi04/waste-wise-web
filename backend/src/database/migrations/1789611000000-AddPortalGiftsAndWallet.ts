import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalGiftsAndWallet1789611000000 implements MigrationInterface {
  name = 'AddPortalGiftsAndWallet1789611000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_gifts" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "senderUserId" integer NOT NULL,
      "couponId" integer NOT NULL,
      "code" character varying(80) NOT NULL,
      "recipientName" character varying(180) NOT NULL,
      "recipientEmail" character varying(255) NOT NULL,
      "message" text NOT NULL DEFAULT '',
      "status" character varying(32) NOT NULL DEFAULT 'Ready',
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "imageUrl" character varying(255) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      CONSTRAINT "PK_portal_gifts" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_gifts_publicId" ON "portal_gifts" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_gifts_code" ON "portal_gifts" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_gifts_senderUserId" ON "portal_gifts" ("senderUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_gifts_sender_createdAt" ON "portal_gifts" ("senderUserId", "createdAt")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_wallets" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" integer NOT NULL,
      "balance" integer NOT NULL DEFAULT 0,
      "lifetimeEarned" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      CONSTRAINT "PK_portal_wallets" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_wallets_publicId" ON "portal_wallets" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_wallets_userId" ON "portal_wallets" ("userId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_wallet_transactions" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" integer NOT NULL,
      "type" character varying(32) NOT NULL,
      "amount" integer NOT NULL,
      "description" character varying(180) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_portal_wallet_transactions" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_wallet_transactions_publicId" ON "portal_wallet_transactions" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_wallet_transactions_user_createdAt" ON "portal_wallet_transactions" ("userId", "createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "portal_wallet_transactions"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "portal_wallets"');
    await queryRunner.query('DROP TABLE IF EXISTS "portal_gifts"');
  }
}
