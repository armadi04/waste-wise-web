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
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { AppDataSource } from '@/database/data-source';
import { User } from '@/users/entities/user.entity';
import { Permission } from '@/permissions/entities/permission.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { tokenFor } from './utils/auth';

const schema = `campaign_http_${randomUUID().replaceAll('-', '')}`;
let db: DataSource;
let ctx: TestContext;
let server: App;
let owner: User;
let other: User;
let staff: User;
let campaign: PortalCampaign;
let coupon: PortalCoupon;
let engine: PortalCampaignService;
const bearer = (user: User) => `Bearer ${tokenFor(ctx, user.id, user.email)}`;
const cookie = (user: User) => [
  `accessToken=${tokenFor(ctx, user.id, user.email)}`,
  'csrfToken=boundary-test',
];
const adjustment = (points = 10) => ({
  userId: owner.id,
  campaignId: campaign.id,
  points,
  reason: 'Audited test adjustment',
  idempotencyKey: randomUUID(),
});

async function makeUser(permissions: Permission[] = [], verified = true) {
  return db.getRepository(User).save({
    email: `${randomUUID()}@example.test`,
    password: 'test-only',
    fullname: 'Boundary test',
    emailVerifiedAt: verified ? new Date() : null,
    permissions,
  });
}
async function checkout(user: User, promoCode?: string) {
  return request(server)
    .post('/api/portal/orders')
    .set('Authorization', bearer(user))
    .set('Idempotency-Key', randomUUID())
    .send({
      kind: 'coupon',
      slug: coupon.slug,
      attendee: 'Test',
      email: user.email,
      phone: '08123',
      promoCode,
    });
}

beforeAll(async () => {
  if (process.env.DB_NAME !== 'kuponmalam_test')
    throw new Error('HTTP campaign tests require kuponmalam_test');
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
  const previousSeed = process.env.DB_SEED;
  process.env.DB_SEED = 'false';
  try {
    ctx = await setupTestApp(db);
  } finally {
    process.env.DB_SEED = previousSeed;
  }
  server = ctx.app.getHttpServer() as App;
  engine = ctx.app.get(PortalCampaignService);
}, 30000);

afterAll(async () => {
  if (db?.isInitialized)
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  if (ctx) await ctx.app.close();
  if (db?.isInitialized) await db.destroy();
});

beforeEach(async () => {
  owner = await makeUser();
  other = await makeUser();
  const permissions = await db.getRepository(Permission).find();
  if (!permissions.length) {
    for (const name of [
      'portal.campaign_progress.adjust',
      'portal.vouchers.redeem',
      'portal.tickets.check_in',
      'portal.campaigns.create',
    ])
      permissions.push(await db.getRepository(Permission).save({ name }));
  }
  staff = await makeUser(permissions);
  campaign = await db.getRepository(PortalCampaign).save({
    slug: randomUUID(),
    title: 'Test campaign',
    description: 'Test',
    rewardLabel: 'Reward',
    imageUrl: '/test.jpg',
    targetPoints: 10,
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
  });
  coupon = await db.getRepository(PortalCoupon).save({
    slug: randomUUID(),
    title: 'Test coupon',
    merchant: 'Test',
    city: 'Jakarta',
    location: 'Jakarta',
    category: 'Food',
    price: 100,
    expiresAt: new Date(Date.now() + 86400000),
    stockTotal: 50,
    stockRemaining: 50,
    imageUrl: '/test.jpg',
    description: 'Test',
    benefits: 'Test',
    terms: 'Test',
    redemption: 'Test',
    active: true,
  });
});

