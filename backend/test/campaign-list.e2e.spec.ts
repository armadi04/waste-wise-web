import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';

describe('Public campaign list and partial profile updates (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    await adminToken(ctx);
  });
  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
    await ctx.dataSource.query('DELETE FROM portal_campaigns');
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  it('lists only active campaigns with stable newest-first pagination anonymously', async () => {
    const repo = ctx.dataSource.getRepository(PortalCampaign);
    for (let index = 0; index < 27; index++)
      await repo.save(
        repo.create({
          slug: `test-${index}`,
          title: `Campaign ${index}`,
          description: 'Test',
          rewardLabel: 'Reward',
          imageUrl: '/test.jpg',
          targetPoints: 25,
          active: index < 26,
          createdAt: new Date('2026-01-01'),
        }),
      );
    const first = await request(server)
      .get('/api/portal/campaigns')
      .expect(200);
    expect(first.body.data).toHaveLength(24);
    expect(first.body.meta).toEqual({ total: 26, page: 1, lastPage: 2 });
    expect(first.body.data[0].slug).toBe('test-25');
    const second = await request(server)
      .get('/api/portal/campaigns?page=2')
      .expect(200);
    expect(second.body.data.map((item: { slug: string }) => item.slug)).toEqual(
      ['test-1', 'test-0'],
    );
    await request(server).get('/api/portal/campaigns/test-26').expect(404);
    for (const query of ['page=0', 'page=1.5', 'limit=101', 'limit=-1'])
      await request(server).get(`/api/portal/campaigns?${query}`).expect(400);
  });
  it('returns an empty list and allows clearing phone and toggling preferences independently', async () => {
    const empty = await request(server)
      .get('/api/portal/campaigns')
      .expect(200);
    expect(empty.body.data).toEqual([]);
    const user = await createUser(ctx, { email: 'draft@example.test' });
    const auth = `Bearer ${tokenFor(ctx, user.id, user.email)}`;
    await request(server)
      .patch('/api/portal/me/profile')
      .set('Authorization', auth)
      .send({ phone: '08123', notificationsEnabled: false })
      .expect(200);
    const renamed = await request(server)
      .patch('/api/portal/me/profile')
      .set('Authorization', auth)
      .send({ fullname: '  Nama baru  ' })
      .expect(200);
    expect(renamed.body.name).toBe('Nama baru');
    expect(renamed.body.notificationsEnabled).toBe(false);
    const cleared = await request(server)
      .patch('/api/portal/me/profile')
      .set('Authorization', auth)
      .send({ phone: '', notificationsEnabled: true })
      .expect(200);
    expect(cleared.body.phone).toBe('');
    expect(cleared.body.notificationsEnabled).toBe(true);
    for (const fullname of ['', '   ', null])
      await request(server)
        .patch('/api/portal/me/profile')
        .set('Authorization', auth)
        .send({ fullname })
        .expect(400);
  });
});
