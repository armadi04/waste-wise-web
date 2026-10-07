import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { AddCouponCategoriesAndCities1791180000000 } from '@/database/migrations/1791180000000-AddCouponCategoriesAndCities';
import {
  PortalBroadcastAdminService,
  PortalCityAdminService,
  PortalCouponCategoryAdminService,
} from '@/portal/admin/portal-admin-catalog.service';
import {
  PortalCustomerAdminService,
  PortalGiftAdminService,
  PortalWalletAdminService,
} from '@/portal/admin/portal-admin-records.service';
import { PortalBroadcast } from '@/portal/customer/entities/portal-broadcast.entity';
import { PortalCity } from '@/portal/catalog/entities/portal-city.entity';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';
import { DEMO_EVENT_SEEDS } from '@/portal/seed/portal-event-seed.data';
import { Role } from '@/roles/entities/role.entity';
import { User } from '@/users/entities/user.entity';

// Service-level PostgreSQL tests for admin data rules. Runs only in a random,
// disposable schema of kuponmalam_test; never the application database.
if (process.env.DB_NAME !== 'kuponmalam_test')
  throw new Error('Portal admin integration requires kuponmalam_test');

const schema = `portal_admin_test_${randomUUID().replaceAll('-', '')}`;
let db: DataSource;
let events: EventEmitter2;
let customerRole: Role;

async function makeUser(patch: Partial<User> = {}, customer = true) {
  return db.getRepository(User).save({
    email: `${randomUUID()}@example.test`,
    password: 'test-only',
    fullname: 'Admin integration',
    ...(customer ? { roles: [customerRole] } : {}),
    ...patch,
  });
}

async function makeCoupon(patch: Partial<PortalCoupon> = {}) {
  return db.getRepository(PortalCoupon).save({
    slug: `coupon-${randomUUID()}`,
    title: 'Test coupon',
    merchant: 'Test',
    city: 'Jakarta',
    location: 'Jakarta',
    category: 'Food',
    price: 0,
    expiresAt: new Date(Date.now() + 86400000),
    stockTotal: 10,
    stockRemaining: 10,
    imageUrl: 'https://example.test/image.jpg',
    description: 'Test',
    benefits: 'Test',
    terms: 'Test',
    redemption: 'Test',
    active: true,
    ...patch,
  });
}

async function makeEvent(city: string) {
  return db.getRepository(PortalEvent).save({
    ...DEMO_EVENT_SEEDS[0].event,
    slug: `event-${randomUUID()}`,
    city,
    startsAt: new Date(Date.now() + 86400000),
  });
}

/** Runs `work` inside a transaction scoped to the test schema, then rolls it back. */
async function inRolledBackSchema(
  work: (
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>,
    runner: ReturnType<DataSource['createQueryRunner']>,
  ) => Promise<void>,
) {
  const runner = db.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    // public stays on the path for uuid_generate_v4().
    await runner.query(`SET LOCAL search_path TO "${schema}", public`);
    await work(
      (sql, params) => runner.query(sql, params) as Promise<unknown[]>,
      runner,
    );
  } finally {
    await runner.rollbackTransaction();
    await runner.release();
  }
}

beforeAll(async () => {
  db = new DataSource({
    ...AppDataSource.options,
    database: 'kuponmalam_test',
    schema,
    migrations: [],
    synchronize: false,
    logging: false,
  });
  await db.initialize();
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.synchronize();
  events = new EventEmitter2();
  customerRole = await db
    .getRepository(Role)
    .save({ name: 'customer', description: 'Portal customer' });
}, 30000);

afterAll(async () => {
  if (db?.isInitialized) {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.destroy();
  }
});

beforeEach(async () => {
  // Each test owns its rows; clear shared catalog lists so name rules are deterministic.
  await db.query(
    `TRUNCATE "${schema}".portal_commerce_outbox, "${schema}".portal_broadcasts RESTART IDENTITY`,
  );
});

