import { createPortalServiceFixture } from '../utils/portal-services';
import { cleanDatabase } from '../utils/db-clean';
import { PortalCampaignReconciliationService } from '@/portal/campaigns/portal-campaign-reconciliation.service';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '@/database/data-source';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalService } from '@/portal/portal.service';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalReferral } from '@/portal/campaigns/entities/portal-referral.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { User } from '@/users/entities/user.entity';
import {
  PortalCampaignAdminService,
  PortalCampaignProgressAdminService,
} from '@/portal/admin/portal-admin.service';
import { DEMO_EVENT_SEEDS } from '@/portal/seed/portal-event-seed.data';
import { PassQrService } from '@/portal/passes/pass-qr.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Service-level database tests, without an HTTP/E2E harness. Never touch the app DB.
const schema = `campaign_test_${randomUUID().replaceAll('-', '')}`;
let db: DataSource;
let engine: PortalCampaignService;
let portal: PortalService;
let campaign: PortalCampaign;
let user: User;
let coupon: PortalCoupon;
let passQr: PassQrService;

async function makeUser() {
  return db.getRepository(User).save({
    email: `${randomUUID()}@example.test`,
    password: 'test-only',
    fullname: 'Campaign test',
  });
}
async function makeCampaign(target = 15, patch: Partial<PortalCampaign> = {}) {
  return db.getRepository(PortalCampaign).save({
    slug: `test-${randomUUID()}`,
    title: 'Test campaign',
    description: 'Test',
    rewardLabel: 'Test reward',
    imageUrl: 'https://example.test/image.jpg',
    targetPoints: target,
    active: true,
    rules: {
      startsAt: '2026-01-01T00:00:00Z',
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 25,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
    ...patch,
  });
}
async function order(userId = user.id, promoCode?: string, key = randomUUID()) {
  const created = await portal.createOrder(
    userId,
    {
      kind: 'coupon',
      slug: coupon.slug,
      attendee: 'Test',
      email: 'test@example.test',
      phone: '081234567890',
      promoCode,
    },
    key,
  );
  return db
    .getRepository(PortalOrder)
    .findOneByOrFail({ orderNumber: created.id });
}
async function pay(pending: PortalOrder) {
  await portal.payOrder(pending.userId, pending.orderNumber, {
    paymentMethod: 'va',
  });
  return db.getRepository(PortalOrder).findOneByOrFail({ id: pending.id });
}
async function balance(userId = user.id) {
  return engine.progress(userId, campaign.slug);
}
async function refund(paid: PortalOrder) {
  await (
    portal as unknown as {
      refundOrderFromWebhook(userId: number, number: string): Promise<unknown>;
    }
  ).refundOrderFromWebhook(paid.userId, paid.orderNumber);
}

beforeAll(async () => {
  if (process.env.DB_NAME !== 'kuponmalam_test')
    throw new Error('Campaign integration requires kuponmalam_test');
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
  engine = new PortalCampaignService(db);
  passQr = new PassQrService(
    db.getRepository(PortalVoucher),
    db.getRepository(PortalTicket),
    db.getRepository(PortalEvent),
    new ConfigService({ JWT_SECRET: 'campaign_integration_secret' }),
  );
  portal = createPortalServiceFixture({
    dataSource: db,
    campaigns: engine,
    couponRepository: db.getRepository(PortalCoupon),
    eventRepository: db.getRepository(PortalEvent),
    voucherRepository: db.getRepository(PortalVoucher),
    ticketRepository: db.getRepository(PortalTicket),
    reviewRepository: db.getRepository(PortalReview),
    orderRepository: db.getRepository(PortalOrder),
    orderItemRepository: db.getRepository(PortalOrderItem),
    usersService: {
      findOne: (id: number) => db.getRepository(User).findOneByOrFail({ id }),
    },
  });
}, 30000);

afterAll(async () => {
  if (db?.isInitialized) {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.destroy();
  }
});

beforeEach(async () => {
  await db
    .getRepository(PortalCampaign)
    .createQueryBuilder()
    .update()
    .set({ active: false })
    .execute();
  user = await makeUser();
  campaign = await makeCampaign();
  coupon = await db.getRepository(PortalCoupon).save({
    slug: `coupon-${randomUUID()}`,
    title: 'Test coupon',
    merchant: 'Test',
    city: 'Jakarta',
    location: 'Jakarta',
    category: 'Food',
    price: 100,
    expiresAt: new Date(Date.now() + 86400000),
    stockTotal: 50,
    stockRemaining: 50,
    imageUrl: 'https://example.test/image.jpg',
    description: 'Test',
    benefits: 'Test',
    terms: 'Test',
    redemption: 'Test',
    active: true,
  });
});

describe('campaign PostgreSQL transactions', () => {
  it('counts a payment once across concurrent retries and issues exactly one reward at target', async () => {
    const pending = await order();
    await Promise.all([pay(pending), pay(pending)]);
    expect((await balance()).points).toBe(10);
    expect(
      await db
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: campaign.id, userId: user.id }),
    ).toBe(1);
    const second = await order();
    await Promise.all([pay(second), pay(second)]);
    expect((await balance()).points).toBe(20);
    expect(
      await db
        .getRepository(PortalPromoCode)
        .countBy({ ownerUserId: user.id, campaignId: campaign.id }),
    ).toBe(1);
  });

  it('gives usage points once and adds them to payment points', async () => {
    await pay(await order());
    const voucher = await db
      .getRepository(PortalVoucher)
      .findOneByOrFail({ userId: user.id });
    await Promise.all([
      engine.verifyUsage('voucher', voucher.id, user.id),
      engine.verifyUsage('voucher', voucher.id, user.id),
    ]);
    expect((await balance()).points).toBe(15);
    expect((await balance()).reward?.status).toBe('available');
    await expect(
      portal.requestRefund(
        user.id,
        (
          await db
            .getRepository(PortalOrder)
            .findOneByOrFail({ userId: user.id })
        ).orderNumber,
        'test refund',
      ),
    ).rejects.toThrow();
  });

  it('turns a scanned QR token into exactly one verified usage', async () => {
    await pay(await order());
    const voucher = await db
      .getRepository(PortalVoucher)
      .findOneByOrFail({ userId: user.id });
    const issued = await passQr.issue('voucher', user.id, voucher.code);
    const id = await passQr.resolve('voucher', issued.token);
    expect(id).toBe(voucher.id);
    await Promise.all([
      engine.verifyUsage('voucher', id, user.id),
      engine.verifyUsage('voucher', id, user.id),
    ]);
    expect((await balance()).points).toBe(15);
    expect(
      (await db.getRepository(PortalVoucher).findOneByOrFail({ id })).status,
    ).toBe('Redeemed');
    await expect(
      passQr.issue('voucher', user.id, voucher.code),
    ).rejects.toThrow(ConflictException);
  });

  it('completes refunds after audited deductions and preserves the signed ledger balance', async () => {
    const paid = await pay(await order());
    await engine.adjust(
      {
        campaignId: campaign.id,
        userId: user.id,
        points: -8,
        reason: 'Audited correction',
        idempotencyKey: randomUUID(),
      },
      user.id,
    );
    await refund(paid);
    await refund(paid);
    expect((await balance()).points).toBe(0);
    const stored = await db
      .getRepository(PortalCampaignProgress)
      .findOneByOrFail({ campaignId: campaign.id, userId: user.id });
    expect(stored.points).toBe(-8);
    const entries = await db
      .getRepository(PortalCampaignLedger)
      .findBy({ campaignId: campaign.id, userId: user.id });
    expect(entries.reduce((sum, entry) => sum + entry.points, 0)).toBe(-8);
    await pay(await order());
    expect((await balance()).points).toBe(2);
  });

  it('does not credit unpaid, expired or historically unlinked vouchers', async () => {
    const paid = await pay(await order());
    const voucher = await db
      .getRepository(PortalVoucher)
      .findOneByOrFail({ userId: user.id });
    await db.getRepository(PortalOrder).update(paid.id, { status: 'Pending' });
    await expect(
      engine.verifyUsage('voucher', voucher.id, user.id),
    ).rejects.toThrow();
    await db.getRepository(PortalOrder).update(paid.id, { status: 'Paid' });
    await db
      .getRepository(PortalVoucher)
      .update(voucher.id, { expiresAt: new Date(0) });
    await expect(
      engine.verifyUsage('voucher', voucher.id, user.id),
    ).rejects.toThrow();
    await db.getRepository(PortalVoucher).update(voucher.id, {
      orderItemId: null,
      expiresAt: new Date(Date.now() + 86400000),
    });
    await engine.verifyUsage('voucher', voucher.id, user.id);
    await engine.verifyUsage('voucher', voucher.id, user.id);
    expect(
      (
        await db
          .getRepository(PortalVoucher)
          .findOneByOrFail({ id: voucher.id })
      ).status,
    ).toBe('Redeemed');
    expect((await balance()).points).toBe(10);
  });

  it('credits only matching enabled campaigns after their activation time', async () => {
    await db.getRepository(PortalCampaign).update(campaign.id, {
      rules: { ...campaign.rules!, couponIds: [coupon.id + 999] },
    });
    const matching = await makeCampaign(50, {
      rules: { ...campaign.rules!, couponIds: [coupon.id], usagePoints: 0 },
    });
    const future = await makeCampaign(50, {
      rules: { ...campaign.rules!, startsAt: '2099-01-01T00:00:00Z' },
    });
    const legacy = await makeCampaign(50, { rules: null });
    await pay(await order());
    expect((await balance()).points).toBe(0);
    expect((await engine.progress(user.id, matching.slug)).points).toBe(10);
    expect((await engine.progress(user.id, future.slug)).points).toBe(0);
    expect((await engine.progress(user.id, legacy.slug)).points).toBe(0);
  });

  it('credits the referrer only for the first paid order and reverses both recipients on refund', async () => {
    const referrer = await makeUser();
    const info = await engine.getReferral(referrer.id);
    await engine.confirmReferral(user.id, info.code);
    const one = await order();
    const two = await order();
    await Promise.all([pay(one), pay(two)]);
    expect((await balance(referrer.id)).points).toBe(20);
    expect((await balance()).points).toBe(20);
    const attribution = await db
      .getRepository(PortalReferral)
      .findOneByOrFail({ userId: user.id });
    const first = await db
      .getRepository(PortalOrder)
      .findOneByOrFail({ id: attribution.firstOrderId! });
    await Promise.all([refund(first), refund(first)]);
    expect((await balance(referrer.id)).points).toBe(0);
    expect((await balance()).points).toBe(10);
    expect((await balance(referrer.id)).reward?.status).toBe('revoked');
    await pay(await order());
    expect((await balance(referrer.id)).points).toBe(0);
  });

  it('rejects self referral, replacement, cycles and attribution after a payment', async () => {
    const own = await engine.getReferral(user.id);
    await expect(engine.confirmReferral(user.id, own.code)).rejects.toThrow();
    const referrer = await makeUser();
    const info = await engine.getReferral(referrer.id);
    await engine.confirmReferral(user.id, info.code);
    await engine.confirmReferral(user.id, info.code);
    await expect(
      engine.confirmReferral(referrer.id, own.code),
    ).rejects.toThrow();
    const other = await makeUser();
    await expect(
      engine.confirmReferral(
        user.id,
        (await engine.getReferral(other.id)).code,
      ),
    ).rejects.toThrow();
    await pay(await order(other.id));
    await expect(engine.confirmReferral(other.id, info.code)).rejects.toThrow();
  });

  it('does not award payment/referral points for a zero-value order', async () => {
    await db.getRepository(PortalCoupon).update(coupon.id, { price: 0 });
    const referrer = await makeUser();
    await engine.confirmReferral(
      user.id,
      (await engine.getReferral(referrer.id)).code,
    );
    await pay(await order());
    expect((await balance()).points).toBe(0);
    expect((await balance(referrer.id)).points).toBe(0);
  });

  it('reserves a personal code once, rejects other owners and releases it on cancellation', async () => {
    await pay(await order());
    await pay(await order());
    const code = (await balance()).reward!.code!;
    const other = await makeUser();
    await expect(order(other.id, code)).rejects.toThrow();
    const attempts = await Promise.allSettled([
      order(user.id, code),
      order(user.id, code),
    ]);
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const reserved = attempts.find(
      (result) => result.status === 'fulfilled',
    ) as PromiseFulfilledResult<PortalOrder>;
    expect((await balance()).reward?.status).toBe('reserved');
    await portal.cancelOrder(user.id, reserved.value.orderNumber);
    expect((await balance()).reward?.status).toBe('available');
    const next = await pay(await order(user.id, code));
    expect((await balance()).reward?.status).toBe('used');
    await refund(next);
    expect((await balance()).reward?.status).toBe('used');
    await expect(order(user.id, code)).rejects.toThrow();
  });

  it('revokes an unused reward on refund and reactivates the same code without extending expiry', async () => {
    const first = await pay(await order());
    await pay(await order());
    const original = (await balance()).reward!;
    await refund(first);
    expect((await balance()).reward?.status).toBe('revoked');
    await pay(await order());
    expect((await balance()).reward?.code).toBe(original.code);
    expect((await balance()).reward?.expiresAt).toEqual(original.expiresAt);
    await db
      .getRepository(PortalPromoCode)
      .update(
        { campaignId: campaign.id, ownerUserId: user.id },
        { expiresAt: new Date(0) },
      );
    await pay(await order());
    expect((await balance()).reward?.status).toBe('expired');
    expect(
      await db
        .getRepository(PortalPromoCode)
        .countBy({ campaignId: campaign.id, ownerUserId: user.id }),
    ).toBe(1);
  });

  it('blocks payment of a reserved reward revoked by refund while permitting cancellation', async () => {
    const first = await pay(await order());
    await pay(await order());
    const pending = await order(user.id, (await balance()).reward!.code!);
    await refund(first);
    await expect(pay(pending)).rejects.toThrow();
    await portal.cancelOrder(user.id, pending.orderNumber);
    expect((await balance()).reward?.status).toBe('revoked');
  });

  it('uses exact order resources when two purchases have the same product', async () => {
    const first = await pay(await order());
    const second = await pay(await order());
    const vouchers = await db
      .getRepository(PortalVoucher)
      .find({ where: { userId: user.id }, order: { id: 'ASC' } });
    expect(vouchers).toHaveLength(2);
    expect(vouchers[0].orderItemId).not.toBe(vouchers[1].orderItemId);
    await refund(second);
    expect(
      (
        await db
          .getRepository(PortalVoucher)
          .findOneByOrFail({ id: vouchers[0].id })
      ).status,
    ).toBe('Issued');
    expect(
      (
        await db
          .getRepository(PortalVoucher)
          .findOneByOrFail({ id: vouchers[1].id })
      ).status,
    ).toBe('Cancelled');
    await expect(
      portal.payOrder(user.id, second.orderNumber, { paymentMethod: 'va' }),
    ).rejects.toThrow();
    expect(
      (await db.getRepository(PortalOrder).findOneByOrFail({ id: first.id }))
        .status,
    ).toBe('Paid');
  });

  it('supports audited idempotent adjustments, preserves baseline and rejects direct progress writes', async () => {
    await db.getRepository(PortalCampaignProgress).save({
      campaignId: campaign.id,
      userId: user.id,
      points: 18,
      targetPoints: 15,
      status: 'pending',
    });
    await db.getRepository(PortalCampaignLedger).save({
      campaignId: campaign.id,
      userId: user.id,
      points: 18,
      kind: 'baseline',
      sourceKey: 'baseline',
      orderId: null,
      actorId: null,
      reason: 'Opening balance',
    });
    expect((await balance()).reward).toBeNull();
    const adjustment = {
      campaignId: campaign.id,
      userId: user.id,
      points: 2,
      reason: 'Verified correction',
      idempotencyKey: randomUUID(),
    };
    await Promise.all([
      engine.adjust(adjustment, user.id),
      engine.adjust(adjustment, user.id),
    ]);
    expect((await balance()).points).toBe(20);
    await expect(
      engine.adjust({ ...adjustment, points: 3 }, user.id),
    ).rejects.toThrow();
    await expect(
      engine.adjust(
        { ...adjustment, idempotencyKey: randomUUID(), points: -21 },
        user.id,
      ),
    ).rejects.toThrow();
    const history = await engine.history(user.id, campaign.slug, 1, 1);
    expect(history.meta.total).toBe(2);
    expect(history.meta.lastPage).toBe(2);
    const admin = new PortalCampaignProgressAdminService(
      db.getRepository(PortalCampaignProgress),
      db.getRepository(User),
      db.getRepository(PortalCampaign),
    );
    await expect(
      admin.create({ userId: user.id, campaignId: campaign.id, points: 100 }),
    ).rejects.toThrow();
    await expect(admin.remove(1)).rejects.toThrow();
  });

  it('freezes configuration after verified activity and allows legacy rules to be enabled', async () => {
    const admin = new PortalCampaignAdminService(
      db.getRepository(PortalCampaign),
    );
    const legacy = await makeCampaign(25, { rules: null });
    await admin.update(legacy.id, { rules: campaign.rules });
    await pay(await order());
    await expect(
      admin.update(campaign.id, { targetPoints: 20 }),
    ).rejects.toThrow();
    await expect(
      admin.update(campaign.id, {
        rules: { ...campaign.rules!, paymentPoints: 30 },
      }),
    ).rejects.toThrow();
    await admin.update(campaign.id, {
      title: 'Updated description',
      active: false,
    });
  });

  it('links reserved and issued passes to their owning order number', async () => {
    const event = await db.getRepository(PortalEvent).save({
      ...DEMO_EVENT_SEEDS[0].event,
      slug: `event-${randomUUID()}`,
      startsAt: new Date(Date.now() + 86400000),
    });
    const type = await db.getRepository(PortalEventTicket).save({
      eventId: event.id,
      name: 'Regular',
      price: 100,
      stockTotal: 10,
      stockRemaining: 10,
      description: 'Test',
      statusLabel: 'Available',
    });
    const created = await portal.createOrder(
      user.id,
      {
        kind: 'ticket',
        slug: event.slug,
        ticketType: type.name,
        attendee: 'Test',
        email: 'test@example.test',
        phone: '081234567890',
      },
      randomUUID(),
    );
    const [reserved] = await portal.listTickets(user.id);
    expect(reserved).toMatchObject({ status: 'Reserved', orderId: created.id });
    await portal.payOrder(user.id, created.id, { paymentMethod: 'va' });
    const [issued] = await portal.listTickets(user.id);
    expect(issued).toMatchObject({ status: 'Issued', orderId: created.id });
    expect(await portal.getTicket(user.id, issued.id)).toMatchObject({
      orderId: created.id,
    });

    const paid = await pay(await order());
    const [voucher] = await portal.listVouchers(user.id);
    expect(voucher).toMatchObject({
      status: 'Issued',
      orderId: paid.orderNumber,
    });
    expect(await portal.getVoucher(user.id, voucher.id)).toMatchObject({
      orderId: paid.orderNumber,
    });

    // Another user never sees this user's order number on their passes.
    const other = await makeUser();
    expect(await portal.listTickets(other.id)).toEqual([]);
  });

  it('finds orders by ORD code and hides numeric ids owned by others', async () => {
    const mine = await order();
    expect(await portal.getOrder(user.id, mine.orderNumber)).toMatchObject({
      id: mine.orderNumber,
    });
    expect(await portal.getOrder(user.id, String(mine.id))).toMatchObject({
      id: mine.orderNumber,
    });
    const other = await makeUser();
    await expect(portal.getOrder(other.id, String(mine.id))).rejects.toThrow(
      NotFoundException,
    );
    await expect(portal.getOrder(user.id, 'ORD-DOESNOTEXIST')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('verifies ticket check-in exactly once and rejects an expired event', async () => {
    const event = await db.getRepository(PortalEvent).save({
      ...DEMO_EVENT_SEEDS[0].event,
      slug: `event-${randomUUID()}`,
      startsAt: new Date(),
    });
    const type = await db.getRepository(PortalEventTicket).save({
      eventId: event.id,
      name: 'Regular',
      price: 100,
      stockTotal: 10,
      stockRemaining: 10,
      description: 'Test',
      statusLabel: 'Available',
    });
    const created = await portal.createOrder(
      user.id,
      {
        kind: 'ticket',
        slug: event.slug,
        ticketType: type.name,
        attendee: 'Test',
        email: 'test@example.test',
        phone: '081234567890',
      },
      randomUUID(),
    );
    await portal.payOrder(user.id, created.id, { paymentMethod: 'va' });
    const ticket = await db
      .getRepository(PortalTicket)
      .findOneByOrFail({ userId: user.id });
    await Promise.all([
      engine.verifyUsage('ticket', ticket.id, user.id),
      engine.verifyUsage('ticket', ticket.id, user.id),
    ]);
    expect((await balance()).points).toBe(15);
    await db
      .getRepository(PortalTicket)
      .update(ticket.id, { status: 'Issued', checkedInAt: null });
    await db
      .getRepository(PortalEvent)
      .update(event.id, { startsAt: new Date(0) });
    await expect(
      engine.verifyUsage('ticket', ticket.id, user.id),
    ).rejects.toThrow();
    // The QR issuer applies the same check-in window as verification.
    await expect(passQr.issue('ticket', user.id, ticket.code)).rejects.toThrow(
      ConflictException,
    );
  });

  it('lists checked-in tickets as CheckedIn and unlocks event reviews', async () => {
    const event = await db.getRepository(PortalEvent).save({
      ...DEMO_EVENT_SEEDS[0].event,
      slug: `event-${randomUUID()}`,
      startsAt: new Date(),
    });
    const type = await db.getRepository(PortalEventTicket).save({
      eventId: event.id,
      name: 'Regular',
      price: 100,
      stockTotal: 10,
      stockRemaining: 10,
      description: 'Test',
      statusLabel: 'Available',
    });
    const created = await portal.createOrder(
      user.id,
      {
        kind: 'ticket',
        slug: event.slug,
        ticketType: type.name,
        attendee: 'Test',
        email: 'test@example.test',
        phone: '081234567890',
      },
      randomUUID(),
    );
    await portal.payOrder(user.id, created.id, { paymentMethod: 'va' });
    const review = {
      targetType: 'event',
      targetKey: event.slug,
      rating: 5,
      body: 'Seru',
    };
    await expect(portal.createReview(user.id, review)).rejects.toThrow(
      ConflictException,
    );
    const ticket = await db
      .getRepository(PortalTicket)
      .findOneByOrFail({ userId: user.id });
    await engine.verifyUsage('ticket', ticket.id, user.id);
    expect((await portal.listTickets(user.id))[0].status).toBe('CheckedIn');
    await expect(portal.createReview(user.id, review)).resolves.toMatchObject({
      targetKey: event.slug,
      verified: true,
    });
  });

  it('lists an issued voucher past its validity as Expired', async () => {
    await db.getRepository(PortalVoucher).save({
      userId: user.id,
      couponId: coupon.id,
      code: `VCH-${randomUUID().slice(0, 8)}`,
      status: 'Issued',
      expiresAt: new Date(Date.now() - 1000),
      timeZone: 'Asia/Jakarta',
      redeemedAt: null,
      imageUrl: coupon.imageUrl,
    });
    const [voucher] = await portal.listVouchers(user.id);
    expect(voucher.status).toBe('Expired');
  });

  it('reconciles legitimate rewards and signed balances without changing business data', async () => {
    const paid = await pay(await order());
    const check = new PortalCampaignReconciliationService(db);
    expect((await check.check()).issueCount).toBe(0);
    await pay(await order());
    const promo = (await balance()).reward!.code!;
    const pending = await order(user.id, promo);
    expect((await check.check()).issueCount).toBe(0);
    await portal.cancelOrder(user.id, pending.orderNumber);
    await refund(paid);
    expect((await check.check()).issueCount).toBe(0);
    const stored = await db
      .getRepository(PortalCampaignProgress)
      .findOneByOrFail({ campaignId: campaign.id, userId: user.id });
    await db
      .getRepository(PortalCampaignProgress)
      .update(stored.id, { points: 777 });
    const report = await check.check();
    expect(report.counts.balance_mismatch).toBe(1);
    expect(
      report.samples.some(
        (row) => row.campaignId === campaign.id && row.userId === user.id,
      ),
    ).toBe(true);
    expect(
      (
        await db
          .getRepository(PortalCampaignProgress)
          .findOneByOrFail({ id: stored.id })
      ).points,
    ).toBe(777);
    await db
      .getRepository(PortalCampaignProgress)
      .update(stored.id, { points: stored.points });
  });

  it('detects invalid reward reservations and missing rewards without issuing replacements', async () => {
    await pay(await order());
    await pay(await order());
    const promo = await db
      .getRepository(PortalPromoCode)
      .findOneByOrFail({ campaignId: campaign.id, ownerUserId: user.id });
    const pending = await order(user.id, promo.code);
    const check = new PortalCampaignReconciliationService(db);
    await db
      .getRepository(PortalOrder)
      .update(pending.id, { status: 'Cancelled' });
    expect((await check.check()).counts.reward_reservation).toBe(1);
    await db
      .getRepository(PortalOrder)
      .update(pending.id, { status: 'Pending' });
    await portal.cancelOrder(user.id, pending.orderNumber);
    await db.getRepository(PortalPromoCode).delete(promo.id);
    expect((await check.check()).counts.reward_missing).toBe(1);
    expect(
      await db
        .getRepository(PortalPromoCode)
        .countBy({ campaignId: campaign.id, ownerUserId: user.id }),
    ).toBe(0);
    // Restore the fixture for following checks, without changing production reconciliation.
    await db.getRepository(PortalPromoCode).save(promo);
  });

  it('skips overlapping reconciliation and ignores uncommitted balance changes', async () => {
    await pay(await order());
    const check = new PortalCampaignReconciliationService(db);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SELECT pg_advisory_xact_lock(71404, 0)');
      expect((await check.check()).skipped).toBe(true);
      await runner.rollbackTransaction();
      await runner.startTransaction();
      await runner.manager
        .getRepository(PortalCampaignProgress)
        .update({ userId: user.id, campaignId: campaign.id }, { points: 999 });
      expect((await check.check()).issueCount).toBe(0);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('bounds lock waits, returns a retryable failure and safely retries the same adjustment key', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const dto = {
      userId: user.id,
      campaignId: campaign.id,
      points: 3,
      reason: 'Retry after lock timeout',
      idempotencyKey: randomUUID(),
    };
    try {
      await runner.query('SELECT pg_advisory_xact_lock(71402, $1)', [user.id]);
      await expect(engine.adjust(dto, user.id)).rejects.toThrow(
        'temporarily unavailable',
      );
      expect(
        await db
          .getRepository(PortalCampaignLedger)
          .countBy({ campaignId: campaign.id, userId: user.id }),
      ).toBe(0);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
    await engine.adjust(dto, user.id);
    await engine.adjust(dto, user.id);
    expect((await balance()).points).toBe(3);
    expect(
      await db
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: campaign.id, userId: user.id }),
    ).toBe(1);
  }, 15000);

  it('rolls back a disconnected database transaction and retries payment without duplicate points', async () => {
    const pending = await order();
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await engine.lockCommerce(runner.manager, user.id);
      const paid = { ...pending, status: 'Paid', paidAt: new Date() };
      await runner.manager.getRepository(PortalOrder).save(paid);
      await engine.paid(runner.manager, paid);
      const [connection] = await runner.query<Array<{ pid: number }>>(
        'SELECT pg_backend_pid() AS pid',
      );
      await db.query('SELECT pg_terminate_backend($1)', [connection.pid]);
      await expect(runner.commitTransaction()).rejects.toThrow();
    } finally {
      if (runner.isTransactionActive)
        await runner.rollbackTransaction().catch(() => undefined);
      await runner.release().catch(() => undefined);
    }
    expect(
      (await db.getRepository(PortalOrder).findOneByOrFail({ id: pending.id }))
        .status,
    ).toBe('Pending');
    expect(
      await db
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: campaign.id, userId: user.id }),
    ).toBe(0);
    await pay(pending);
    // Retry also covers a response lost after a successful commit.
    await pay(pending);
    expect((await balance()).points).toBe(10);
    expect(
      await db
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: campaign.id, userId: user.id }),
    ).toBe(1);
  });

  it('preserves points and one reward under bounded concurrent load across many active campaigns', async () => {
    const campaigns = [campaign];
    for (let index = 1; index < 24; index++)
      campaigns.push(await makeCampaign(10));
    // Normalize targets so every successful payment should mint one code.
    await db
      .getRepository(PortalCampaign)
      .update(campaign.id, { targetPoints: 10 });
    const users = await Promise.all(
      Array.from({ length: 12 }, () => makeUser()),
    );
    const pending = await Promise.all(users.map((buyer) => order(buyer.id)));
    const durations: number[] = [];
    let retries = 0;
    for (let index = 0; index < pending.length; index += 4) {
      await Promise.all(
        pending.slice(index, index + 4).map(async (purchase) => {
          const started = performance.now();
          for (let attempt = 0; ; attempt++) {
            try {
              await pay(purchase);
              await pay(purchase);
              break;
            } catch (error) {
              if (
                attempt >= 2 ||
                !(error instanceof Error) ||
                !error.message.includes('temporarily unavailable')
              )
                throw error;
              retries++;
            }
          }
          durations.push(performance.now() - started);
        }),
      );
    }
    for (const buyer of users)
      for (const configured of campaigns) {
        const progress = await engine.progress(buyer.id, configured.slug);
        expect(progress.points).toBe(10);
        expect(progress.reward?.status).toBe('available');
      }
    const campaignIds = new Set(campaigns.map((row) => row.id));
    const buyerIds = new Set(users.map((row) => row.id));
    const entries = (
      await db.getRepository(PortalCampaignLedger).find()
    ).filter(
      (row) => campaignIds.has(row.campaignId) && buyerIds.has(row.userId),
    );
    expect(entries).toHaveLength(24 * 12);
    const rewards = (await db.getRepository(PortalPromoCode).find()).filter(
      (row) =>
        campaignIds.has(row.campaignId!) && buyerIds.has(row.ownerUserId!),
    );
    expect(rewards).toHaveLength(24 * 12);
    expect(
      (await new PortalCampaignReconciliationService(db).check()).issueCount,
    ).toBe(0);
    durations.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        event: 'campaign_load_test',
        campaigns: 24,
        buyers: 12,
        concurrency: 4,
        paymentCalls: 24,
        retries,
        p50Ms: Math.round(durations[5]),
        p95Ms: Math.round(durations[11]),
      }),
    );
  }, 90000);

  it('serializes concurrent referral confirmations and first payments to one bonus per friend', async () => {
    const referral = await engine.getReferral(user.id);
    const friends = await Promise.all(
      Array.from({ length: 8 }, () => makeUser()),
    );
    await Promise.all(
      friends.map((friend) => engine.confirmReferral(friend.id, referral.code)),
    );
    const purchases = await Promise.all(
      friends.map(async (friend) => [
        await order(friend.id),
        await order(friend.id),
      ]),
    );
    for (let index = 0; index < purchases.length; index += 4)
      await Promise.all(
        purchases
          .slice(index, index + 4)
          .flatMap((pair) => pair.map((purchase) => pay(purchase))),
      );
    expect((await balance()).points).toBe(8 * 20);
    const bonus = await db
      .getRepository(PortalCampaignLedger)
      .findBy({ userId: user.id, campaignId: campaign.id, kind: 'referral' });
    expect(bonus).toHaveLength(8);
    expect(new Set(bonus.map((entry) => entry.sourceKey)).size).toBe(8);
    expect(
      await db
        .getRepository(PortalPromoCode)
        .countBy({ ownerUserId: user.id, campaignId: campaign.id }),
    ).toBe(1);
    expect(
      (await new PortalCampaignReconciliationService(db).check()).issueCount,
    ).toBe(0);
  }, 30000);

  it('orders attribution against a simultaneous first payment without retroactive points', async () => {
    const referral = await engine.getReferral(user.id);
    const friend = await makeUser();
    const pending = await order(friend.id);
    const [confirmed, paid] = await Promise.allSettled([
      engine.confirmReferral(friend.id, referral.code),
      pay(pending),
    ]);
    expect(paid.status).toBe('fulfilled');
    const stored = await db
      .getRepository(PortalReferral)
      .findOneBy({ userId: friend.id });
    if (confirmed.status === 'fulfilled') {
      expect(stored?.referrerUserId).toBe(user.id);
      expect((await balance()).points).toBe(20);
    } else {
      expect(stored?.referrerUserId ?? null).toBeNull();
      expect((await balance()).points).toBe(0);
    }
    await pay(pending);
    expect((await balance()).points).toBe(
      confirmed.status === 'fulfilled' ? 20 : 0,
    );
  });

  it('cleans campaign foreign-key dependants safely in the guarded test harness', async () => {
    const friend = await makeUser();
    await engine.confirmReferral(
      friend.id,
      (await engine.getReferral(user.id)).code,
    );
    await pay(await order(friend.id));
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path = "${schema}"`);
      // Bind every cleanup statement to this transaction and isolated schema.
      await cleanDatabase(
        { options: db.options, query: runner.query.bind(runner) } as DataSource,
        user.email,
      );
      expect(
        await runner.manager.getRepository(PortalCampaignLedger).count(),
      ).toBe(0);
      expect(await runner.manager.getRepository(PortalReferral).count()).toBe(
        0,
      );
      expect(await runner.manager.getRepository(PortalOrder).count()).toBe(0);
      expect(await runner.manager.getRepository(PortalVoucher).count()).toBe(0);
      expect(await runner.manager.getRepository(User).count()).toBe(1);
      await runner.commitTransaction();
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
