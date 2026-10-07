import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalDomain1788929500000 implements MigrationInterface {
  name = 'AddPortalDomain1788929500000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredCity" varchar(80)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationsEnabled" boolean NOT NULL DEFAULT true`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_coupons" (
      "id" SERIAL PRIMARY KEY,
      "slug" varchar(160) NOT NULL UNIQUE,
      "title" varchar(180) NOT NULL,
      "merchant" varchar(180) NOT NULL,
      "city" varchar(100) NOT NULL,
      "location" varchar(180) NOT NULL,
      "category" varchar(80) NOT NULL,
      "price" integer NOT NULL,
      "oldPrice" integer,
      "discount" varchar(32),
      "expiresAt" timestamptz NOT NULL,
      "stockTotal" integer NOT NULL,
      "stockRemaining" integer NOT NULL,
      "imageUrl" varchar(255) NOT NULL,
      "description" text NOT NULL,
      "benefits" text NOT NULL,
      "terms" text NOT NULL,
      "redemption" text NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_coupons_city" ON "portal_coupons" ("city")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_coupons_category" ON "portal_coupons" ("category")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_coupons_expiresAt" ON "portal_coupons" ("expiresAt")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_events" (
      "id" SERIAL PRIMARY KEY,
      "slug" varchar(160) NOT NULL UNIQUE,
      "title" varchar(180) NOT NULL,
      "type" varchar(120) NOT NULL,
      "dateLabel" varchar(40) NOT NULL,
      "monthLabel" varchar(40) NOT NULL,
      "dayLabel" varchar(40) NOT NULL,
      "startsAt" timestamptz NOT NULL,
      "venue" varchar(160) NOT NULL,
      "city" varchar(100) NOT NULL,
      "timeLabel" varchar(40) NOT NULL,
      "basePrice" integer NOT NULL,
      "statusLabel" varchar(80) NOT NULL,
      "imageUrl" varchar(255) NOT NULL,
      "description" text NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_events_city" ON "portal_events" ("city")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_event_tickets" (
      "id" SERIAL PRIMARY KEY,
      "eventId" integer NOT NULL,
      "name" varchar(80) NOT NULL,
      "description" varchar(160) NOT NULL,
      "price" integer NOT NULL,
      "stockTotal" integer NOT NULL,
      "stockRemaining" integer NOT NULL,
      "statusLabel" varchar(80) NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp,
      CONSTRAINT "UQ_portal_event_ticket_name" UNIQUE ("eventId", "name")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_event_tickets_eventId" ON "portal_event_tickets" ("eventId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_bundles" (
      "id" SERIAL PRIMARY KEY,
      "slug" varchar(160) NOT NULL UNIQUE,
      "title" varchar(180) NOT NULL,
      "description" text NOT NULL,
      "couponSlug" varchar(160) NOT NULL,
      "eventSlug" varchar(160) NOT NULL,
      "price" integer NOT NULL,
      "imageUrl" varchar(255) NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_campaigns" (
      "id" SERIAL PRIMARY KEY,
      "slug" varchar(160) NOT NULL UNIQUE,
      "title" varchar(180) NOT NULL,
      "description" text NOT NULL,
      "rewardLabel" varchar(120) NOT NULL,
      "imageUrl" varchar(255) NOT NULL,
      "targetPoints" integer NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_faqs" (
      "id" SERIAL PRIMARY KEY,
      "position" integer NOT NULL DEFAULT 0,
      "question" varchar(240) NOT NULL,
      "answer" text NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_vouchers" (
      "id" SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "couponId" integer NOT NULL,
      "code" varchar(80) NOT NULL UNIQUE,
      "status" varchar(32) NOT NULL DEFAULT 'Issued',
      "expiresAt" timestamptz NOT NULL,
      "redeemedAt" timestamptz,
      "imageUrl" varchar(255) NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_vouchers_userId" ON "portal_vouchers" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_vouchers_couponId" ON "portal_vouchers" ("couponId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_tickets" (
      "id" SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "eventId" integer NOT NULL,
      "ticketTypeId" integer NOT NULL,
      "code" varchar(80) NOT NULL UNIQUE,
      "attendee" varchar(180) NOT NULL,
      "status" varchar(32) NOT NULL DEFAULT 'Issued',
      "imageUrl" varchar(255) NOT NULL,
      "checkedInAt" timestamptz,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_tickets_userId" ON "portal_tickets" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_tickets_eventId" ON "portal_tickets" ("eventId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_orders" (
      "id" SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "orderNumber" varchar(80) NOT NULL UNIQUE,
      "idempotencyKey" varchar(80) NOT NULL,
      "status" varchar(32) NOT NULL DEFAULT 'Pending',
      "kind" varchar(32) NOT NULL,
      "total" integer NOT NULL,
      "currency" varchar(3) NOT NULL DEFAULT 'IDR',
      "title" varchar(180) NOT NULL,
      "meta" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp,
      CONSTRAINT "UQ_portal_orders_user_idempotency" UNIQUE ("userId", "idempotencyKey")
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_orders_userId" ON "portal_orders" ("userId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_order_items" (
      "id" SERIAL PRIMARY KEY,
      "orderId" integer NOT NULL,
      "productType" varchar(32) NOT NULL,
      "productId" integer NOT NULL,
      "title" varchar(180) NOT NULL,
      "quantity" integer NOT NULL,
      "unitPrice" integer NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_order_items_orderId" ON "portal_order_items" ("orderId")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_follows" (
      "id" SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "targetType" varchar(32) NOT NULL,
      "targetKey" varchar(180) NOT NULL,
      "targetName" varchar(180) NOT NULL,
      "imageUrl" varchar(255) NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp,
      CONSTRAINT "UQ_portal_follows_target" UNIQUE ("userId", "targetType", "targetKey")
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_campaign_progress" (
      "id" SERIAL PRIMARY KEY,
      "userId" integer NOT NULL,
      "campaignId" integer NOT NULL,
      "points" integer NOT NULL DEFAULT 0,
      "targetPoints" integer NOT NULL,
      "status" varchar(40) NOT NULL DEFAULT 'pending',
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp,
      CONSTRAINT "UQ_portal_campaign_progress" UNIQUE ("userId", "campaignId")
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_email_otp_challenges" (
      "id" SERIAL PRIMARY KEY,
      "email" varchar(320) NOT NULL,
      "purpose" varchar(32) NOT NULL,
      "codeHash" varchar(128) NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "attempts" integer NOT NULL DEFAULT 0,
      "consumedAt" timestamptz,
      "requestIp" varchar(64),
      "lastSentAt" timestamptz,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now(),
      "deletedAt" timestamp
    )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_portal_otp_email" ON "portal_email_otp_challenges" ("email")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "portal_email_otp_challenges"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_campaign_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_follows"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_vouchers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_faqs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_campaigns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_bundles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_event_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "portal_coupons"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "notificationsEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "preferredCity"`,
    );
  }
}