describe('category and city backfill migration', () => {
  it('builds curated lists from catalog text, keeps lane copy and links coupons', async () => {
    const coupons = [
      await makeCoupon({ category: 'Kuliner malam', city: 'Jakarta' }),
      await makeCoupon({ category: ' kuliner MALAM ', city: ' jakarta' }),
      await makeCoupon({ category: 'Spa & Bar', city: 'Bandung' }),
      await makeCoupon({ category: 'Spa  Bar', city: 'Bandung' }),
    ];
    const event = await makeEvent('Surabaya');

    await inRolledBackSchema(async (query, runner) => {
      const migration = new AddCouponCategoriesAndCities1791180000000();
      await migration.down(runner);
      await migration.up(runner);

      const categories = (await query(
        'SELECT name, slug, label, featured FROM portal_coupon_categories ORDER BY slug',
      )) as Array<{
        name: string;
        slug: string;
        label: string | null;
        featured: boolean;
      }>;
      expect(categories[0]).toEqual({
        name: 'Kuliner malam',
        slug: 'kuliner-malam',
        label: 'Makan',
        featured: true,
      });
      // Distinct names whose slugs collide get numbered suffixes.
      expect(
        categories
          .slice(1)
          .map((row) => row.name)
          .sort(),
      ).toEqual(['Spa  Bar', 'Spa & Bar']);
      expect(categories.slice(1).map((row) => row.slug)).toEqual([
        'spa-bar',
        'spa-bar-2',
      ]);

      const linked = (await query(
        `SELECT c.category, c.city, cat.name AS linked FROM portal_coupons c
         LEFT JOIN portal_coupon_categories cat ON cat.id = c."categoryId"
         WHERE c.id = ANY($1) ORDER BY c.id`,
        [coupons.map((coupon) => coupon.id)],
      )) as Array<{ category: string; city: string; linked: string | null }>;
      expect(linked.map((row) => [row.category, row.city, row.linked])).toEqual(
        [
          ['Kuliner malam', 'Jakarta', 'Kuliner malam'],
          ['Kuliner malam', 'Jakarta', 'Kuliner malam'],
          ['Spa & Bar', 'Bandung', 'Spa & Bar'],
          ['Spa  Bar', 'Bandung', 'Spa  Bar'],
        ],
      );

      const cities = (await query(
        'SELECT name FROM portal_cities ORDER BY name',
      )) as Array<{ name: string }>;
      expect(cities.map((city) => city.name)).toEqual([
        'Bandung',
        'Jakarta',
        'Surabaya',
      ]);
      const [{ city }] = (await query(
        'SELECT city FROM portal_events WHERE id = $1',
        [event.id],
      )) as Array<{ city: string }>;
      expect(city).toBe('Surabaya');
    });
  });
});

