import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  spyOn,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { MediaService } from '@/media/media.service';

import sharp from 'sharp';
import { DepotError } from '@univstekom/depot-sdk';
import { UsersService } from '@/users/users.service';
import { Media } from '@/media/entities/media.entity';
import { AvatarCleanupService } from '@/media/avatar-cleanup.service';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { CacheService } from '@/common/cache/cache.service';
import { AddAvatarCleanupState1790848800000 } from '@/database/migrations/1790848800000-AddAvatarCleanupState';

let jpeg: Buffer;
describe('Customer profile avatar (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  beforeAll(async () => {
    jpeg = await sharp({
      create: { width: 80, height: 60, channels: 3, background: '#123456' },
    })
      .jpeg()
      .toBuffer();
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    await adminToken(ctx);
  });
  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  async function customer(email = 'photo@example.test') {
    const user = await createUser(ctx, { email });
    return { user, token: tokenFor(ctx, user.id, user.email) };
  }
  it('uploads without admin permissions, uses the session owner and persists the photo', async () => {
    const owner = await customer();
    const other = await customer('other-photo@example.test');
    const res = await request(server)
      .post('/api/portal/me/profile/avatar')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('userId', other.user.id)
      .attach('avatar', jpeg, {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);
    expect(res.body.id).toBe(owner.user.id);
    expect(res.body.avatarUrl).toContain('/api/media/');
    const saved = await request(server)
      .get('/api/portal/me/profile')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(saved.body.avatarUrl).toBe(res.body.avatarUrl);
    const untouched = await request(server)
      .get('/api/portal/me/profile')
      .set('Authorization', `Bearer ${other.token}`)
      .expect(200);
    expect(untouched.body.avatarUrl).toBeNull();
  });
  it('requires authentication', async () => {
    await request(server)
      .post('/api/portal/me/profile/avatar')
      .attach('avatar', jpeg, 'avatar.jpg')
      .expect(401);
  });
  it('rejects missing files and disguised non-images', async () => {
    const { token } = await customer();
    await request(server)
      .post('/api/portal/me/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    await request(server)
      .post('/api/portal/me/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('not a jpeg'), {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);
  });
  it('rejects files over 1 MiB', async () => {
    const { token } = await customer();
    await request(server)
      .post('/api/portal/me/profile/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.alloc(1024 * 1024 + 1), {
        filename: 'avatar.jpg',
        contentType: 'image/jpeg',
      })
      .expect(413);
  });
  it('keeps the previous profile when storage fails', async () => {
    const { token } = await customer();
    const storage = spyOn(
      ctx.app.get(MediaService),
      'putAvatarBytes',
    ).mockRejectedValueOnce(new Error('Storage unavailable'));
    try {
      await request(server)
        .post('/api/portal/me/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', jpeg, {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(500);
      const profile = await request(server)
        .get('/api/portal/me/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(profile.body.avatarUrl).toBeNull();
    } finally {
      storage.mockRestore();
    }
  });
  const photoFile = (buffer: Buffer) =>
    ({
      buffer,
      size: buffer.length,
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
    }) as Express.Multer.File;
  async function upload(userId: number, buffer = jpeg) {
    await ctx.app.get(PortalAvatarService).upload(userId, photoFile(buffer));
    return ctx.dataSource
      .getRepository(Media)
      .find({ where: { userId }, order: { id: 'ASC' } });
  }
  it('normalizes dimensions and removes metadata before storage', async () => {
    const { user } = await customer();
    const source = await sharp(jpeg)
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const put = spyOn(ctx.app.get(MediaService), 'putAvatarBytes');
    try {
      await upload(user.id, source);
      const output = await sharp(put.mock.calls[0][1]).metadata();
      expect([output.width, output.height, output.format]).toEqual([
        512,
        512,
        'jpeg',
      ]);
      expect(output.exif).toBeUndefined();
      expect(output.orientation).toBeUndefined();
    } finally {
      put.mockRestore();
    }
  });
  it('rejects corrupt JPEGs and images exceeding the decoded pixel limit', async () => {
    const { token } = await customer();
    const huge = await sharp({
      create: { width: 4100, height: 4100, channels: 3, background: '#123456' },
    })
      .jpeg()
      .toBuffer();
    expect(huge.length).toBeLessThan(1024 * 1024);
    for (const buffer of [jpeg.subarray(0, 50), huge]) {
      await request(server)
        .post('/api/portal/me/profile/avatar')
        .set('Authorization', `Bearer ${token}`)
        .attach('avatar', buffer, {
          filename: 'avatar.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    }
    expect(await ctx.dataSource.getRepository(Media).count()).toBe(0);
  });
  it('retires replaced avatars while preserving the current photo and legacy uploads', async () => {
    const { user } = await customer();
    const repo = ctx.dataSource.getRepository(Media);
    const legacy = await repo.save(
      repo.create({
        filename: 'admin.jpg',
        mimetype: 'image/jpeg',
        userId: user.id,
        cleanupAt: new Date(0),
      }),
    );
    await upload(user.id);
    const [first, second] = (await upload(user.id)).filter(
      (row) => row.managedAvatar,
    );
    expect(first.cleanupAt).not.toBeNull();
    expect(second.cleanupAt).toBeNull();
    await ctx.app.get(AvatarCleanupService).dispatchPending();
    expect(await repo.findOneBy({ id: first.id })).toBeNull();
    expect(await repo.findOneBy({ id: second.id })).not.toBeNull();
    expect(await repo.findOneBy({ id: legacy.id })).not.toBeNull();
  });
  it('persists cleanup work on storage and account-link failures without replacing the active avatar', async () => {
    const { user } = await customer();
    const [active] = await upload(user.id);
    const put = spyOn(
      ctx.app.get(MediaService),
      'putAvatarBytes',
    ).mockRejectedValueOnce(new Error('Storage unavailable'));
    try {
      await expect(upload(user.id)).rejects.toThrow('Storage unavailable');
    } finally {
      put.mockRestore();
    }
    const transaction = spyOn(
      ctx.dataSource,
      'transaction',
    ).mockRejectedValueOnce(new Error('Link unavailable'));
    try {
      await expect(upload(user.id)).rejects.toThrow('Link unavailable');
    } finally {
      transaction.mockRestore();
    }
    const [owner] = await ctx.dataSource.query(
      'SELECT "avatarId" FROM users WHERE id = $1',
      [user.id],
    );
    expect(owner.avatarId).toBe(active.id);
    expect(await ctx.dataSource.getRepository(Media).count()).toBe(3);
    await ctx.app.get(AvatarCleanupService).dispatchPending();
    expect(await ctx.dataSource.getRepository(Media).count()).toBe(1);
  });
  it('retries remote failures using persisted leases and recovers after restart', async () => {
    const { user } = await customer();
    await upload(user.id);
    const [old] = await upload(user.id);
    const service = ctx.app.get(MediaService);
    const remove = spyOn(service, 'deleteAvatarRemote').mockRejectedValueOnce(
      new Error('Depot unavailable'),
    );
    try {
      await ctx.app.get(AvatarCleanupService).dispatchPending();
    } finally {
      remove.mockRestore();
    }
    const repo = ctx.dataSource.getRepository(Media);
    const pending = await repo.findOneByOrFail({ id: old.id });
    expect(pending.cleanupLeaseUntil).toBeNull();
    expect(pending.cleanupAt!.getTime()).toBeGreaterThan(Date.now());
    await repo.update(old.id, {
      cleanupAt: new Date(0),
      cleanupLeaseUntil: new Date(0),
    });
    const restarted = new AvatarCleanupService(
      ctx.dataSource,
      service,
      ctx.app.get(CacheService),
    );
    await restarted.dispatchPending();
    expect(await repo.findOneBy({ id: old.id })).toBeNull();
  });
  it('protects referenced photos and serializes concurrent replacements', async () => {
    const { user } = await customer();
    await Promise.all([upload(user.id), upload(user.id), upload(user.id)]);
    const repo = ctx.dataSource.getRepository(Media);
    const [owner] = await ctx.dataSource.query(
      'SELECT "avatarId" FROM users WHERE id = $1',
      [user.id],
    );
    await repo.update(owner.avatarId, { cleanupAt: new Date(0) });
    await Promise.all([
      ctx.app.get(AvatarCleanupService).dispatchPending(),
      ctx.app.get(AvatarCleanupService).dispatchPending(),
    ]);
    const remaining = await repo.find({ where: { userId: user.id } });
    expect(remaining.map((row) => row.id)).toEqual([owner.avatarId]);
    expect(remaining[0].cleanupAt).toBeNull();
  });
  it('recovers expired staging without a saved remote ID and accepts remote 404s', async () => {
    const { user } = await customer();
    const service = ctx.app.get(MediaService);
    const reserved = await service.uploadAvatar(photoFile(jpeg), user.id);
    const repo = ctx.dataSource.getRepository(Media);
    await repo.update(reserved.id, {
      depotFileId: null as unknown as number,
      cleanupAt: new Date(0),
    });
    await ctx.app.get(AvatarCleanupService).dispatchPending();
    expect(await repo.findOneBy({ id: reserved.id })).toBeNull();
    const expired = await service.uploadAvatar(photoFile(jpeg), user.id);
    const depot = (
      service as unknown as {
        depot: { delete: (id: number) => Promise<unknown> };
      }
    ).depot;
    const remove = spyOn(depot, 'delete').mockRejectedValueOnce(
      new DepotError(404, 'Not found', null),
    );
    await repo.update(expired.id, { cleanupAt: new Date(0) });
    try {
      await ctx.app.get(AvatarCleanupService).dispatchPending();
    } finally {
      remove.mockRestore();
    }
    expect(await repo.findOneBy({ id: expired.id })).toBeNull();
  });
  it('rejects reattaching managed portal photos through generic admin updates', async () => {
    const { user } = await customer();
    const other = await customer('other@example.test');
    const [photo] = await upload(user.id);
    await expect(
      ctx.app.get(UsersService).update(other.user.id, { avatarId: photo.id }),
    ).rejects.toThrow();
  });
  it('runs the cleanup migration up and down transactionally on the test database', async () => {
    const runner = ctx.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const migration = new AddAvatarCleanupState1790848800000();
      await migration.down(runner);
      expect(
        (await runner.getTable('media'))!.findColumnByName('managedAvatar'),
      ).toBeUndefined();
      await migration.up(runner);
      expect(
        (await runner.getTable('media'))!.findColumnByName('managedAvatar'),
      ).toBeDefined();
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
