import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  setSystemTime,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminToken, createUser, tokenFor } from './utils/auth';
import { User } from '@/users/entities/user.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import {
  legacy,
  aware,
  StandardizeTimeZones1791000000000,
} from '@/database/migrations/1791000000000-StandardizeTimeZones';
import { createdInRange } from '@/common/helpers/created-in-range';
describe('Timezone contract and migration (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;
  let customer: string;
  let userId: number;
  let coupon: { id: number; slug: string; expiresAt: string; timeZone: string };
  const payload = {
    title: 'Timezone coupon',
    merchant: 'Timezone venue',
    city: 'Bali',
    location: 'Bali',
    category: 'Venue',
    price: 100,
    stockTotal: 20,
    stockRemaining: 20,
    imageUrl: 'https://example.test/time.jpg',
    description: 'Description',
    benefits: 'Benefit',
    terms: 'Terms',
    redemption: 'At merchant',
    active: true,
  };
  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    admin = `Bearer ${await adminToken(ctx)}`;
    const user = await createUser(ctx, {
      email: `timezone-${randomUUID()}@example.test`,
    });
    userId = user.id;
    customer = `Bearer ${tokenFor(ctx, user.id, user.email)}`;
  });
  afterAll(async () => {
    setSystemTime();
    await ctx?.app.close();
  });
  it('runs processes and database sessions in UTC and exposes public configuration', async () => {
    expect(process.env.TZ).toBe('UTC');
    expect(
      (
        await ctx.dataSource.query<Array<{ zone: string }>>(
          "SELECT current_setting('TimeZone') AS zone",
        )
      )[0].zone,
    ).toBe('UTC');
    const config = await request(server)
      .get('/api/portal/time/config')
      .expect(200);
    expect(config.body.defaultTimeZone).toBe('Asia/Jakarta');
    expect(config.body.businessTimeZones).toHaveLength(3);
  });
  it('stores one account preference, accepts automatic global zones and preserves explicit choice', async () => {
    await request(server).get('/api/portal/me/preferences').expect(401);
    await request(server)
      .patch('/api/portal/me/preferences')
      .set('Authorization', customer)
      .send({ timeZone: 'Asia/Jayapura' })
      .expect(200);
    const detected = await request(server)
      .patch('/api/portal/me/preferences')
      .set('Authorization', customer)
      .send({ lastDetectedTimeZone: 'America/New_York' })
      .expect(200);
    expect(detected.headers['cache-control']).toBe('no-store');
    expect(detected.body.timeZone).toBe('Asia/Jayapura');
    expect(
      (await ctx.dataSource.getRepository(User).findOneByOrFail({ id: userId }))
        .lastDetectedTimeZone,
    ).toBe('America/New_York');
    await request(server)
      .patch('/api/portal/me/preferences')
      .set('Authorization', customer)
      .send({ timeZone: 'not-a-zone' })
      .expect(400);
    const auto = await request(server)
      .patch('/api/portal/me/preferences')
      .set('Authorization', customer)
      .send({ timeZone: null })
      .expect(200);
    expect(auto.body.timeZone).toBeNull();
  });
  it('converts Indonesian local schedules and rejects invalid or ambiguous absolute fields', async () => {
    for (const [timeZone, instant] of [
      ['Asia/Jakarta', '2027-01-01T12:00:42.123Z'],
      ['Asia/Makassar', '2027-01-01T11:00:42.123Z'],
      ['Asia/Jayapura', '2027-01-01T10:00:42.123Z'],
    ]) {
      const preview = await request(server)
        .post('/api/portal/time/preview')
        .set('Authorization', admin)
        .send({ localDateTime: '2027-01-01T19:00:42.123', timeZone })
        .expect(201);
      expect(preview.body.instant).toBe(instant);
    }
    await request(server)
      .post('/api/portal/time/preview')
      .set('Authorization', admin)
      .send({ localDateTime: '2027-02-30T19:00', timeZone: 'Asia/Makassar' })
      .expect(400);
    const response = await request(server)
      .post('/api/portal/admin/coupons')
      .set('Authorization', admin)
      .send({
        ...payload,
        timeZone: 'Asia/Makassar',
        localTimes: { expiresAt: '2027-01-01T19:00:42.123' },
      })
      .expect(201);
    coupon = response.body;
    expect(coupon.expiresAt).toBe('2027-01-01T11:00:42.123Z');
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ expiresAt: '2027-01-01T19:00:42.123' })
      .expect(400);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        expiresAt: coupon.expiresAt,
        localTimes: { expiresAt: '2027-01-01T19:00' },
        timeZone: 'Asia/Makassar',
      })
      .expect(400);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', customer)
      .send({ timeZone: 'Asia/Jakarta' })
      .expect(403);
  });
  it('requires explicit timezone change intent and keeps issued gift snapshots unchanged', async () => {
    const gift = await request(server)
      .post('/api/portal/me/gifts')
      .set('Authorization', customer)
      .send({
        slug: coupon.slug,
        recipientName: 'Recipient',
        recipientEmail: 'recipient-time@example.test',
      })
      .expect(201);
    expect(gift.body.timeZone).toBe('Asia/Makassar');
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ timeZone: 'Asia/Jakarta' })
      .expect(400);
    const preserved = await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        timeZone: 'Asia/Jakarta',
        timeZoneChangeMode: 'preserveInstant',
        timeZoneChangeReason: 'Keep deadline',
      })
      .expect(200);
    expect(preserved.body.expiresAt).toBe(coupon.expiresAt);
    const local = await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        timeZone: 'Asia/Jayapura',
        timeZoneChangeMode: 'preserveLocal',
        timeZoneChangeReason: 'Keep local deadline',
      })
      .expect(200);
    expect(local.body.expiresAt).toBe('2027-01-01T09:00:42.123Z');
    const snapshot = await ctx.dataSource
      .getRepository(PortalGift)
      .findOneByOrFail({ id: gift.body.id });
    expect(snapshot.timeZone).toBe('Asia/Makassar');
    expect(snapshot.expiresAt.toISOString()).toBe(coupon.expiresAt);
    await request(server)
      .patch('/api/portal/me/preferences')
      .set('Authorization', customer)
      .send({ timeZone: 'Asia/Jakarta' })
      .expect(200);
    expect(
      (
        await ctx.dataSource
          .getRepository(PortalCoupon)
          .findOneByOrFail({ id: coupon.id })
      ).expiresAt.toISOString(),
    ).toBe(local.body.expiresAt);
  });
  it('inherits event zone for slots and validates intervals after partial edits', async () => {
    const response = await request(server)
      .post('/api/portal/admin/events')
      .set('Authorization', admin)
      .send({
        title: `Timezone event ${randomUUID()}`,
        type: 'Music',
        dateLabel: '1',
        monthLabel: 'Jan',
        dayLabel: 'Friday',
        venue: 'Venue',
        city: 'Bali',
        timeLabel: '19:00',
        basePrice: 100,
        statusLabel: 'Available',
        imageUrl: 'https://example.test/event.jpg',
        description: 'Event',
        timeZone: 'Asia/Makassar',
        localTimes: { startsAt: '2027-01-01T19:00:42.123' },
      })
      .expect(201);
    const event = response.body;
    expect(event.startsAt).toBe('2027-01-01T11:00:42.123Z');
    const slot = (
      await request(server)
        .post('/api/portal/admin/booking-slots')
        .set('Authorization', admin)
        .send({
          eventId: event.id,
          timeZone: 'Asia/Makassar',
          localTimes: {
            startsAt: '2027-01-01T19:00:42.123',
            endsAt: '2027-01-01T20:00:42.123',
          },
          capacity: 10,
        })
        .expect(201)
    ).body;
    expect(slot.startsAt).toBe(event.startsAt);
    expect(slot.endsAt).toBe('2027-01-01T12:00:42.123Z');
    await request(server)
      .patch(`/api/portal/admin/booking-slots/${slot.id}`)
      .set('Authorization', admin)
      .send({ endsAt: slot.startsAt })
      .expect(400);
    await request(server)
      .patch(`/api/portal/admin/booking-slots/${slot.id}`)
      .set('Authorization', admin)
      .send({
        timeZone: 'Asia/Jakarta',
        localTimes: { endsAt: '2027-01-01T22:00' },
      })
      .expect(400);
    const changed = (
      await request(server)
        .patch(`/api/portal/admin/events/${event.id}`)
        .set('Authorization', admin)
        .send({
          timeZone: 'Asia/Jayapura',
          timeZoneChangeMode: 'preserveLocal',
          timeZoneChangeReason: 'Correct event zone',
        })
        .expect(200)
    ).body;
    expect(changed.startsAt).toBe('2027-01-01T10:00:42.123Z');
    const unchangedSlot = (
      await request(server)
        .get(`/api/portal/admin/booking-slots/${slot.id}`)
        .set('Authorization', admin)
        .expect(200)
    ).body;
    expect(unchangedSlot.startsAt).toBe(slot.startsAt);
  });
  it('enforces deadline before, on and after the exclusive endpoint using backend time', async () => {
    const deadline = new Date(Date.now() + 60_000);
    try {
      for (const [offset, status] of [
        [-1, 201],
        [0, 409],
        [1, 409],
      ]) {
        const row = await request(server)
          .post('/api/portal/admin/coupons')
          .set('Authorization', admin)
          .send({
            ...payload,
            title: `Boundary ${randomUUID()}`,
            expiresAt: deadline.toISOString(),
          })
          .expect(201);
        setSystemTime(new Date(deadline.getTime() + offset));
        await request(server)
          .post(`/api/portal/coupons/${row.body.slug}/claim`)
          .set('Authorization', customer)
          .send({})
          .expect(status);
        setSystemTime();
      }
    } finally {
      setSystemTime();
    }
  });
  it('filters report days using local midnight and an exclusive following midnight', async () => {
    for (const zone of ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']) {
      const range = createdInRange(
        'today',
        new Date('2026-10-02T16:00:00Z'),
        zone,
      )!;
      expect(range.from.getTime()).toBeLessThanOrEqual(
        Date.parse('2026-10-02T16:00:00Z'),
      );
      const results = await ctx.dataSource.query<Array<{ included: boolean }>>(
        'SELECT $1::timestamptz >= $2::timestamptz AND $1::timestamptz < $3::timestamptz AS included',
        [
          range.to.toISOString(),
          range.from.toISOString(),
          range.to.toISOString(),
        ],
      );
      expect(results[0].included).toBe(false);
      await request(server)
        .get(`/api/stats/signups?days=7&timeZone=${zone}`)
        .set('Authorization', admin)
        .expect(200);
    }
    await request(server)
      .get('/api/stats/signups?timeZone=invalid')
      .set('Authorization', admin)
      .expect(400);
  });
  it('converts proven legacy UTC columns without shifting instants and restores naive UTC on rollback', async () => {
    const runner = ctx.dataSource.createQueryRunner();
    const schema = 'timezone_' + randomUUID().replaceAll('-', '');
    const previous = process.env.LEGACY_TIMESTAMP_TIME_ZONE;
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET LOCAL search_path TO "${schema}"`);
      const tables = new Map<string, Array<[string, string]>>();
      for (const [table, column] of legacy)
        tables.set(table, [
          ...(tables.get(table) ?? []),
          [column, 'timestamp'],
        ]);
      for (const [table, column] of aware)
        tables.set(table, [
          ...(tables.get(table) ?? []),
          [column, 'timestamptz'],
        ]);
      for (const [table, columns] of tables)
        await runner.query(
          `CREATE TABLE "${table}" (id integer, ${columns.map(([column, type]) => `"${column}" ${type}`).join(',')})`,
        );
      await runner.query(
        `INSERT INTO "users" (id, "createdAt") VALUES (1, TIMESTAMP '2026-10-02 16:00:42.123')`,
      );
      const migration = new StandardizeTimeZones1791000000000();
      delete process.env.LEGACY_TIMESTAMP_TIME_ZONE;
      await expect(migration.up(runner)).rejects.toThrow(
        'Verify legacy timestamp provenance',
      );
      process.env.LEGACY_TIMESTAMP_TIME_ZONE = 'UTC';
      await migration.up(runner);
      const after = await runner.query<Array<{ stamp: Date; count: string }>>(
        `SELECT "createdAt" AS stamp, count(*) OVER() AS count FROM "users"`,
      );
      expect(after[0].stamp.toISOString()).toBe('2026-10-02T16:00:42.123Z');
      expect(after[0].count).toBe('1');
      const precision = await runner.query<
        Array<{ datetime_precision: number }>
      >(
        'SELECT datetime_precision FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3',
        [schema, 'users', 'createdAt'],
      );
      expect(precision[0].datetime_precision).toBe(3);
      await migration.down(runner);
      const before = await runner.query<Array<{ stamp: Date }>>(
        `SELECT "createdAt" AS stamp FROM "users"`,
      );
      expect(before[0].stamp.toISOString()).toBe('2026-10-02T16:00:42.123Z');
    } finally {
      if (previous === undefined) delete process.env.LEGACY_TIMESTAMP_TIME_ZONE;
      else process.env.LEGACY_TIMESTAMP_TIME_ZONE = previous;
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
