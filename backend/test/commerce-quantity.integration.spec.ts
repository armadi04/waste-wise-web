import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { randomUUID } from 'crypto';
import { DataSource, type EntityTarget, type ObjectLiteral } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppDataSource } from '@/database/data-source';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalBundleAdminService } from '@/portal/admin/portal-admin.service';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { User } from '@/users/entities/user.entity';
import { AuditLog } from '@/audit/entities/audit-log.entity';
import { AuditService } from '@/audit/audit.service';
import { CommerceLimitConsistency1791105000000 } from '@/database/migrations/1791105000000-CommerceLimitConsistency';
import { ReviewLegacyBundleComponents1791106000000 } from '@/database/migrations/1791106000000-ReviewLegacyBundleComponents';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { IndexPortalOrderHistory1791150000000 } from '@/database/migrations/1791150000000-IndexPortalOrderHistory';

// Explicitly requested DB integration, independent of browser/HTTP E2E suites.
// A randomly named schema is created and removed only inside kuponmalam_test.
if (process.env.DB_NAME !== 'kuponmalam_test')
  throw new Error('Commerce integration requires kuponmalam_test');
const schema = `commerce_test_${randomUUID().replaceAll('-', '')}`;
let source: DataSource;
let service: PortalCommerceService;
let campaign: PortalCampaignService;
let nextUser = 100000;
const oldEnvironment = process.env.NODE_ENV;
const oldMode = process.env.PORTAL_PAYMENT_MODE;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.PORTAL_PAYMENT_MODE = 'sandbox';
  await AppDataSource.initialize();
  await AppDataSource.query(`CREATE SCHEMA "${schema}"`);
  source = new DataSource({
    ...AppDataSource.options,
    schema,
    synchronize: true,
    migrations: [],
    logging: false,
  });
  await source.initialize();
  const events = new EventEmitter2();
  campaign = new PortalCampaignService(source, events);
  // Campaign award calculation has separate coverage; retain real commerce locks and pass verification.
  Object.assign(campaign, {
    paid: async () => {},
    refund: async () => {},
    award: async () => {},
  });
  service = Object.create(
    PortalCommerceService.prototype,
  ) as PortalCommerceService;
  Object.assign(service, {
    dataSource: source,
    campaigns: campaign,
    events,
    orderRepository: source.getRepository(PortalOrder),
  });
}, 30000);

afterAll(async () => {
  if (source?.isInitialized) await source.destroy();
  if (AppDataSource.isInitialized) {
    await AppDataSource.query(`DROP SCHEMA "${schema}" CASCADE`);
    await AppDataSource.destroy();
  }
  if (oldEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = oldEnvironment;
  if (oldMode === undefined) delete process.env.PORTAL_PAYMENT_MODE;
  else process.env.PORTAL_PAYMENT_MODE = oldMode;
}, 30000);

async function seed<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  overrides: Record<string, unknown>,
) {
  const values: Record<string, unknown> = {};
  for (const col of source.getMetadata(entity).columns) {
    if (
      col.isNullable ||
      col.isGenerated ||
      col.isCreateDate ||
      col.isUpdateDate ||
      col.isDeleteDate ||
      col.default !== undefined
    )
      continue;
    values[col.propertyName] = ['int', 'integer', Number].includes(
      col.type as any,
    )
      ? 0
      : ['timestamptz', Date].includes(col.type as any)
        ? new Date('2099-01-01')
        : col.type === 'boolean'
          ? true
          : col.type === 'jsonb'
            ? {}
            : `test-${col.propertyName}`;
  }
  return source
    .getRepository(entity)
    .save(
      source.getRepository(entity).create({ ...values, ...overrides } as any),
    ) as unknown as Promise<T>;
}