describe('Campaign HTTP security boundaries', () => {
  it('requires valid JWT and verified identity before private reads or writes', async () => {
    for (const path of [
      '/api/portal/me/referral',
      `/api/portal/me/campaigns/${campaign.slug}/progress`,
      `/api/portal/me/campaigns/${campaign.slug}/history`,
    ]) {
      await request(server).get(path).expect(401);
      await request(server)
        .get(path)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
      const expired = ctx.app
        .get(JwtService)
        .sign({ sub: owner.id }, { expiresIn: -1 });
      await request(server)
        .get(path)
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    }
    const unverified = await makeUser([], false);
    await request(server)
      .get('/api/portal/me/referral')
      .set('Authorization', bearer(unverified))
      .expect(403);
    await request(server)
      .post('/api/portal/me/referral')
      .send({ code: 'REF-ABCDEF123456ABCDEF123456' })
      .expect(401);
  });

  it('enforces action permissions rather than trusting a JWT alone', async () => {
    for (const path of [
      '/api/portal/admin/vouchers/1/redeem',
      '/api/portal/admin/tickets/1/check-in',
      '/api/portal/admin/campaign-progress/adjustments',
    ]) {
      await request(server).post(path).send(adjustment()).expect(401);
      await request(server)
        .post(path)
        .set('Authorization', bearer(owner))
        .send(adjustment())
        .expect(403);
    }
    await request(server)
      .post('/api/portal/admin/campaign-progress/adjustments')
      .set('Authorization', bearer(staff))
      .send(adjustment())
      .expect(201);
  });

  it('requires matching CSRF proof for cookie-authenticated writes while allowing bearer clients', async () => {
    const referral = await engine.getReferral(other.id);
    const path = '/api/portal/me/referral';
    await request(server)
      .post(path)
      .set('Cookie', cookie(owner))
      .send({ code: referral.code })
      .expect(403);
    await request(server)
      .post(path)
      .set('Cookie', cookie(owner))
      .set('X-CSRF-Token', 'wrong')
      .send({ code: referral.code })
      .expect(403);
    await request(server)
      .post(path)
      .set('Cookie', cookie(owner))
      .set('X-CSRF-Token', 'boundary-test')
      .send({ code: referral.code })
      .expect(201);
    await request(server).get(path).set('Cookie', cookie(owner)).expect(200);
    await request(server)
      .post('/api/portal/admin/campaign-progress/adjustments')
      .set('Cookie', cookie(staff))
      .send(adjustment())
      .expect(403);
    await request(server)
      .post('/api/portal/admin/campaign-progress/adjustments')
      .set('Cookie', cookie(staff))
      .set('X-CSRF-Token', 'boundary-test')
      .send(adjustment())
      .expect(201);
  });

  it('rejects malformed DTOs before changing balances or referral attribution', async () => {
    for (const code of [
      null,
      7,
      '',
      'REF-short',
      'REF-abcdef123456abcdef123456',
    ])
      await request(server)
        .post('/api/portal/me/referral')
        .set('Authorization', bearer(owner))
        .send({ code })
        .expect(400);
    for (const patch of [
      { points: 1.5 },
      { userId: 0 },
      { reason: '' },
      { idempotencyKey: 'x' },
      { points: 0 },
    ])
      await request(server)
        .post('/api/portal/admin/campaign-progress/adjustments')
        .set('Authorization', bearer(staff))
        .send({ ...adjustment(), ...patch })
        .expect(400);
    expect(
      await db
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: campaign.id, userId: owner.id }),
    ).toBe(0);
    await request(server)
      .get(`/api/portal/me/campaigns/${campaign.slug}/history?page=0`)
      .set('Authorization', bearer(owner))
      .expect(400);
    await request(server)
      .post('/api/portal/admin/campaigns')
      .set('Authorization', bearer(staff))
      .send({
        slug: randomUUID(),
        title: 'Invalid',
        description: 'Test',
        rewardLabel: 'Test',
        imageUrl: '/test.jpg',
        targetPoints: 10,
        active: true,
        rules: {
          ...campaign.rules,
          reward: { ...campaign.rules!.reward, kind: 'percentage', value: 101 },
        },
      })
      .expect(400);
  });

  it('keeps progress, history and personal codes scoped to the authenticated user', async () => {
    await engine.adjust(adjustment(), staff.id);
    const own = await request(server)
      .get(`/api/portal/me/campaigns/${campaign.slug}/progress`)
      .set('Authorization', bearer(owner))
      .expect(200);
    expect(own.body.reward.code).toStartWith('CMP-');
    const foreign = await request(server)
      .get(
        `/api/portal/me/campaigns/${campaign.slug}/progress?userId=${owner.id}`,
      )
      .set('Authorization', bearer(other))
      .expect(200);
    expect(foreign.body.points).toBe(0);
    expect(foreign.body.reward).toBeNull();
    const history = await request(server)
      .get(
        `/api/portal/me/campaigns/${campaign.slug}/history?userId=${owner.id}`,
      )
      .set('Authorization', bearer(other))
      .expect(200);
    expect(history.body.data).toEqual([]);
    const forbiddenPromo = await checkout(other, own.body.reward.code);
    expect(forbiddenPromo.status).toBe(403);
  });

  it('enforces order/voucher ownership and verified usage permission through HTTP', async () => {
    const created = await checkout(owner);
    expect(created.status).toBe(201);
    const path = `/api/portal/me/orders/${created.body.id}/pay`;
    await request(server)
      .post(path)
      .set('Authorization', bearer(other))
      .send({ paymentMethod: 'va' })
      .expect(404);
    await request(server)
      .post(path)
      .set('Cookie', cookie(owner))
      .send({ paymentMethod: 'va' })
      .expect(403);
    await request(server)
      .post(path)
      .set('Authorization', bearer(owner))
      .send({ paymentMethod: 'va' })
      .expect(201);
    const voucher = await db
      .getRepository(PortalVoucher)
      .findOneByOrFail({ userId: owner.id });
    await request(server)
      .get(`/api/portal/me/vouchers/${voucher.code}`)
      .set('Authorization', bearer(other))
      .expect(404);
    await request(server)
      .post(`/api/portal/admin/vouchers/${voucher.id}/redeem`)
      .set('Authorization', bearer(owner))
      .expect(403);
    await request(server)
      .post(`/api/portal/admin/vouchers/${voucher.id}/redeem`)
      .set('Authorization', bearer(staff))
      .expect(201);
    await request(server)
      .post(`/api/portal/admin/vouchers/${voucher.id}/redeem`)
      .set('Authorization', bearer(staff))
      .expect(201);
    expect((await engine.progress(owner.id, campaign.slug)).points).toBe(15);
  });
});
