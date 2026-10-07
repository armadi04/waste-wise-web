import { PortalPassesService } from '@/portal/passes/portal-passes.service';
import { afterEach, describe, expect, it } from 'bun:test';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import {
  paymentExpired,
  paymentSandboxEnabled,
} from '@/portal/commerce/payment-sandbox';

type Row = Record<string, any>;
const PACKAGE = 'a5e4ab27-75cd-43c3-9abc-d61a52d326b6';
const originalMode = process.env.PORTAL_PAYMENT_MODE;
const originalEnvironment = process.env.NODE_ENV;
const originalWebhookSecret = process.env.PORTAL_PAYMENT_WEBHOOK_SECRET;
afterEach(() => {
  if (originalMode === undefined) delete process.env.PORTAL_PAYMENT_MODE;
  else process.env.PORTAL_PAYMENT_MODE = originalMode;
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
  if (originalWebhookSecret === undefined)
    delete process.env.PORTAL_PAYMENT_WEBHOOK_SECRET;
  else process.env.PORTAL_PAYMENT_WEBHOOK_SECRET = originalWebhookSecret;
});

// Disposable transaction fake: commit/rollback and exclusive transaction ownership,
// plus row-lock assertions. No connection to development or production databases.
function fixture(price = 100_000, stock = 1) {
  process.env.PORTAL_PAYMENT_MODE = 'sandbox';
  process.env.NODE_ENV = 'test';
  let tables = new Map<unknown, Row[]>([
    [
      PortalCoupon,
      [
        {
          id: 1,
          slug: 'dinner',
          active: true,
          expiresAt: new Date('2099-01-01'),
          timeZone: 'Asia/Jakarta',
          title: 'Dinner',
          imageUrl: '',
          price: 1,
          stockTotal: stock,
          stockRemaining: stock,
        },
      ],
    ],
    [
      PortalCouponPackage,
      [
        {
          id: 2,
          couponId: 1,
          publicId: PACKAGE,
          name: 'Dinner for two',
          benefits: 'Two meals',
          price,
          stockTotal: stock,
          stockRemaining: stock,
          active: true,
          isDefault: true,
        },
      ],
    ],
    [PortalWallet, [{ id: 1, userId: 1, balance: 500_000, lifetimeEarned: 0 }]],
    [PortalTicket, []],
  ]);
  const events: Row[] = [];
  const locks: unknown[] = [];
  const readQueries: unknown[] = [];
  const counts = { paid: 0, usage: 0, refund: 0 };
  let queue = Promise.resolve();
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === 'object' && value._type === 'isNull'
        ? row[key] == null
        : value &&
            typeof value === 'object' &&
            value._type === 'lessThanOrEqual'
          ? row[key] != null && row[key] <= value._value
          : value && typeof value === 'object' && value._type === 'in'
            ? value._value.includes(row[key])
            : row[key] === value,
    );
  const repository = (store: Map<unknown, Row[]>, entity: unknown) => {
    const rows = () => {
      if (!store.has(entity)) store.set(entity, []);
      return store.get(entity)!;
    };
    const select = (where: Row) => rows().find((row) => matches(row, where));
    return {
      create: (row: Row) => row,
      findOneBy: async (where: Row) => structuredClone(select(where) ?? null),
      findOne: async (options: Row) => {
        if (options.lock) {
          expect(options.lock.mode).toBe('pessimistic_write');
          locks.push(entity);
        }
        return structuredClone(select(options.where) ?? null);
      },
      findOneOrFail: async (options: Row) => {
        expect(options.lock.mode).toBe('pessimistic_write');
        locks.push(entity);
        const row = select(options.where);
        if (!row) throw new Error('Missing row');
        return structuredClone(row);
      },
      findAndCount: async (options: Row) => {
        const found = rows().filter((row) => matches(row, options.where));
        return [
          structuredClone(
            found.slice(options.skip ?? 0, (options.skip ?? 0) + options.take),
          ),
          found.length,
        ];
      },
      find: async (options: Row) => {
        readQueries.push(entity);
        return structuredClone(
          rows()
            .filter((row) => matches(row, options.where))
            .slice(0, options.take ?? Infinity),
        );
      },
      save: async (data: Row) => {
        const row = {
          id: data.id ?? rows().length + 1,
          publicId: 'public',
          ...data,
        };
        const index = rows().findIndex((existing) => existing.id === row.id);
        if (index < 0) rows().push(row);
        else rows()[index] = row;
        return structuredClone(row);
      },
      update: async (idOrWhere: number | Row, data: Row) => {
        for (const row of rows())
          if (
            matches(
              row,
              typeof idOrWhere === 'number' ? { id: idOrWhere } : idOrWhere,
            )
          )
            Object.assign(row, data);
      },
      createQueryBuilder: () => {
        let parameters: Row = {};
        let isDefault = false;
        let insertValues: Row = {};
        const builder: Row = {
          insert: () => builder,
          into: () => builder,
          values: (data: Row) => {
            insertValues = data;
            return builder;
          },
          orIgnore: () => builder,
          execute: async () => {
            if (!select({ userId: insertValues.userId }))
              rows().push({ id: rows().length + 1, ...insertValues });
            return { affected: 1 };
          },
          setLock: (mode: string) => {
            expect(mode).toBe('pessimistic_write');
            locks.push(entity);
            return builder;
          },
          where: (sql: string, params: Row) => {
            parameters = { ...parameters, ...params };
            if (sql.includes('active = true')) parameters.active = true;
            return builder;
          },
          andWhere: (sql: string, params: Row) => {
            parameters = { ...parameters, ...params };
            if (sql.includes('isDefault = true')) isDefault = true;
            return builder;
          },
          getOne: async () => {
            const filter = { ...parameters };
            if (entity === PortalOrder && filter.orderNumber) delete filter.id;
            if (isDefault) filter.isDefault = true;
            return structuredClone(select(filter) ?? null);
          },
        };
        return builder;
      },
    };
  };
  const dataSource = {
    manager: { getRepository: (entity: unknown) => repository(tables, entity) },
    transaction: async (run: (manager: Row) => Promise<any>) => {
      const before = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await before;
      const working = new Map(
        [...tables].map(([entity, rows]) => [entity, structuredClone(rows)]),
      );
      try {
        const result = await run({
          getRepository: (entity: unknown) => repository(working, entity),
          query: async () => [],
        });
        tables = working;
        return result;
      } finally {
        release();
      }
    },
  };
  const emitter = new EventEmitter2();
  emitter.on('audit.record', (event) => events.push(event));
  emitter.on('user.notification', (event) =>
    events.push({ notification: event }),
  );
  const campaign = new PortalCampaignService(dataSource as any, emitter);
  Object.assign(campaign, {
    lockCommerce: async () => {},
    award: async () => {
      counts.usage++;
    },
  });
  const service = Object.create(
    PortalCommerceService.prototype,
  ) as PortalCommerceService;
  Object.assign(service, {
    dataSource,
    events: emitter,
    campaigns: {
      lockCommerce: async () => {},
      assertPromoOwner: () => {},
      paid: async () => {
        counts.paid++;
      },
      refund: async () => {
        counts.refund++;
      },
    },
    orderRepository: {
      findOneBy: (where: Row) =>
        repository(tables, PortalOrder).findOneBy(where),
      findOne: (options: Row) =>
        repository(tables, PortalOrder).findOne(options),
      find: (options: Row) => repository(tables, PortalOrder).find(options),
      findAndCount: (options: Row) =>
        repository(tables, PortalOrder).findAndCount(options),
    },
  });
  const rows = (entity: unknown) => tables.get(entity) ?? [];
  const dto = {
    kind: 'coupon',
    slug: 'dinner',
    packagePublicId: PACKAGE,
    attendee: 'Nadia',
    email: 'nadia@example.test',
    phone: '0812',
  };
  const create = () => service.createOrder(1, dto, 'purchase');
  const paid = async () => {
    const order = await create();
    return service.payOrder(1, order.id, { paymentMethod: 'coins' });
  };
  return {
    service,
    passes: Object.assign(Object.create(PortalPassesService.prototype), {
      dataSource,
    }) as PortalPassesService,
    campaign,
    rows,
    events,
    counts,
    locks,
    dto,
    create,
    paid,
    readQueries,
  };
}