async function fixture(stock = 10, balance = 1_000_000) {
  const user = await seed(User, {
    email: `commerce-${nextUser++}@example.test`,
    password: 'test-only',
  });
  const userId = user.id;
  const slug = `product-${userId}`;
  const coupon = await seed(PortalCoupon, {
    slug,
    title: slug,
    active: true,
    stockTotal: stock,
    stockRemaining: stock,
    price: 100000,
  });
  const pack = await seed(PortalCouponPackage, {
    couponId: coupon.id,
    name: 'Meals',
    price: 100000,
    stockTotal: stock,
    stockRemaining: stock,
    isDefault: true,
    active: true,
  });
  const event = await seed(PortalEvent, {
    slug,
    title: slug,
    startsAt: new Date('2099-01-01'),
    active: true,
  });
  const ticket = await seed(PortalEventTicket, {
    eventId: event.id,
    name: 'Regular',
    price: 50000,
    stockTotal: stock,
    stockRemaining: stock,
  });
  const bundle = await seed(PortalBundle, {
    slug,
    title: 'Bundle',
    couponSlug: slug,
    eventSlug: slug,
    packageId: pack.id,
    ticketTypeId: ticket.id,
    price: 120000,
    active: true,
  });
  await seed(PortalWallet, { userId, balance, lifetimeEarned: 0 });
  const dto = {
    kind: 'coupon',
    slug,
    packagePublicId: pack.publicId,
    attendee: 'Nadia',
    email: 'nadia@example.test',
    phone: '0812',
    quantity: 2,
  };
  const create = (key = randomUUID()) => service.createOrder(userId, dto, key);
  const row = (id: string) =>
    source.getRepository(PortalOrder).findOneByOrFail({ orderNumber: id });
  const passes = async (id: string) => {
    const order = await row(id);
    const items = await source
      .getRepository(PortalOrderItem)
      .find({ where: { orderId: order.id } });
    const vouchers: PortalVoucher[] = [],
      tickets: PortalTicket[] = [];
    for (const item of items) {
      vouchers.push(
        ...(await source
          .getRepository(PortalVoucher)
          .find({ where: { orderItemId: item.id } })),
      );
      tickets.push(
        ...(await source
          .getRepository(PortalTicket)
          .find({ where: { orderItemId: item.id } })),
      );
    }
    return { vouchers, tickets, items, order };
  };
  return {
    userId,
    coupon,
    pack,
    event,
    ticket,
    bundle,
    dto,
    create,
    row,
    passes,
  };
}

