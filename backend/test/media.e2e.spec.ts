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

describe('Media (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer() as App;
    admin = await adminToken(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function uploadAs(token: string): Promise<number> {
    const res = await request(server)
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello-world'), {
        filename: 'hello.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    return res.body.id as number;
  }

  describe('POST /media/upload', () => {
    it('uploads a file for a caller with media.create', async () => {
      const res = await request(server)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${admin}`)
        .attach('file', Buffer.from('hello-world'), {
          filename: 'hello.txt',
          contentType: 'text/plain',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.url).toContain(`/api/media/${res.body.id}/view`);
    });

    it('forbids upload without media.create with 403', async () => {
      const user = await createUser(ctx, {
        email: 'nomedia@b.com',
        permissionNames: ['media.read'],
      });
      await request(server)
        .post('/api/media/upload')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .attach('file', Buffer.from('x'), { filename: 'x.txt' })
        .expect(403);
    });

    it('rejects an unauthenticated upload with 401', async () => {
      await request(server)
        .post('/api/media/upload')
        .attach('file', Buffer.from('x'), { filename: 'x.txt' })
        .expect(401);
    });
  });

  describe('GET /media/:id', () => {
    it('lets the owner read their own media', async () => {
      const owner = await createUser(ctx, {
        email: 'owner-m@b.com',
        permissionNames: ['media.create', 'media.read'],
      });
      const ownerToken = tokenFor(ctx, owner.id, owner.email);
      const id = await uploadAs(ownerToken);

      await request(server)
        .get(`/api/media/${id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('forbids a non-owner without read_all with 403', async () => {
      const owner = await createUser(ctx, {
        email: 'owner-m@b.com',
        permissionNames: ['media.create', 'media.read'],
      });
      const stranger = await createUser(ctx, {
        email: 'stranger@b.com',
        permissionNames: ['media.read'],
      });
      const id = await uploadAs(tokenFor(ctx, owner.id, owner.email));

      await request(server)
        .get(`/api/media/${id}`)
        .set(
          'Authorization',
          `Bearer ${tokenFor(ctx, stranger.id, stranger.email)}`,
        )
        .expect(403);
    });

    it('returns 404 for a missing media (admin)', async () => {
      await request(server)
        .get('/api/media/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });

  describe('GET /media/:id/view (public)', () => {
    it('redirects to a Depot signed URL without authentication', async () => {
      const id = await uploadAs(admin);

      const res = await request(server)
        .get(`/api/media/${id}/view`)
        .expect(302);

      expect(res.headers['location']).toContain('depot.test/signed/');
    });
  });

  describe('GET /media/:id/stream', () => {
    it('forbids a non-owner from streaming with 403', async () => {
      const owner = await createUser(ctx, {
        email: 'owner-s@b.com',
        permissionNames: ['media.create', 'media.read'],
      });
      const stranger = await createUser(ctx, {
        email: 'stranger-s@b.com',
        permissionNames: ['media.read'],
      });
      const id = await uploadAs(tokenFor(ctx, owner.id, owner.email));

      await request(server)
        .get(`/api/media/${id}/stream`)
        .set(
          'Authorization',
          `Bearer ${tokenFor(ctx, stranger.id, stranger.email)}`,
        )
        .expect(403);
    });
  });

  describe('DELETE /media/:id', () => {
    it('lets an admin delete any media', async () => {
      const id = await uploadAs(admin);
      await request(server)
        .delete(`/api/media/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('forbids a non-owner from deleting with 403', async () => {
      const owner = await createUser(ctx, {
        email: 'owner-d@b.com',
        permissionNames: ['media.create', 'media.read', 'media.delete'],
      });
      const stranger = await createUser(ctx, {
        email: 'stranger-d@b.com',
        permissionNames: ['media.delete'],
      });
      const id = await uploadAs(tokenFor(ctx, owner.id, owner.email));

      await request(server)
        .delete(`/api/media/${id}`)
        .set(
          'Authorization',
          `Bearer ${tokenFor(ctx, stranger.id, stranger.email)}`,
        )
        .expect(403);
    });

    it('returns 404 for a missing media', async () => {
      await request(server)
        .delete('/api/media/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });
});
