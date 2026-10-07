import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalCommerceFlow1789612000000 implements MigrationInterface {
  name = 'AddPortalCommerceFlow1789612000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_promo_codes" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "code" character varying(40) NOT NULL,
      "kind" character varying(20) NOT NULL,
      "value" integer NOT NULL,
      "minimumOrder" integer NOT NULL DEFAULT 0,
      "maximumDiscount" integer,
      "usageLimit" integer,
      "usageCount" integer NOT NULL DEFAULT 0,
      "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "active" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      CONSTRAINT "PK_portal_promo_codes" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_promo_codes_publicId" ON "portal_promo_codes" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_promo_codes_code" ON "portal_promo_codes" ("code")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_booking_slots" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "eventId" integer NOT NULL,
      "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "endsAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "capacity" integer NOT NULL,
      "remaining" integer NOT NULL,
      "status" character varying(32) NOT NULL DEFAULT 'Available',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      CONSTRAINT "PK_portal_booking_slots" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_booking_slots_publicId" ON "portal_booking_slots" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_booking_slots_event_startsAt" ON "portal_booking_slots" ("eventId", "startsAt")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "portal_bookings" (
      "id" SERIAL NOT NULL,
      "publicId" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" integer NOT NULL,
      "eventId" integer NOT NULL,
      "slotId" integer NOT NULL,
      "attendee" character varying(180) NOT NULL,
      "status" character varying(32) NOT NULL DEFAULT 'Reserved',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      "deletedAt" TIMESTAMP,
      CONSTRAINT "PK_portal_bookings" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_bookings_publicId" ON "portal_bookings" ("publicId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_portal_bookings_user_slot" ON "portal_bookings" ("userId", "slotId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "subtotal" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "discount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "promoCode" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "paymentMethod" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_orders" ADD COLUMN IF NOT EXISTS "cashbackAmount" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_gifts" ADD COLUMN IF NOT EXISTS "recipientUserId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_gifts" ADD COLUMN IF NOT EXISTS "redeemedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "portal_gifts" DROP COLUMN IF EXISTS "redeemedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_gifts" DROP COLUMN IF EXISTS "recipientUserId"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "cashbackAmount"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "paidAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "paymentMethod"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "promoCode"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "discount"',
    );
    await queryRunner.query(
      'ALTER TABLE "portal_orders" DROP COLUMN IF EXISTS "subtotal"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "portal_bookings"');
    await queryRunner.query('DROP TABLE IF EXISTS "portal_booking_slots"');
    await queryRunner.query('DROP TABLE IF EXISTS "portal_promo_codes"');
  }
}
