import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { AddCouponPackagesAndGallery1790900000000 } from '@/database/migrations/1790900000000-AddCouponPackagesAndGallery';

describe('Coupon gallery and packages (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;
  let customer: string;
  let other: string;
  let recipient: string;
  let coupon: {
    id: number;
    slug: string;
    packages: Array<{ publicId: string; stockRemaining: number }>;
  };
  const payload = () => ({
    title: 'Package test',
    merchant: 'Test venue',
    city: 'Jakarta',
    location: 'Jakarta',
    category: 'Venue',
    price: 100,
    stockTotal: 2,
    stockRemaining: 2,
    imageUrl: 'https://example.test/one.jpg',
    description: 'Description',
    benefits: 'Benefit',
    terms: 'Terms',
    redemption: 'At merchant',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    active: true,
    images: [
      { url: 'https://example.test/one.jpg', alt: 'First' },
      { url: 'https://example.test/two.jpg', alt: 'Second' },
    ],
    packages: [
      {
        name: 'For one',
        benefits: 'One guest',
        price: 100,
        oldPrice: 200,
        stockTotal: 1,
        active: true,
      },
      {
        name: 'For two',
        benefits: 'Two guests',
        price: 180,
        oldPrice: 300,
        stockTotal: 3,
        active: true,
      },
    ],
  });
  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    admin = `Bearer ${await adminToken(ctx)}`;
  });
  beforeEach(async () => {
    await ctx.dataSource.getRepository(PortalGift).deleteAll();
    await cleanDatabase(ctx.dataSource, adminEmail());
    await ctx.dataSource.getRepository(PortalCouponPackage).deleteAll();
    await ctx.dataSource.getRepository(PortalCoupon).deleteAll();
    const user = await createUser(ctx, { email: 'package@example.test' });
    const user2 = await createUser(ctx, {
      email: 'other-package@example.test',
    });
    const recipientUser = await createUser(ctx, {
      email: 'recipient-package@example.test',
    });
    customer = `Bearer ${tokenFor(ctx, user.id, user.email)}`;
    other = `Bearer ${tokenFor(ctx, user2.id, user2.email)}`;
    recipient = `Bearer ${tokenFor(ctx, recipientUser.id, recipientUser.email)}`;
    const response = await request(server)
      .post('/api/portal/admin/coupons')
      .set('Authorization', admin)
      .send(payload())
      .expect(201);
    coupon = response.body;
  });
  it('roundtrips UTC timestamps and rejects zone-less absolute input', async () => {
    const utc = '2027-01-01T16:59:42.123Z';
    const first = await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ expiresAt: utc })
      .expect(200);
    expect(first.body.expiresAt).toBe(utc);
    const second = await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ expiresAt: first.body.expiresAt })
      .expect(200);
    expect(second.body.expiresAt).toBe(utc);
    const legacy = await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ expiresAt: '2027-01-01T23:59:42.123' })
      .expect(400);
    expect(legacy.body.message).toBeDefined();
    const stored = await ctx.dataSource
      .getRepository(PortalCoupon)
      .findOneByOrFail({ id: coupon.id });
    expect(stored.expiresAt.toISOString()).toBe(utc);
    const rows = await ctx.dataSource.query<
      Array<{ zone: string; stamp: Date }>
    >(
      "SELECT current_setting('TimeZone') AS zone, TIMESTAMP '2026-10-18 16:59:42.123' AS stamp",
    );
    expect(rows[0].zone).toBe('UTC');
    expect(rows[0].stamp.toISOString()).toBe('2026-10-18T16:59:42.123Z');
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  const claim = (auth: string, packagePublicId?: string) =>
    request(server)
      .post(`/api/portal/coupons/${coupon.slug}/claim`)
      .set('Authorization', auth)
      .send(packagePublicId ? { packagePublicId } : {});

  it('returns ordered media and packages anonymously, filters price and guards writes', async () => {
    const response = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(
      response.body.images.map((image: { alt: string }) => image.alt),
    ).toEqual(['First', 'Second']);
    expect(response.body.packages).toHaveLength(2);
    expect(response.body.price).toBe(100);
    expect(response.body.stockRemaining).toBe(4);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', customer)
      .send({ title: 'Forbidden' })
      .expect(403);
    await request(server)
      .post(`/api/portal/coupons/${coupon.slug}/claim`)
      .send({ packagePublicId: coupon.packages[0].publicId })
      .expect(401);
    await claim(customer, 'invalid').expect(400);
    await claim(customer, randomUUID()).expect(404);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ images: [{ url: 'javascript:alert(1)', alt: '' }] })
      .expect(400);
  });
  it('accepts 10 gallery images and rejects 11 atomically', async () => {
    const images = Array.from({ length: 10 }, (_, index) => ({
      url: `https://example.test/${index}.jpg`,
      alt: `Photo ${index}`,
    }));
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ images })
      .expect(200);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        images: [
          ...images,
          { url: 'https://example.test/extra.jpg', alt: 'Extra' },
        ],
      })
      .expect(400);
    const detail = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(detail.body.images).toHaveLength(10);
  });
  it('serializes concurrent claims for the last unit and allows a different package', async () => {
    const results = await Promise.all([
      claim(customer, coupon.packages[0].publicId),
      claim(other, coupon.packages[0].publicId),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const winner = results[0].status === 201 ? customer : other;
    const first = results.find((result) => result.status === 201)!;
    const repeat = await claim(winner, coupon.packages[0].publicId).expect(201);
    expect(repeat.body.id).toBe(first.body.id);
    const second = await claim(winner, coupon.packages[1].publicId).expect(201);
    expect(second.body.package.name).toBe('For two');
    expect(second.body.id).not.toBe(first.body.id);
    const detail = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(detail.body.price).toBe(180);
    expect(detail.body.stockRemaining).toBe(2);
  });
  it('keeps package snapshots on gifts and vouchers and preserves issued stock during edits', async () => {
    const selected = coupon.packages[1].publicId;
    const gift = await request(server)
      .post('/api/portal/me/gifts')
      .set('Authorization', customer)
      .send({
        slug: coupon.slug,
        packagePublicId: selected,
        recipientName: 'Recipient',
        recipientEmail: 'recipient-package@example.test',
      })
      .expect(201);
    const before = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    const update = payload().packages.map((item, index) => ({
      ...item,
      publicId: coupon.packages[index].publicId,
      name: index === 1 ? 'Changed package' : item.name,
      stockTotal: index === 1 ? 5 : item.stockTotal,
    }));
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ packages: update })
      .expect(200);
    const after = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(before.body.packages[1].stockRemaining).toBe(2);
    expect(after.body.packages[1].stockRemaining).toBe(4);
    const publicGift = await request(server)
      .get(`/api/portal/gifts/${gift.body.code}`)
      .expect(200);
    expect(publicGift.body.package.name).toBe('For two');
    const redeemed = await request(server)
      .post(`/api/portal/gifts/${gift.body.code}/redeem`)
      .set('Authorization', recipient)
      .send({})
      .expect(201);
    expect(redeemed.body.package.benefits).toBe('Two guests');
    const final = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(final.body.packages[1].stockRemaining).toBe(4);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ packages: [{ ...update[1], stockTotal: 0 }] })
      .expect(409);
  });
  it('keeps a default package for legacy requests and deactivates removed packages', async () => {
    const first = await claim(customer).expect(201);
    expect(first.body.package.name).toBe('For one');
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        packages: [
          { ...payload().packages[1], publicId: coupon.packages[1].publicId },
        ],
      })
      .expect(200);
    await claim(other).expect(409);
    const detail = await request(server)
      .get(`/api/portal/catalog/coupons/${coupon.slug}`)
      .expect(200);
    expect(detail.body.packages).toHaveLength(1);
    expect((await claim(customer).expect(201)).body.package.name).toBe(
      'For one',
    );
    const voucher = await request(server)
      .get(`/api/portal/me/vouchers/${first.body.id}`)
      .set('Authorization', customer)
      .expect(200);
    expect(voucher.body.package.name).toBe('For one');
  });
  it('rejects expired and inactive packages and rolls back invalid admin changes', async () => {
    const update = payload().packages.map((item, index) => ({
      ...item,
      publicId: coupon.packages[index].publicId,
      active: false,
    }));
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({ packages: update })
      .expect(200);
    await claim(customer, coupon.packages[0].publicId).expect(409);
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        title: 'Must rollback',
        packages: [{ ...update[0], publicId: randomUUID() }],
      })
      .expect(400);
    expect(
      (
        await request(server)
          .get(`/api/portal/catalog/coupons/${coupon.slug}`)
          .expect(200)
      ).body.title,
    ).toBe('Package test');
    await request(server)
      .patch(`/api/portal/admin/coupons/${coupon.id}`)
      .set('Authorization', admin)
      .send({
        expiresAt: new Date(0).toISOString(),
        packages: update.map((item) => ({ ...item, active: true })),
      })
      .expect(200);
    await claim(customer, coupon.packages[1].publicId).expect(409);
  });
  it('backfills legacy coupons and owned resources using the migration in an isolated schema', async () => {
    const runner = ctx.dataSource.createQueryRunner();
    await runner.connect();
    const schema = `coupon_migration_${Date.now()}`;
    try {
      await runner.query(`CREATE SCHEMA "${schema}"`);
      await runner.query(`SET search_path TO "${schema}", public`);
      await runner.query(
        `CREATE TABLE portal_coupons (id serial PRIMARY KEY, title varchar(180), "imageUrl" varchar(255), benefits text, price integer, "oldPrice" integer, "stockTotal" integer, "stockRemaining" integer)`,
      );
      await runner.query(
        `CREATE TABLE portal_vouchers (id serial PRIMARY KEY, "userId" integer, "couponId" integer)`,
      );
      await runner.query(
        `CREATE TABLE portal_gifts (id serial PRIMARY KEY, "couponId" integer)`,
      );
      await runner.query(
        `INSERT INTO portal_coupons (title, "imageUrl", benefits, price, "stockTotal", "stockRemaining") VALUES ('Legacy', 'https://example.test/legacy.jpg', 'Legacy benefit', 10, 5, 3)`,
      );
      await runner.query(
        `INSERT INTO portal_vouchers ("userId", "couponId") VALUES (1, 1)`,
      );
      await runner.query(`INSERT INTO portal_gifts ("couponId") VALUES (1)`);
      const migration = new AddCouponPackagesAndGallery1790900000000();
      await migration.up(runner);
      const [legacy] = await runner.query(
        `SELECT * FROM portal_coupon_packages`,
      );
      expect(legacy.stockRemaining).toBe(3);
      expect(legacy.isDefault).toBe(true);
      for (const table of ['portal_vouchers', 'portal_gifts']) {
        const [owned] = await runner.query(`SELECT * FROM "${table}"`);
        expect(owned.packageId).toBe(legacy.id);
        expect(owned.packageSnapshot.name).toBe('Legacy');
      }
      await migration.down(runner);
      expect(
        (await runner.query(`SELECT title FROM portal_coupons`))[0].title,
      ).toBe('Legacy');
    } finally {
      await runner.query('SET search_path TO public');
      await runner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await runner.release();
    }
  });
});
