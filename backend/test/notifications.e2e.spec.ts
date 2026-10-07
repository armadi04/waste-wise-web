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
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { Notification } from '@/notifications/entities/notification.entity';

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let server: App;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function seedNotificationFor(userId: number): Promise<number> {
    const repo = ctx.app.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    const saved = await repo.save(
      repo.create({
        userId,
        title: 'Hello',
        message: 'A test notification',
      }),
    );
    return saved.id;
  }

  it('GET /notifications lists the current user notifications', async () => {
    const user = await createUser(ctx, { email: 'notif@b.com' });
    await seedNotificationFor(user.id);

    const res = await request(server)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /notifications/unread-count returns the unread total', async () => {
    const user = await createUser(ctx, { email: 'notif-count@b.com' });
    await seedNotificationFor(user.id);

    const res = await request(server)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(200);

    expect(Number(res.text)).toBe(1);
  });

  it('PATCH /notifications/:id/read marks a notification read', async () => {
    const user = await createUser(ctx, { email: 'notif-read@b.com' });
    const id = await seedNotificationFor(user.id);

    await request(server)
      .patch(`/api/notifications/${id}/read`)
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(200);

    const repo = ctx.app.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    const refreshed = await repo.findOneByOrFail({ id });
    expect(refreshed.isRead).toBe(true);
  });

  it('PATCH /notifications/:id/read returns 404 for a missing notification', async () => {
    const user = await createUser(ctx, { email: 'notif-missing@b.com' });
    await request(server)
      .patch('/api/notifications/999999/read')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(404);
  });

  it('POST /notifications/read-all marks every notification read', async () => {
    const user = await createUser(ctx, { email: 'notif-all@b.com' });
    await seedNotificationFor(user.id);
    await seedNotificationFor(user.id);

    await request(server)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(201);

    const res = await request(server)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(200);
    expect(Number(res.text)).toBe(0);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await request(server).get('/api/notifications').expect(401);
  });

  it('forbids an unverified user with 403 (JwtAuthGuard)', async () => {
    const user = await createUser(ctx, {
      email: 'notif-unverified@b.com',
      verified: false,
    });
    await request(server)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
      .expect(403);
  });
});