describe('commerce quantity: real PostgreSQL transactions', () => {
  it('rejects the same key with a different payload and reserves only once', async () => {
    const f = await fixture();
    const key = randomUUID();
    const order = await f.create(key);
    expect((await f.create(key)).id).toBe(order.id);
    await expect(
      service.createOrder(f.userId, { ...f.dto, quantity: 3 }, key),
    ).rejects.toThrow('Idempotency');
    expect(
      (
        await source
          .getRepository(PortalCouponPackage)
          .findOneByOrFail({ id: f.pack.id })
      ).stockRemaining,
    ).toBe(8);
  });

  it('serializes two orders spending the same wallet balance', async () => {
    const f = await fixture(10, 200000);
    const one = await f.create();
    const two = await f.create();
    const result = await Promise.allSettled([
      service.payOrder(f.userId, one.id, { paymentMethod: 'coins' }),
      service.payOrder(f.userId, two.id, { paymentMethod: 'coins' }),
    ]);
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(
      1,
    );
    const transactions = await source
      .getRepository(PortalWalletTransaction)
      .find({ where: { userId: f.userId, type: 'purchase' } });
    expect(transactions).toHaveLength(1);
    expect(
      (
        await source
          .getRepository(PortalWallet)
          .findOneByOrFail({ userId: f.userId })
      ).balance,
    ).toBe(10000);
  });

  it('races successful VA confirmation against expiry without issuing late benefits', async () => {
    const f = await fixture();
    const order = await f.create();
    await service.payOrder(f.userId, order.id, { paymentMethod: 'va' });
    const original = await f.row(order.id);
    await source
      .getRepository(PortalOrder)
      .update(original.id, { paymentExpiresAt: new Date(Date.now() - 1) });
    await Promise.all([
      service.simulatePayment(f.userId, order.id),
      service.expirePendingOrders(),
    ]);
    const expired = await f.row(order.id);
    expect(expired.status).toBe('Expired');
    expect(expired.paymentState).toBe('LateSettled');
    expect(expired.refundStatus).toBe('Processing');
    expect((await f.passes(order.id)).vouchers).toHaveLength(0);
    expect(
      (
        await source
          .getRepository(PortalCouponPackage)
          .findOneByOrFail({ id: f.pack.id })
      ).stockRemaining,
    ).toBe(10);
    await service.simulatePayment(f.userId, order.id);
    await service.approveRefund(expired.id, 9);
    await service.approveRefund(expired.id, 9);
    expect((await f.row(order.id)).refundStatus).toBe('Refunded');
  });

  it.each(['voucher', 'ticket'] as const)(
    'locks refund requests against %s usage',
    async (kind) => {
      const f = await fixture();
      const dto =
        kind === 'voucher'
          ? f.dto
          : {
              ...f.dto,
              kind: 'ticket',
              ticketType: 'Regular',
              attendees: ['Nadia', 'Nadia'],
            };
      const order = await service.createOrder(f.userId, dto, randomUUID());
      await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
      const passes = await f.passes(order.id);
      const pass = kind === 'voucher' ? passes.vouchers[0] : passes.tickets[0];
      const result = await Promise.allSettled([
        service.requestRefund(f.userId, order.id, 'changed'),
        campaign.verifyUsage(kind, pass.id, 9),
      ]);
      expect(
        result.filter((entry) => entry.status === 'fulfilled'),
      ).toHaveLength(1);
      const current = await f.passes(order.id);
      if (current.order.refundStatus === 'Requested') {
        expect(
          [...current.vouchers, ...current.tickets].every(
            (entry) => entry.status === 'RefundPending',
          ),
        ).toBe(true);
        await expect(campaign.verifyUsage(kind, pass.id, 9)).rejects.toThrow();
        await service.approveRefund(current.order.id, 9);
        expect(
          (
            await source
              .getRepository(PortalCouponPackage)
              .findOneByOrFail({ id: f.pack.id })
          ).stockRemaining,
        ).toBe(10);
      } else
        await expect(
          service.requestRefund(f.userId, order.id, 'retry'),
        ).rejects.toThrow('Used passes');
    },
  );

  it('rolls back partial issuance and safely retries the same settlement', async () => {
    const f = await fixture();
    const order = await f.create();
    let issued = 0;
    const subscriber = {
      beforeInsert(event: any) {
        if (event.metadata.target === PortalVoucher && ++issued === 2)
          throw new Error('Injected issuance failure');
      },
    };
    source.subscribers.push(subscriber);
    try {
      await expect(
        service.payOrder(f.userId, order.id, { paymentMethod: 'coins' }),
      ).rejects.toThrow('Injected issuance failure');
    } finally {
      source.subscribers.splice(source.subscribers.indexOf(subscriber), 1);
    }
    expect((await f.row(order.id)).status).toBe('Pending');
    expect((await f.passes(order.id)).vouchers).toHaveLength(0);
    expect(
      (
        await source
          .getRepository(PortalWallet)
          .findOneByOrFail({ userId: f.userId })
      ).balance,
    ).toBe(1000000);
    await Promise.all([
      service.payOrder(f.userId, order.id, { paymentMethod: 'coins' }),
      service.payOrder(f.userId, order.id, { paymentMethod: 'coins' }),
    ]);
    const vouchers = (await f.passes(order.id)).vouchers;
    expect(vouchers).toHaveLength(2);
    expect(new Set(vouchers.map((voucher) => voucher.code)).size).toBe(2);
    expect(
      await source
        .getRepository(PortalWalletTransaction)
        .count({ where: { userId: f.userId, type: 'purchase' } }),
    ).toBe(1);
  });

  it('settles bundle units from their original configuration and allocation snapshot', async () => {
    const f = await fixture();
    const order = await service.createOrder(
      f.userId,
      { ...f.dto, kind: 'bundle', attendees: ['Nadia', 'Nadia'] },
      randomUUID(),
    );
    await source
      .getRepository(PortalBundle)
      .update(f.bundle.id, { packageId: null, ticketTypeId: null, price: 1 });
    await source
      .getRepository(PortalCoupon)
      .update(f.coupon.id, { expiresAt: new Date(0) });
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    const result = await f.passes(order.id);
    expect(result.vouchers).toHaveLength(2);
    expect(result.tickets).toHaveLength(2);
    expect(result.order.total).toBe(240000);
    expect(
      result.items.filter((item) => item.productType === 'bundle'),
    ).toHaveLength(1);
    for (const unit of [0, 1]) {
      const components = result.items.filter((item) => item.unitIndex === unit);
      expect(components).toHaveLength(2);
      expect(components.every((item) => item.unitPrice === 0)).toBe(true);
      expect(
        components.reduce(
          (total, item) => total + item.benefitSnapshot!.allocation.total,
          0,
        ),
      ).toBe(120000);
      expect(
        result.vouchers
          .find(
            (pass) =>
              pass.orderItemId ===
              components.find((item) => item.productType === 'coupon')!.id,
          )
          ?.expiresAt.getFullYear(),
      ).toBe(2099);
    }
  });

  it('enforces cumulative user limits under concurrent orders and releases cancelled reservations', async () => {
    const f = await fixture();
    await source
      .getRepository(PortalCoupon)
      .update(f.coupon.id, { maxPerUser: 3 });
    const result = await Promise.allSettled([f.create(), f.create()]);
    expect(result.filter((entry) => entry.status === 'fulfilled')).toHaveLength(
      1,
    );
    const order = (
      result.find(
        (entry) => entry.status === 'fulfilled',
      ) as PromiseFulfilledResult<any>
    ).value;
    await service.cancelOrder(f.userId, order.id);
    expect((await f.create()).quantity).toBe(2);
  });

  it('calculates percentage and fixed promos across quantity with one redemption', async () => {
    const f = await fixture();
    const promo = await seed(PortalPromoCode, {
      code: `PROMO-${f.userId}`,
      kind: 'percentage',
      value: 10,
      usageCount: 0,
      usageLimit: 2,
      minimumOrder: 0,
      maximumDiscount: 30000,
      active: true,
    });
    const order = await service.createOrder(
      f.userId,
      { ...f.dto, promoCode: promo.code },
      randomUUID(),
    );
    expect(order.discount).toBe(20000);
    expect(order.total).toBe(180000);
    expect(
      (
        await source
          .getRepository(PortalPromoCode)
          .findOneByOrFail({ id: promo.id })
      ).usageCount,
    ).toBe(0);
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    expect(
      (
        await source
          .getRepository(PortalPromoCode)
          .findOneByOrFail({ id: promo.id })
      ).usageCount,
    ).toBe(1);
    await source
      .getRepository(PortalPromoCode)
      .update(promo.id, { kind: 'fixed', value: 20000 });
    const second = await service.createOrder(
      f.userId,
      { ...f.dto, quantity: 3, promoCode: promo.code },
      randomUUID(),
    );
    expect(second.total).toBe(280000);
  });

  it('does not restore refunded stock after the sale has ended', async () => {
    const f = await fixture();
    const order = await f.create();
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    await source
      .getRepository(PortalCoupon)
      .update(f.coupon.id, { salesEndsAt: new Date(0) });
    await service.requestRefund(f.userId, order.id, 'changed');
    await service.approveRefund((await f.row(order.id)).id, 9);
    await service.approveRefund((await f.row(order.id)).id, 9);
    expect(
      (
        await source
          .getRepository(PortalCouponPackage)
          .findOneByOrFail({ id: f.pack.id })
      ).stockRemaining,
    ).toBe(8);
  });

  it('retries failed outbox delivery without duplicating audit receipts or payment effects', async () => {
    const f = await fixture();
    const order = await f.create();
    const originalEvents = (service as any).events;
    const events = new EventEmitter2();
    const audit = new AuditService(source.getRepository(AuditLog));
    events.on('audit.record', ((payload: any) => audit.record(payload)) as (
      ...args: any[]
    ) => void);
    let fail = true;
    events.on('audit.record', () => {
      if (fail) throw new Error('Injected listener failure');
    });
    (service as any).events = events;
    try {
      await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
      const key = `payment:${(await f.row(order.id)).id}`;
      const event = await source
        .getRepository(PortalCommerceOutbox)
        .findOneByOrFail({ operationKey: key });
      expect(event.deliveredAt).toBeNull();
      fail = false;
      await service.deliverCommerceEvents();
      await service.deliverCommerceEvents();
      expect(
        (
          await source
            .getRepository(PortalCommerceOutbox)
            .findOneByOrFail({ id: event.id })
        ).deliveredAt,
      ).not.toBeNull();
      expect(
        await source.getRepository(AuditLog).count({ where: { eventId: key } }),
      ).toBe(1);
      expect(
        await source
          .getRepository(PortalWalletTransaction)
          .count({ where: { userId: f.userId, type: 'purchase' } }),
      ).toBe(1);
    } finally {
      (service as any).events = originalEvents;
    }
  });

  it('reports fresh per-user limits for pending orders, bundles, and component caps', async () => {
    const f = await fixture();
    await source
      .getRepository(PortalCoupon)
      .update(f.coupon.id, { maxPerUser: 3 });
    expect(
      await service.getPurchaseLimit(f.userId, 'coupon', f.coupon.slug),
    ).toEqual({ remaining: 3 });
    const order = await f.create();
    expect(
      await service.getPurchaseLimit(f.userId, 'coupon', f.coupon.slug),
    ).toEqual({ remaining: 1 });
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    await source
      .getRepository(PortalOrder)
      .update((await f.row(order.id)).id, { purchaseSnapshot: null });
    expect(
      await service.getPurchaseLimit(f.userId, 'coupon', f.coupon.slug),
    ).toEqual({ remaining: 1 });
    await source
      .getRepository(PortalEvent)
      .update(f.event.id, { maxPerUser: 1 });
    await source
      .getRepository(PortalBundle)
      .update(f.bundle.id, { maxPerUser: 8 });
    await service.createOrder(
      f.userId,
      {
        ...f.dto,
        kind: 'ticket',
        ticketType: 'Regular',
        quantity: 1,
        attendees: ['Nadia'],
      },
      randomUUID(),
    );
    expect(
      await service.getPurchaseLimit(f.userId, 'bundle', f.bundle.slug),
    ).toEqual({ remaining: 0 });
    await service.requestRefund(f.userId, order.id, 'changed');
    await service.approveRefund((await f.row(order.id)).id, 9);
    await service.approveRefund((await f.row(order.id)).id, 9);
    expect(
      await service.getPurchaseLimit(f.userId, 'coupon', f.coupon.slug),
    ).toEqual({ remaining: 3 });
  });

  it('backfills legacy deadlines and only infers unambiguous bundle components', async () => {
    const clear = await fixture();
    const pending = await clear.create();
    const pendingRow = await clear.row(pending.id);
    await source
      .getRepository(PortalOrder)
      .update(pendingRow.id, { paymentExpiresAt: null });
    const earlyBird = await seed(PortalEventTicket, {
      eventId: clear.event.id,
      name: 'Early Bird',
      price: 40000,
      stockTotal: 10,
      stockRemaining: 10,
    });
    await source
      .getRepository(PortalBundle)
      .update(clear.bundle.id, { packageId: null, ticketTypeId: null });

    const ambiguous = await fixture();
    await source
      .getRepository(PortalCouponPackage)
      .update(ambiguous.pack.id, { isDefault: false });
    await seed(PortalCouponPackage, {
      couponId: ambiguous.coupon.id,
      name: 'Alternative',
      benefits: 'Test',
      price: 100000,
      stockTotal: 5,
      stockRemaining: 5,
      isDefault: false,
      active: true,
    });
    await seed(PortalEventTicket, {
      eventId: ambiguous.event.id,
      name: 'VIP',
      price: 80000,
      stockTotal: 10,
      stockRemaining: 10,
    });
    const guessedTicket = await source
      .getRepository(PortalEventTicket)
      .findOneByOrFail({
        eventId: ambiguous.event.id,
        name: 'Regular',
      });
    // Simulate the previous migration's cheapest-item guess: populated fields do
    // not prove these were the intended bundle benefits.
    await source.getRepository(PortalBundle).update(ambiguous.bundle.id, {
      packageId: ambiguous.pack.id,
      ticketTypeId: guessedTicket.id,
    });

    const runner = source.createQueryRunner();
    try {
      await new CommerceLimitConsistency1791105000000().up(runner);
      await new ReviewLegacyBundleComponents1791106000000().up(runner);
    } finally {
      await runner.release();
    }

    const configured = await source
      .getRepository(PortalBundle)
      .findOneByOrFail({ id: clear.bundle.id });
    expect(configured.packageId).toBe(clear.pack.id);
    expect(configured.ticketTypeId).toBe(earlyBird.id);
    const needsAdmin = await source
      .getRepository(PortalBundle)
      .findOneByOrFail({ id: ambiguous.bundle.id });
    expect(needsAdmin.packageId).toBe(ambiguous.pack.id);
    expect(needsAdmin.ticketTypeId).toBe(guessedTicket.id);
    expect(needsAdmin.componentsNeedReview).toBe(true);
    await expect(
      service.getPurchaseLimit(
        ambiguous.userId,
        'bundle',
        ambiguous.bundle.slug,
      ),
    ).rejects.toThrow('Bundle components are not configured');
    const bundleAdmin = new PortalBundleAdminService(
      source.getRepository(PortalBundle),
    );
    await bundleAdmin.update(ambiguous.bundle.id, {
      packageId: ambiguous.pack.id,
      ticketTypeId: guessedTicket.id,
    });
    expect(
      await source.getRepository(PortalBundle).findOneByOrFail({
        id: ambiguous.bundle.id,
      }),
    ).toMatchObject({ componentsNeedReview: false });
    expect(
      await service.getPurchaseLimit(
        ambiguous.userId,
        'bundle',
        ambiguous.bundle.slug,
      ),
    ).toEqual({ remaining: null });
    const backfilledOrder = await clear.row(pending.id);
    expect(backfilledOrder.paymentExpiresAt?.getTime()).toBe(
      pendingRow.createdAt.getTime() + 24 * 60 * 60 * 1000,
    );
  });

  it('starts duration voucher validity at issuance, independently of its old fixed date', async () => {
    const f = await fixture();
    await source.getRepository(PortalCoupon).update(f.coupon.id, {
      expiresAt: new Date(0),
      validityDays: 30,
      salesEndsAt: new Date(Date.now() + 3600000),
    });
    const order = await f.create();
    const before = Date.now();
    await service.payOrder(f.userId, order.id, { paymentMethod: 'coins' });
    const expiry = (await f.passes(order.id)).vouchers[0].expiresAt.getTime();
    expect(expiry).toBeGreaterThanOrEqual(before + 30 * 86400000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 30 * 86400000);
  });
});