describe('curated taxonomy rules', () => {
  it('renames coupon text with its category and refuses deleting a category in use', async () => {
    const service = new PortalCouponCategoryAdminService(
      db.getRepository(PortalCouponCategory),
    );
    const category = await service.create({
      name: `Musik ${randomUUID().slice(0, 6)}`,
    });
    const coupon = await makeCoupon({
      category: category.name,
      categoryId: category.id,
    });

    await expect(
      service.create({ name: category.name.toUpperCase() }),
    ).rejects.toBeInstanceOf(ConflictException);
    const renamed = await service.update(category.id, {
      name: `${category.name} live`,
    });
    const reloaded = await db
      .getRepository(PortalCoupon)
      .findOneByOrFail({ id: coupon.id });
    expect(reloaded.category).toBe(renamed.name);

    await expect(service.remove(category.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await db.getRepository(PortalCoupon).softDelete(coupon.id);
    await service.remove(category.id);
    expect(
      await db
        .getRepository(PortalCouponCategory)
        .findOneBy({ id: category.id }),
    ).toBeNull();
  });

  it('renames the city on coupons and events, including soft-deleted rows', async () => {
    const service = new PortalCityAdminService(db.getRepository(PortalCity));
    const name = `Kota ${randomUUID().slice(0, 6)}`;
    const city = await service.create({ name });
    const coupon = await makeCoupon({ city: name });
    const removed = await makeCoupon({ city: name });
    await db.getRepository(PortalCoupon).softDelete(removed.id);
    const event = await makeEvent(name);

    await service.update(city.id, { name: `${name} Baru` });

    expect(
      (await db.getRepository(PortalCoupon).findOneByOrFail({ id: coupon.id }))
        .city,
    ).toBe(`${name} Baru`);
    expect(
      (
        await db
          .getRepository(PortalCoupon)
          .findOneOrFail({ where: { id: removed.id }, withDeleted: true })
      ).city,
    ).toBe(`${name} Baru`);
    expect(
      (await db.getRepository(PortalEvent).findOneByOrFail({ id: event.id }))
        .city,
    ).toBe(`${name} Baru`);
  });
});

describe('wallet adjustments', () => {
  const service = () =>
    new PortalWalletAdminService(
      db.getRepository(PortalWallet),
      db.getRepository(User),
      db,
      events,
    );

  it('serializes concurrent first adjustments on a new wallet', async () => {
    const user = await makeUser();
    const results = await Promise.all(
      [500, 700, 300].map((amount) =>
        service().adjust(
          {
            userId: user.id,
            amount,
            reason: 'Goodwill credit',
            idempotencyKey: randomUUID(),
          },
          1,
        ),
      ),
    );
    expect(results.every((result) => result.applied)).toBe(true);
    const wallet = await db
      .getRepository(PortalWallet)
      .findOneByOrFail({ userId: user.id });
    expect(wallet.balance).toBe(1500);
    expect(
      await db
        .getRepository(PortalWalletTransaction)
        .countBy({ userId: user.id, type: 'adjustment' }),
    ).toBe(3);
  });

  it('applies a concurrently replayed key once and never goes negative', async () => {
    const user = await makeUser();
    const dto = {
      userId: user.id,
      amount: 1000,
      reason: 'Refund goodwill',
      idempotencyKey: randomUUID(),
    };
    const results = await Promise.all([
      service().adjust(dto, 1),
      service().adjust(dto, 1),
      service().adjust(dto, 1),
    ]);
    expect(results.filter((result) => result.applied)).toHaveLength(1);
    expect(
      (
        await db
          .getRepository(PortalWallet)
          .findOneByOrFail({ userId: user.id })
      ).balance,
    ).toBe(1000);

    const debits = await Promise.allSettled(
      [600, 600].map((amount) =>
        service().adjust(
          {
            userId: user.id,
            amount: -amount,
            reason: 'Fraud reversal',
            idempotencyKey: randomUUID(),
          },
          1,
        ),
      ),
    );
    expect(
      debits.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (
        await db
          .getRepository(PortalWallet)
          .findOneByOrFail({ userId: user.id })
      ).balance,
    ).toBe(400);
  });
});

describe('gift revocation', () => {
  it('returns reserved stock once even when revoked concurrently', async () => {
    const sender = await makeUser();
    const coupon = await makeCoupon();
    const selected = await db.getRepository(PortalCouponPackage).save({
      couponId: coupon.id,
      name: 'Gratis',
      benefits: 'Test',
      price: 0,
      oldPrice: null,
      stockTotal: 10,
      stockRemaining: 4,
      position: 0,
      active: true,
      isDefault: true,
    });
    const gift = await db.getRepository(PortalGift).save({
      senderUserId: sender.id,
      couponId: coupon.id,
      packageId: selected.id,
      code: `GFT-${randomUUID().slice(0, 8)}`,
      recipientName: 'Teman',
      recipientEmail: 'friend@example.test',
      status: 'Ready',
      expiresAt: new Date(Date.now() + 86400000),
      imageUrl: coupon.imageUrl,
    });
    const service = new PortalGiftAdminService(
      db.getRepository(PortalGift),
      db,
      events,
    );

    const outcomes = await Promise.allSettled([
      service.revoke(gift.id, 1, 'Wrong email'),
      service.revoke(gift.id, 1, 'Wrong email'),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (
        await db
          .getRepository(PortalCouponPackage)
          .findOneByOrFail({ id: selected.id })
      ).stockRemaining,
    ).toBe(5);
    expect(
      (await db.getRepository(PortalGift).findOneByOrFail({ id: gift.id }))
        .status,
    ).toBe('Revoked');
  });
});

describe('customer views and broadcasts', () => {
  it('lists only customers with their order and wallet totals', async () => {
    const tag = randomUUID().slice(0, 8);
    const customer = await makeUser({ fullname: `Pelanggan ${tag}` });
    await makeUser({ fullname: `Staf ${tag}` }, false);
    await db
      .getRepository(PortalWallet)
      .save({ userId: customer.id, balance: 2500, lifetimeEarned: 3000 });
    for (const paidAt of [new Date(), null])
      await db.getRepository(PortalOrder).save({
        userId: customer.id,
        orderNumber: `KM-${randomUUID().slice(0, 12)}`,
        idempotencyKey: randomUUID(),
        kind: 'coupon',
        title: 'Test',
        meta: 'Test',
        total: 1000,
        status: paidAt ? 'Paid' : 'Pending',
        paidAt,
      } as Partial<PortalOrder>);

    const service = new PortalCustomerAdminService(db);
    const list = await service.list(1, 10, tag);
    expect(list.meta.total).toBe(1);
    expect(list.data[0]).toMatchObject({
      id: customer.id,
      orderCount: 2,
      paidOrderCount: 1,
      walletBalance: 2500,
    });
    expect(await service.summary(customer.id)).toMatchObject({
      lifetimeEarned: 3000,
      voucherCount: 0,
      referralCode: null,
    });
  });

  it('queues one notification per opted-in customer and replays idempotently', async () => {
    const optedIn = await makeUser();
    const optedOut = await makeUser({ notificationsEnabled: false });
    const staff = await makeUser({}, false);
    const service = new PortalBroadcastAdminService(
      db.getRepository(PortalBroadcast),
      db,
      events,
    );
    const dto = {
      title: 'Promo malam',
      message: 'Diskon akhir pekan',
      audience: 'userIds' as const,
      userIds: [optedIn.id, optedOut.id, staff.id],
      idempotencyKey: randomUUID(),
    };

    const first = await service.send(dto, 1);
    const replay = await service.send(dto, 1);
    expect(replay.id).toBe(first.id);
    expect(first.recipientCount).toBe(1);
    const queued = await db
      .getRepository(PortalCommerceOutbox)
      .findBy({ eventName: 'user.notification' });
    expect(queued.map((row) => row.operationKey)).toEqual([
      `broadcast:${first.id}:${optedIn.id}`,
    ]);
    expect(
      await db
        .getRepository(PortalBroadcast)
        .countBy({ operationKey: `admin:${dto.idempotencyKey}` }),
    ).toBe(1);
  });
});

describe('public catalog taxonomy', () => {
  const portal = () =>
    Object.assign(Object.create(PortalCatalogService.prototype), {
      dataSource: db,
      couponRepository: db.getRepository(PortalCoupon),
      eventRepository: db.getRepository(PortalEvent),
      reviewRepository: db.getRepository(PortalReview),
      reviews: Object.assign(Object.create(PortalReviewsService.prototype), {
        reviewRepository: db.getRepository(PortalReview),
      }),
    }) as PortalCatalogService;

  it('returns curated category metadata, hides inactive ones and filters by slug or name', async () => {
    const city = `Kota ${randomUUID().slice(0, 6)}`;
    const categories = db.getRepository(PortalCouponCategory);
    const lane = await categories.save({
      name: `Lane ${randomUUID().slice(0, 6)}`,
      slug: `lane-${randomUUID().slice(0, 8)}`,
      label: 'Rileks',
      blurb: 'Pijat larut.',
      icon: 'moon',
      position: 1,
      featured: true,
    });
    const hidden = await categories.save({
      name: `Hidden ${randomUUID().slice(0, 6)}`,
      slug: `hidden-${randomUUID().slice(0, 8)}`,
      active: false,
    });
    const listed = await makeCoupon({
      city,
      category: lane.name,
      categoryId: lane.id,
    });
    await makeCoupon({ city, category: hidden.name, categoryId: hidden.id });
    await makeCoupon({ city, category: 'Belum dikurasi' });

    const result = await portal().listCouponCategories({ city });
    expect(result).toEqual([
      {
        name: lane.name,
        count: 1,
        slug: lane.slug,
        label: 'Rileks',
        blurb: 'Pijat larut.',
        icon: 'moon',
        position: 1,
        featured: true,
      },
      expect.objectContaining({
        name: 'Belum dikurasi',
        slug: null,
        featured: false,
      }),
    ]);

    for (const filter of [lane.slug, lane.name]) {
      const page = await portal().listCoupons({
        city,
        category: [filter],
        page: 1,
        limit: 10,
      });
      expect(page.data.map((coupon) => coupon.slug)).toEqual([listed.slug]);
    }
  });

  it('serves curated active cities, featured first', async () => {
    const cities = db.getRepository(PortalCity);
    await cities.save([
      { name: 'Zeta', slug: 'zeta', featured: true, position: 5 },
      { name: 'Alfa', slug: 'alfa', position: 1 },
      { name: 'Tutup', slug: 'tutup', active: false },
    ]);
    const names = (await portal().listLocations()).map(
      (location) => location.name,
    );
    expect(names.indexOf('Zeta')).toBe(0);
    expect(names).toContain('Alfa');
    expect(names).not.toContain('Tutup');
  });
});
