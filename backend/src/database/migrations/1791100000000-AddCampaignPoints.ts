import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignPoints1791100000000 implements MigrationInterface {
  name = 'AddCampaignPoints1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "portal_campaign_ledger" ("id" SERIAL NOT NULL, "campaignId" integer NOT NULL, "userId" integer NOT NULL, "sourceKey" character varying(120) NOT NULL, "kind" character varying(30) NOT NULL, "points" integer NOT NULL, "orderId" integer, "actorId" integer, "reason" character varying(500) NOT NULL, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9c3fc1f752f486d1c04ba5ee2c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_9c7f2ebcdf9c700a983759d187" ON "portal_campaign_ledger"  ("orderId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_79c4ffb318008a6650d81fa676" ON "portal_campaign_ledger"  ("campaignId", "userId", "sourceKey") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "portal_referrals" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "code" character varying(32) NOT NULL, "referrerUserId" integer, "firstOrderId" integer, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_faf06472936fb5e58f0ac1aa26d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_f504363b1d2887384c1f2d6b80" ON "portal_referrals"  ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_8aa44947b67e7b6e2b7e291877" ON "portal_referrals"  ("code") `,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_vouchers" ADD COLUMN IF NOT EXISTS "orderItemId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaigns" ADD COLUMN IF NOT EXISTS "rules" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" ADD COLUMN IF NOT EXISTS "ownerUserId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" ADD COLUMN IF NOT EXISTS "campaignId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" ADD COLUMN IF NOT EXISTS "reservedOrderId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3) WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tickets" ADD COLUMN IF NOT EXISTS "orderItemId" integer`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_babd08a54e9c75ff29b34982cb" ON "portal_vouchers"  ("orderItemId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_0552d3c842159d8cc998de4459" ON "portal_promo_codes"  ("ownerUserId", "campaignId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_c29f1c2fdeece2ef4e7040cd31" ON "portal_tickets"  ("orderItemId") `,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_babd08a54e9c75ff29b34982cbf') THEN ALTER TABLE "portal_vouchers" ADD CONSTRAINT "FK_babd08a54e9c75ff29b34982cbf" FOREIGN KEY ("orderItemId") REFERENCES "portal_order_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_b493c09e3fc61fa7fd32850310e') THEN ALTER TABLE "portal_promo_codes" ADD CONSTRAINT "FK_b493c09e3fc61fa7fd32850310e" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_b76e462a8f954d93e1acf95f79f') THEN ALTER TABLE "portal_promo_codes" ADD CONSTRAINT "FK_b76e462a8f954d93e1acf95f79f" FOREIGN KEY ("campaignId") REFERENCES "portal_campaigns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_cdb9e0a63ecb1ac1d506feca9cf') THEN ALTER TABLE "portal_promo_codes" ADD CONSTRAINT "FK_cdb9e0a63ecb1ac1d506feca9cf" FOREIGN KEY ("reservedOrderId") REFERENCES "portal_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_c29f1c2fdeece2ef4e7040cd313') THEN ALTER TABLE "portal_tickets" ADD CONSTRAINT "FK_c29f1c2fdeece2ef4e7040cd313" FOREIGN KEY ("orderItemId") REFERENCES "portal_order_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d52724ef658a1701303913f2983') THEN ALTER TABLE "portal_campaign_ledger" ADD CONSTRAINT "FK_d52724ef658a1701303913f2983" FOREIGN KEY ("campaignId") REFERENCES "portal_campaigns"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_fbf63054b0c4c76440b03436370') THEN ALTER TABLE "portal_campaign_ledger" ADD CONSTRAINT "FK_fbf63054b0c4c76440b03436370" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9c7f2ebcdf9c700a983759d187c') THEN ALTER TABLE "portal_campaign_ledger" ADD CONSTRAINT "FK_9c7f2ebcdf9c700a983759d187c" FOREIGN KEY ("orderId") REFERENCES "portal_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_a41c621859d5e35f4bb6323e76a') THEN ALTER TABLE "portal_campaign_ledger" ADD CONSTRAINT "FK_a41c621859d5e35f4bb6323e76a" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_f504363b1d2887384c1f2d6b80b') THEN ALTER TABLE "portal_referrals" ADD CONSTRAINT "FK_f504363b1d2887384c1f2d6b80b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_0007bc1db68a814b283d4601d92') THEN ALTER TABLE "portal_referrals" ADD CONSTRAINT "FK_0007bc1db68a814b283d4601d92" FOREIGN KEY ("referrerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    await queryRunner.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_951f8a93e3dec0acf5f37235447') THEN ALTER TABLE "portal_referrals" ADD CONSTRAINT "FK_951f8a93e3dec0acf5f37235447" FOREIGN KEY ("firstOrderId") REFERENCES "portal_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION; END IF; END $$`,
    );
    // Preserve opening balances; never synthesize rewards or replay old orders.
    await queryRunner.query(`INSERT INTO "portal_campaign_ledger" ("campaignId", "userId", "sourceKey", "kind", "points", "orderId", "actorId", "reason")
          SELECT "campaignId", "userId", 'baseline', 'baseline', "points", NULL, NULL, 'Migrated opening balance'
          FROM "portal_campaign_progress" ON CONFLICT ("campaignId", "userId", "sourceKey") DO NOTHING`);
    // Historical resources do not contain an authoritative order identifier.
    // Leave their links NULL rather than guessing from user/product/timestamps.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_referrals" DROP CONSTRAINT "FK_951f8a93e3dec0acf5f37235447"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_referrals" DROP CONSTRAINT "FK_0007bc1db68a814b283d4601d92"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_referrals" DROP CONSTRAINT "FK_f504363b1d2887384c1f2d6b80b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaign_ledger" DROP CONSTRAINT "FK_a41c621859d5e35f4bb6323e76a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaign_ledger" DROP CONSTRAINT "FK_9c7f2ebcdf9c700a983759d187c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaign_ledger" DROP CONSTRAINT "FK_fbf63054b0c4c76440b03436370"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaign_ledger" DROP CONSTRAINT "FK_d52724ef658a1701303913f2983"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tickets" DROP CONSTRAINT "FK_c29f1c2fdeece2ef4e7040cd313"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP CONSTRAINT "FK_cdb9e0a63ecb1ac1d506feca9cf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP CONSTRAINT "FK_b76e462a8f954d93e1acf95f79f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP CONSTRAINT "FK_b493c09e3fc61fa7fd32850310e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_vouchers" DROP CONSTRAINT "FK_babd08a54e9c75ff29b34982cbf"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c29f1c2fdeece2ef4e7040cd31"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0552d3c842159d8cc998de4459"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_babd08a54e9c75ff29b34982cb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_tickets" DROP COLUMN "orderItemId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP COLUMN "revokedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP COLUMN "consumedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP COLUMN "reservedOrderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP COLUMN "campaignId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_promo_codes" DROP COLUMN "ownerUserId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_campaigns" DROP COLUMN "rules"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_vouchers" DROP COLUMN "orderItemId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8aa44947b67e7b6e2b7e291877"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f504363b1d2887384c1f2d6b80"`,
    );
    await queryRunner.query(`DROP TABLE "portal_referrals"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_79c4ffb318008a6650d81fa676"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c7f2ebcdf9c700a983759d187"`,
    );
    await queryRunner.query(`DROP TABLE "portal_campaign_ledger"`);
  }
}