describe('order response refund eligibility and item history', () => {
  it('reports eligibility in mutations, detail and list, then hides it after voucher usage', async () => {
    const f = fixture();
    expect((await f.create()).canRequestRefund).toBe(false);
    const order = await f.service.payOrder(
      1,
      f.rows(PortalOrder)[0].orderNumber,
      { paymentMethod: 'coins' },
    );
    expect(order.canRequestRefund).toBe(true);
    expect((await f.service.getOrder(1, order.id)).canRequestRefund).toBe(true);
    f.rows(PortalVoucher)[0].status = 'Redeemed';
    expect((await f.service.getOrder(1, order.id)).canRequestRefund).toBe(
      false,
    );
    expect((await f.service.listOrders(1)).data[0].canRequestRefund).toBe(
      false,
    );
    await expect(
      f.service.requestRefund(1, order.id, 'Changed'),
    ).rejects.toThrow('Used passes');
  });

  it('uses all persisted benefits when checking eligibility, even if a snapshot omits a used ticket', async () => {
    const f = fixture();
    const order = await f.paid();
    f.rows(PortalTicket).push({ id: 1, orderItemId: 1, status: 'CheckedIn' });
    expect((await f.service.getOrder(1, order.id)).canRequestRefund).toBe(
      false,
    );
  });

  it.each(['Requested', 'Processing', 'Failed', 'Refunded'])(
    'does not offer another request during refund status %s',
    async (refundStatus) => {
      const f = fixture();
      const order = await f.paid();
      f.rows(PortalOrder)[0].refundStatus = refundStatus;
      expect((await f.service.getOrder(1, order.id)).canRequestRefund).toBe(
        false,
      );
    },
  );

  it('reads stored legacy items with nullable unit indices and preserves snapshot prices', async () => {
    const f = fixture();
    const order = await f.paid();
    f.rows(PortalOrderItem)[0].title = 'Stored title';
    expect((await f.service.getOrder(1, order.id)).items[0].title).toBe(
      'Dinner',
    );
    f.rows(PortalOrder)[0].purchaseSnapshot = null;
    f.rows(PortalOrderItem)[0].unitIndex = null;
    const legacy = await f.service.getOrder(1, order.id);
    expect(legacy.items[0]).toMatchObject({
      title: 'Stored title',
      quantity: 1,
      unitPrice: 100_000,
      unitIndex: null,
    });
    expect(legacy.canRequestRefund).toBe(true);
  });

  it('batches usage reads across multiple orders', async () => {
    const f = fixture(100_000, 3);
    await f.paid();
    const second = await f.service.createOrder(1, f.dto, 'second');
    await f.service.payOrder(1, second.id, { paymentMethod: 'coins' });
    f.readQueries.length = 0;
    const { data: orders } = await f.service.listOrders(1);
    expect(orders).toHaveLength(2);
    expect(orders.every((order) => order.canRequestRefund)).toBe(true);
    for (const entity of [PortalOrderItem, PortalVoucher, PortalTicket])
      expect(f.readQueries.filter((read) => read === entity)).toHaveLength(1);
  });
});

