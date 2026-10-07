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
import { adminEmail, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { PortalSavedOffer } from '@/portal/customer/entities/portal-saved-offer.entity';

describe('Saved offers (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let auth: string;
  let other: string;
  const payload = {
    targetType: 'coupon',
    targetKey: 'late-night-tasting-cocktails',
    targetName: 'Late Night Tasting & Cocktails',
    imageUrl: 'https://example.test/coupon.jpg',
  };
  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
  });
  beforeEach(async () => {
    await ctx.dataSource.getRepository(PortalSavedOffer).deleteAll();
    await cleanDatabase(ctx.dataSource, adminEmail());
    const user = await createUser(ctx, { email: 'saved@example.test' });
    const second = await createUser(ctx, { email: 'saved-other@example.test' });
    auth = `Bearer ${tokenFor(ctx, user.id, user.email)}`;
    other = `Bearer ${tokenFor(ctx, second.id, second.email)}`;
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  const save = (token = auth, changes = {}) =>
    request(server)
      .post('/api/portal/me/saved-offers')
      .set('Authorization', token)
      .send({ ...payload, ...changes });
  const list = (token = auth) =>
    request(server)
      .get('/api/portal/me/saved-offers')
      .set('Authorization', token);

  it('returns one row for concurrent and repeated saves', async () => {
    const results = await Promise.all([save(), save(), save(), save()]);
    expect(results.map((item) => item.status)).toEqual([201, 201, 201, 201]);
    expect(new Set(results.map((item) => item.body.id)).size).toBe(1);
    expect(new Set(results.map((item) => item.body.publicId)).size).toBe(1);
    expect((await list().expect(200)).body).toHaveLength(1);
    expect(
      await ctx.dataSource
        .getRepository(PortalSavedOffer)
        .count({ withDeleted: true }),
    ).toBe(1);
  });

  it('restores the same soft-deleted row and refreshes display metadata', async () => {
    const first = await save().expect(201);
    await request(server)
      .delete(`/api/portal/me/saved-offers/${first.body.id}`)
      .set('Authorization', other)
      .expect(404);
    await request(server)
      .delete(`/api/portal/me/saved-offers/${first.body.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect((await list().expect(200)).body).toHaveLength(0);
    const restored = await save(auth, {
      targetName: 'Updated title',
      imageUrl: 'https://example.test/new.jpg',
    }).expect(201);
    expect(restored.body.id).toBe(first.body.id);
    expect(restored.body.publicId).toBe(first.body.publicId);
    expect(restored.body.deletedAt).toBeNull();
    expect(restored.body.targetName).toBe('Updated title');
    expect(restored.body.imageUrl).toBe('https://example.test/new.jpg');
    expect((await list().expect(200)).body).toHaveLength(1);
    const separate = await save(other).expect(201);
    expect(separate.body.id).not.toBe(first.body.id);
    expect((await list(other).expect(200)).body).toHaveLength(1);
  });
});
