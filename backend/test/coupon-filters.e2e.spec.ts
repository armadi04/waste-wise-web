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
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';

describe('Coupon catalog filters (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  const path = '/api/portal/catalog/coupons';
  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    await adminToken(ctx);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await ctx.dataSource.query(
      `DELETE FROM portal_reviews WHERE "targetKey" LIKE 'filter-test-%'`,
    );
    await cleanDatabase(ctx.dataSource, adminEmail());
    await ctx.dataSource.query(
      `DELETE FROM portal_coupon_packages WHERE "couponId" IN (SELECT id FROM portal_coupons WHERE slug LIKE 'filter-test-%')`,
    );
    await ctx.dataSource.query(
      `DELETE FROM portal_coupons WHERE slug LIKE 'filter-test-%'`,
    );
    const reviewers = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createUser(ctx, { email: `filter-${index}@example.test` }),
      ),
    );
    const coupons = ctx.dataSource.getRepository(PortalCoupon);
    const packages = ctx.dataSource.getRepository(PortalCouponPackage);
    const reviews = ctx.dataSource.getRepository(PortalReview);
    for (let index = 0; index < 32; index++) {
      const coupon = await coupons.save(
        coupons.create({
          slug: `filter-test-${index}`,
          title: `Filter test ${index}`,
          merchant: 'Test merchant',
          city: index === 30 ? 'Elsewhere' : 'Filter Test',
          location: 'Test location',
          category: index % 2 ? 'Venue' : 'Kuliner malam',
          price: 100000,
          oldPrice: index === 28 ? null : index === 29 ? 50000 : 199000,
          discount: index === 28 || index === 29 ? null : '-50%',
          stockTotal: 10,
          stockRemaining: 10,
          imageUrl: '/test.jpg',
          description: 'Test',
          benefits: 'Test',
          terms: 'Test',
          redemption: 'Test',
          active: index !== 31,
          expiresAt: new Date('2030-01-01'),
          createdAt: new Date('2026-01-01'),
        }),
      );
      for (const price of [100000, 200000])
        await packages.save(
          packages.create({
            couponId: coupon.id,
            name: 'Test package',
            benefits: 'Test',
            price,
            oldPrice: 199000,
            active: true,
            stockTotal: 5,
            stockRemaining: 5,
            isDefault: price === 100000,
            position: price === 100000 ? 0 : 1,
          }),
        );
      if (index < 27) {
        for (let reviewIndex = 0; reviewIndex < 5; reviewIndex++)
          await reviews.save(
            reviews.create({
              userId: reviewers[reviewIndex].id,
              targetType: 'coupon',
              targetKey: coupon.slug,
              authorName: 'Test',
              rating: reviewIndex === 4 ? 1 : reviewIndex === 3 ? 4 : 5,
              body: 'Test',
              verified: reviewIndex < 2,
              deletedAt: reviewIndex === 4 ? new Date() : null,
            }),
          );
      }
    }
  });
  it('combines filters before count/pagination and does not multiply package/review joins', async () => {
    const query = {
      city: 'Filter Test',
      q: 'Filter test',
      category: ['Venue', 'Kuliner malam'],
      minPrice: 100000,
      maxPrice: 100000,
      minDiscount: 50,
      minRating: 4.8,
      sort: 'price-asc',
      limit: 24,
    };
    const first = await request(server).get(path).query(query).expect(200);
    expect(first.body.meta).toEqual({ total: 27, page: 1, lastPage: 2 });
    expect(first.body.data).toHaveLength(24);
    expect(first.body.data[0].slug).toBe('filter-test-26');
    expect(first.body.data[0].reviews).toEqual({
      rating: 4.8,
      reviewCount: 4,
      verifiedReviewCount: 2,
    });
    expect(first.body.data[0].packages).toHaveLength(2);
    const second = await request(server)
      .get(path)
      .query({ ...query, page: 2 })
      .expect(200);
    expect(second.body.data.map((item: { slug: string }) => item.slug)).toEqual(
      ['filter-test-2', 'filter-test-1', 'filter-test-0'],
    );
    for (const sort of ['latest', 'price-desc', 'ending-soon']) {
      const ordered = await request(server)
        .get(path)
        .query({ ...query, sort })
        .expect(200);
      expect(ordered.body.data[0].slug).toBe('filter-test-26');
    }
  });
  it('uses inclusive starting-price bounds and rounded discounts/ratings, and excludes unrated offers', async () => {
    const count = async (query: Record<string, unknown>) => {
      const result = await request(server)
        .get(path)
        .query({ city: 'Filter Test', ...query })
        .expect(200);
      return result.body.meta.total as number;
    };
    expect(await count({})).toBe(30);
    expect(
      await count({
        minPrice: '',
        maxPrice: '',
        minDiscount: '',
        minRating: '',
      }),
    ).toBe(30);
    expect(await count({ minPrice: 100001 })).toBe(0);
    expect(await count({ minPrice: Number.MAX_SAFE_INTEGER })).toBe(0);
    expect(await count({ maxPrice: Number.MAX_SAFE_INTEGER })).toBe(30);
    expect(await count({ maxPrice: 99999 })).toBe(0);
    expect(await count({ minPrice: 0, maxPrice: 100000 })).toBe(30);
    expect(await count({ minDiscount: 50 })).toBe(28);
    expect(await count({ minDiscount: 50.1 })).toBe(0);
    expect(await count({ minDiscount: 0 })).toBe(30);
    expect(await count({ minRating: 0 })).toBe(27);
    expect(await count({ minRating: 4.81 })).toBe(0);
    expect(await count({ category: ['Venue'], minRating: 4.8 })).toBe(13);
    expect(await count({ q: 'missing' })).toBe(0);
    const page = await request(server)
      .get(path)
      .query({ city: 'Filter Test' })
      .expect(200);
    expect(
      page.body.data.find(
        (item: { slug: string }) => item.slug === 'filter-test-29',
      ).reviews,
    ).toEqual({ rating: null, reviewCount: 0, verifiedReviewCount: 0 });
  });
  it('rounds decimal ties consistently across filters, catalog cards and detail', async () => {
    const repo = ctx.dataSource.getRepository(PortalReview);
    await repo.delete({ targetType: 'coupon', targetKey: 'filter-test-0' });
    for (let index = 0; index < 20; index++) {
      const user = await createUser(ctx, {
        email: `rounding-${index}@example.test`,
      });
      await repo.save(
        repo.create({
          userId: user.id,
          targetType: 'coupon',
          targetKey: 'filter-test-0',
          authorName: 'Test',
          rating: index < 11 ? 5 : 4,
          body: 'Test',
          verified: true,
        }),
      );
    }
    const list = await request(server)
      .get(path)
      .query({ city: 'Filter Test', q: 'Filter test 0', minRating: 4.6 })
      .expect(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].reviews.rating).toBe(4.6);
    const detail = await request(server)
      .get(`${path}/filter-test-0`)
      .expect(200);
    expect(detail.body.reviews).toEqual(list.body.data[0].reviews);
    const excluded = await request(server)
      .get(path)
      .query({ city: 'Filter Test', q: 'Filter test 0', minRating: 4.61 })
      .expect(200);
    expect(excluded.body.meta.total).toBe(0);
  });
  it('rejects invalid numbers and reversed ranges without changing event queries', async () => {
    for (const query of [
      'minPrice=-1',
      'maxPrice=1.5',
      'minPrice=abc',
      'maxPrice=9007199254740992',
      'minDiscount=101',
      'minDiscount=-1',
      'minRating=5.1',
      'minRating=-1',
      'minRating=NaN',
      'minPrice=200000&maxPrice=100000',
    ])
      await request(server).get(`${path}?${query}`).expect(400);
    await request(server)
      .get('/api/portal/catalog/events?minPrice=-1&minRating=99')
      .expect(200);
  });
});