describe('coupon checkout packages', () => {
  it('prices and reserves the selected package, preserving its issuance snapshot', async () => {
    const f = fixture();
    const order = await f.create();
    expect(order.total).toBe(100_000);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(0);
    expect(f.rows(PortalOrderItem)[0].packageSnapshot.name).toBe(
      'Dinner for two',
    );
    expect(f.rows(PortalVoucher)).toHaveLength(0);
    expect(f.locks).toContain(PortalCouponPackage);
    await f.service.payOrder(1, order.id, { paymentMethod: 'coins' });
    expect(f.rows(PortalVoucher)[0].packageId).toBe(2);
    expect(f.rows(PortalVoucher)[0].status).toBe('Issued');
  });
  it('rejects a package from a different coupon without changing stock', async () => {
    const f = fixture();
    await expect(
      f.service.createOrder(1, { ...f.dto, packagePublicId: 'other' }, 'other'),
    ).rejects.toThrow('Coupon package not found');
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(1);
  });
  it('rejects expired coupons and inactive packages', async () => {
    const f = fixture();
    f.rows(PortalCoupon)[0].expiresAt = new Date(0);
    await expect(f.create()).rejects.toThrow('Product sales have ended');
    f.rows(PortalCoupon)[0].expiresAt = new Date('2099-01-01');
    f.rows(PortalCouponPackage)[0].active = false;
    await expect(f.create()).rejects.toThrow('inactive');
  });
  it('reserves the final package once under concurrent buyers and identical retries', async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      f.create(),
      f.create(),
      f.service.createOrder(2, f.dto, 'other'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(f.rows(PortalOrder)).toHaveLength(1);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(0);
  });
  it('blocks paid direct claims but permits free claims', async () => {
    const f = fixture();
    await expect(f.passes.claimCoupon(1, 'dinner', PACKAGE)).rejects.toThrow(
      'require checkout',
    );
    expect(f.rows(PortalVoucher)).toHaveLength(0);
    const free = fixture(0);
    await free.passes.claimCoupon(1, 'dinner', PACKAGE);
    expect(free.rows(PortalVoucher)[0].status).toBe('Issued');
  });
});