describe('order history and refund response with PostgreSQL', () => {
  it('applies and reverses the history index migration in the isolated schema', async () => {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}"`);
      const migration = new IndexPortalOrderHistory1791150000000();
      await migration.down(runner);
      await migration.up(runner);
      const indexes = await runner.query(
        'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
        [schema, 'IDX_portal_orders_user_history'],
      );
      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexdef).toContain('("userId", "createdAt", id)');
      expect(indexes[0].indexdef).toContain('"deletedAt" IS NULL');
      await runner.commitTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it.each(['voucher', 'ticket'] as const)(
    'refreshes eligibility after %s usage, even when the snapshot omits it',
    async (kind) => {
      const f = await fixture();
      const dto =
        kind === 'voucher'
          ? f.dto
          : {
              ...f.dto,
              kind: 'ticket',
              ticketType: 'Regular',
              attendees: ['Nadia', 'Nadia'],
            };
      const created = await service.createOrder(f.userId, dto, randomUUID());
      const paid = await service.payOrder(f.userId, created.id, {
        paymentMethod: 'coins',
      });
      expect(paid.canRequestRefund).toBe(true);
      expect(
        (await service.listOrders(f.userId)).data[0].canRequestRefund,
      ).toBe(true);
      const owned = await f.passes(created.id);
      const pass = kind === 'voucher' ? owned.vouchers[0] : owned.tickets[0];
      await campaign.verifyUsage(kind, pass.id, 9);
      const snapshot = structuredClone(owned.order.purchaseSnapshot!);
      snapshot.items = snapshot.items.filter(
        (item) => item.id !== pass.orderItemId,
      );
      await source
        .getRepository(PortalOrder)
        .update(owned.order.id, { purchaseSnapshot: snapshot });
      expect(
        (await service.getOrder(f.userId, created.id)).canRequestRefund,
      ).toBe(false);
      expect(
        (await service.listOrders(f.userId)).data[0].canRequestRefund,
      ).toBe(false);
      await expect(
        service.requestRefund(f.userId, created.id, 'changed'),
      ).rejects.toThrow('Used passes');
    },
  );

  it('preserves snapshot prices and reads legacy stored items with null indices', async () => {
    const f = await fixture();
    const created = await f.create();
    await service.payOrder(f.userId, created.id, { paymentMethod: 'coins' });
    const owned = await f.passes(created.id);
    const item = owned.items[0];
    await source.getRepository(PortalOrderItem).update(item.id, {
      title: 'Historical fallback',
      unitPrice: 12345,
      unitIndex: null,
    });
    const unchanged = await service.getOrder(f.userId, created.id);
    expect(unchanged.items[0].unitPrice).toBe(100000);
    expect(unchanged.items[0].title).not.toBe('Historical fallback');
    await source
      .getRepository(PortalOrder)
      .update(owned.order.id, { purchaseSnapshot: null });
    const legacy = await service.getOrder(f.userId, created.id);
    expect(legacy.items[0]).toMatchObject({
      title: 'Historical fallback',
      unitPrice: 12345,
      unitIndex: null,
    });
    expect(legacy.canRequestRefund).toBe(true);
    expect((await service.listOrders(f.userId)).data[0].items).toEqual(
      legacy.items,
    );
    const requested = await service.requestRefund(
      f.userId,
      created.id,
      'changed',
    );
    expect(requested.canRequestRefund).toBe(false);
    expect((await service.listOrders(f.userId)).data[0].canRequestRefund).toBe(
      false,
    );
    await service.rejectRefund(owned.order.id, 9, 'declined');
    expect(
      (await service.getOrder(f.userId, created.id)).canRequestRefund,
    ).toBe(true);
  });

  it('bounds history reads and applies ownership, refund filters and stable ordering before pagination', async () => {
    const f = await fixture();
    const date = new Date('2026-01-01');
    const rows: PortalOrder[] = [];
    for (let index = 0; index < 23; index++) {
      rows.push(
        await seed(PortalOrder, {
          userId: f.userId,
          orderNumber: `history-${f.userId}-${index}`,
          idempotencyKey: randomUUID(),
          kind: 'coupon',
          title: `Item ${index}`,
          status:
            index === 19 || index === 20
              ? 'Paid'
              : index === 21
                ? 'Refunded'
                : index === 22
                  ? 'Cancelled'
                  : 'Pending',
          refundStatus: index === 20 ? 'Refunded' : null,
          createdAt: date,
          purchaseSnapshot: null,
        }),
      );
    }
    const hidden = await seed(PortalOrder, {
      userId: f.userId,
      orderNumber: `hidden-${f.userId}`,
      idempotencyKey: randomUUID(),
      kind: 'coupon',
      status: 'Paid',
    });
    await source.getRepository(PortalOrder).softDelete(hidden.id);
    const stranger = await fixture();
    await stranger.create();
    const first = await service.listOrders(f.userId, {
      page: 1,
      limit: 5,
      filter: 'all',
    });
    const second = await service.listOrders(f.userId, {
      page: 2,
      limit: 5,
      filter: 'all',
    });
    expect(first.meta).toEqual({ total: 23, page: 1, lastPage: 5 });
    expect(first.data.map((order) => order.id)).toEqual(
      rows
        .slice(18)
        .reverse()
        .map((order) => order.orderNumber),
    );
    expect(
      new Set([...first.data, ...second.data].map((order) => order.id)).size,
    ).toBe(10);
    expect(
      (
        await service.listOrders(f.userId, {
          page: 1,
          limit: 5,
          filter: 'Paid',
        })
      ).data.map((order) => order.id),
    ).toEqual([rows[19].orderNumber]);
    expect(
      (
        await service.listOrders(f.userId, {
          page: 1,
          limit: 1,
          filter: 'Refunded',
        })
      ).meta,
    ).toEqual({ total: 2, page: 1, lastPage: 2 });
    expect(
      (
        await service.listOrders(f.userId, {
          page: 1,
          limit: 5,
          filter: 'Cancelled',
        })
      ).meta.total,
    ).toBe(1);
    expect(
      (await service.listOrders(f.userId, { page: 6, limit: 5, filter: 'all' }))
        .data,
    ).toEqual([]);
  });
});