describe('payment lifecycle', () => {
  it('shares VA settlement with signed callbacks and rejects an invalid callback secret', async () => {
    const f = fixture();
    process.env.PORTAL_PAYMENT_WEBHOOK_SECRET = 'test-webhook-only';
    const order = await f.create();
    await f.service.payOrder(1, order.id, { paymentMethod: 'va' });
    const callback = {
      orderNumber: order.id,
      status: 'paid',
      paymentMethod: 'va',
      paymentReference: 'SANDBOX-CONFIRMED',
    };
    await expect(
      f.service.handlePaymentWebhook('wrong', callback),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await Promise.all([
      f.service.handlePaymentWebhook('test-webhook-only', callback),
      f.service.handlePaymentWebhook('test-webhook-only', callback),
    ]);
    expect(f.counts.paid).toBe(1);
    expect(f.rows(PortalVoucher)).toHaveLength(1);
    expect(f.rows(PortalOrder)[0].paymentReference).toBe('SANDBOX-CONFIRMED');
  });

  it('VA initiation stays pending and repeated initiation returns the same instructions', async () => {
    const f = fixture();
    const order = await f.create();
    const first = await f.service.payOrder(1, order.id, {
      paymentMethod: 'va',
    });
    const again = await f.service.payOrder(1, order.id, {
      paymentMethod: 'va',
    });
    expect(first.status).toBe('Pending');
    expect(first.virtualAccount).toEqual(again.virtualAccount);
    expect(first.paymentExpiresAt).toEqual(again.paymentExpiresAt);
    expect(f.rows(PortalVoucher)).toHaveLength(0);
    expect(f.counts.paid).toBe(0);
  });
  it('confirmation settles once, even when submitted concurrently', async () => {
    const f = fixture();
    const order = await f.create();
    await f.service.payOrder(1, order.id, { paymentMethod: 'va' });
    const result = await Promise.all([
      f.service.simulatePayment(1, order.id),
      f.service.simulatePayment(1, order.id),
    ]);
    expect(result.every((r) => r.status === 'Paid')).toBe(true);
    expect(f.counts.paid).toBe(1);
    expect(f.rows(PortalVoucher)).toHaveLength(1);
    expect(f.rows(PortalWallet)[0].balance).toBe(505_000);
  });
  it('requires own order and existing VA for sandbox confirmation', async () => {
    const f = fixture();
    const order = await f.create();
    await expect(f.service.simulatePayment(1, order.id)).rejects.toThrow(
      'No sandbox VA',
    );
    await expect(f.service.simulatePayment(2, order.id)).rejects.toThrow(
      'Order not found',
    );
  });
  it('disables sandbox initiation/confirmation in staging and production', async () => {
    const f = fixture();
    const order = await f.create();
    process.env.NODE_ENV = 'production';
    expect(paymentSandboxEnabled()).toBe(false);
    await expect(
      f.service.payOrder(1, order.id, { paymentMethod: 'va' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(f.service.simulatePayment(1, order.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    process.env.NODE_ENV = 'staging';
    expect(paymentSandboxEnabled()).toBe(false);
  });
  it('rejects insufficient coins without issuance or ledger mutations', async () => {
    const f = fixture();
    f.rows(PortalWallet)[0].balance = 10;
    const order = await f.create();
    await expect(
      f.service.payOrder(1, order.id, { paymentMethod: 'coins' }),
    ).rejects.toThrow('tidak cukup');
    expect(f.rows(PortalOrder)[0].status).toBe('Pending');
    expect(f.rows(PortalWalletTransaction)).toHaveLength(0);
  });
  it('enforces the exclusive deadline and expiry releases stock exactly once', async () => {
    const f = fixture();
    const order = await f.create();
    f.rows(PortalOrder)[0].paymentExpiresAt = new Date(0);
    expect(paymentExpired(new Date(10), new Date(10))).toBe(true);
    await expect(
      f.service.payOrder(1, order.id, { paymentMethod: 'coins' }),
    ).rejects.toThrow('deadline');
    await Promise.all([
      f.service.expirePendingOrders(),
      f.service.expirePendingOrders(),
    ]);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(1);
    expect(f.rows(PortalOrder)[0].status).toBe('Expired');
  });
  it('cancels a package reservation only once', async () => {
    const f = fixture();
    const order = await f.create();
    await Promise.all([
      f.service.cancelOrder(1, order.id),
      f.service.cancelOrder(1, order.id),
    ]);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(1);
  });
});

describe('refund and redeem', () => {
  it('initializes one missing wallet and settles concurrent confirmations once', async () => {
    const f = fixture();
    f.rows(PortalWallet).splice(0);
    const order = await f.create();
    await f.service.payOrder(1, order.id, { paymentMethod: 'va' });
    await Promise.all([
      f.service.simulatePayment(1, order.id),
      f.service.simulatePayment(1, order.id),
    ]);
    expect(f.rows(PortalWallet)).toHaveLength(1);
    expect(f.rows(PortalWallet)[0].balance).toBe(5000);
    expect(f.counts.paid).toBe(1);
    expect(f.locks).toContain(PortalWallet);
  });

  it('reverses full cashback into a negative balance when it was already spent', async () => {
    const f = fixture();
    const order = await f.create();
    await f.service.payOrder(1, order.id, { paymentMethod: 'va' });
    await f.service.simulatePayment(1, order.id);
    f.rows(PortalWallet)[0].balance = 0;
    await f.service.requestRefund(1, order.id, 'changed');
    await f.service.approveRefund(1, 9);
    expect(f.rows(PortalWallet)[0].balance).toBe(-5000);
    await f.service.approveRefund(1, 9);
    expect(f.rows(PortalWallet)[0].balance).toBe(-5000);
  });

  it('rejects refunds when a related ticket has already checked in', async () => {
    const f = fixture();
    const order = await f.paid();
    f.rows(PortalTicket).push({ id: 1, orderItemId: 1, status: 'CheckedIn' });
    await expect(
      f.service.requestRefund(1, order.id, 'changed'),
    ).rejects.toThrow('Used passes');
    expect(f.rows(PortalOrder)[0].refundStatus).not.toBe('Requested');
  });

  it('webhook and admin approval share one refund, including coin principal recovery', async () => {
    const f = fixture();
    process.env.PORTAL_PAYMENT_WEBHOOK_SECRET = 'test-webhook-only';
    const order = await f.paid();
    await f.service.requestRefund(1, order.id, 'changed');
    await Promise.all([
      f.service.approveRefund(1, 9),
      f.service.handlePaymentWebhook('test-webhook-only', {
        orderNumber: order.id,
        status: 'refunded',
      }),
    ]);
    expect(f.counts.refund).toBe(1);
    expect(f.rows(PortalWallet)[0].balance).toBe(500_000);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(1);
  });

  it('returns coin principal, reverses cashback and revokes the pass exactly once', async () => {
    const f = fixture();
    const order = await f.paid();
    await f.service.requestRefund(1, order.id, 'Schedule changed');
    await Promise.all([
      f.service.approveRefund(1, 9),
      f.service.approveRefund(1, 9),
    ]);
    expect(f.rows(PortalWallet)[0].balance).toBe(500_000);
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(1);
    expect(f.rows(PortalVoucher)[0].status).toBe('Cancelled');
    expect(f.counts.refund).toBe(1);
    expect(
      f.events.filter((e) => e.action === 'portal.refund_approved'),
    ).toHaveLength(1);
    expect(f.events.filter((e) => e.notification)).toHaveLength(1);
    expect(
      f
        .rows(PortalWalletTransaction)
        .filter((e) => e.description.startsWith('Refund payment')),
    ).toHaveLength(1);
  });
  it('requires an actual refund request and rejects blank reasons', async () => {
    const f = fixture();
    const order = await f.paid();
    await expect(f.service.approveRefund(1, 9)).rejects.toThrow(
      'request is required',
    );
    await expect(f.service.requestRefund(1, order.id, '   ')).rejects.toThrow(
      'reason is required',
    );
  });
  it('freezes usage when refund is requested and restores it only after rejection', async () => {
    const f = fixture();
    const order = await f.paid();
    await f.service.requestRefund(1, order.id, 'changed');
    await expect(f.campaign.verifyUsage('voucher', 1, 9)).rejects.toThrow(
      'paid order',
    );
    expect(f.rows(PortalVoucher)[0].status).toBe('RefundPending');
    await f.service.rejectRefund(1, 9, 'Not eligible');
    await f.campaign.verifyUsage('voucher', 1, 9);
    await expect(f.service.requestRefund(1, order.id, 'again')).rejects.toThrow(
      'Used passes',
    );
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(0);
  });
  it('audits repeated redeem without awarding usage twice or leaking the QR', async () => {
    const f = fixture();
    await f.paid();
    await Promise.all([
      f.campaign.verifyUsage('voucher', 1, 9),
      f.campaign.verifyUsage('voucher', 1, 9),
    ]);
    expect(f.counts.usage).toBe(1);
    expect(
      f.events
        .filter((e) => e.action === 'portal.voucher_redeem')
        .map((e) => e.metadata.outcome),
    ).toEqual(['verified', 'repeated']);
    expect(
      f.events.find((e) => e.action === 'portal.voucher_redeem')?.actorId,
    ).toBe(9);
    expect(f.events[0].metadata).not.toHaveProperty('token');
  });
  it('serializes approval and redeem so only one can change an issued pass', async () => {
    const f = fixture();
    const order = await f.paid();
    await f.service.requestRefund(1, order.id, 'changed');
    const results = await Promise.allSettled([
      f.service.approveRefund(1, 9),
      f.campaign.verifyUsage('voucher', 1, 9),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refunded = f.rows(PortalOrder)[0].status === 'Refunded';
    expect(f.rows(PortalVoucher)[0].status).toBe(
      refunded ? 'Cancelled' : 'Redeemed',
    );
    expect(f.rows(PortalCouponPackage)[0].stockRemaining).toBe(
      refunded ? 1 : 0,
    );
  });
  it('records expired legacy voucher refusal and supports sandbox VA refunds', async () => {
    const f = fixture(0);
    await f.passes.claimCoupon(1, 'dinner', PACKAGE);
    f.rows(PortalVoucher)[0].expiresAt = new Date(0);
    await expect(
      f.campaign.verifyUsage('voucher', 1, 9),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.events[0].metadata.outcome).toBe('rejected');
    const va = fixture();
    const order = await va.create();
    await va.service.payOrder(1, order.id, { paymentMethod: 'va' });
    await va.service.simulatePayment(1, order.id);
    await va.service.requestRefund(1, order.id, 'changed');
    const refunded = await va.service.approveRefund(1, 9);
    expect(refunded.status).toBe('Refunded');
    expect(
      va.events.find((event) => event.action === 'portal.refund_approved')
        ?.metadata.sandbox,
    ).toBe(true);
  });
});
