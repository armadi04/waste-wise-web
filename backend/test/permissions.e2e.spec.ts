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

describe('Permissions (e2e)', () => {
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

  async function createPermission(name: string): Promise<number> {
    const res = await request(server)
      .post('/api/permissions')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name, description: 'temp' })
      .expect(201);
    return res.body.id as number;
  }

  describe('POST /permissions', () => {
    it('creates a permission for an admin', async () => {
      const res = await request(server)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: 'e2e.custom', description: 'Custom' })
        .expect(201);
      expect(res.body.name).toBe('e2e.custom');
    });

    it('rejects a duplicate permission name with 409', async () => {
      await request(server)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: 'media.read' })
        .expect(409);
    });

    it('rejects a missing name with 400', async () => {
      await request(server)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'no name' })
        .expect(400);
    });

    it('forbids creation without permissions.create with 403', async () => {
      const user = await createUser(ctx, { email: 'noperm-c@b.com' });
      await request(server)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .send({ name: 'x.y' })
        .expect(403);
    });
  });

  describe('GET /permissions', () => {
    it('lists permissions for an admin', async () => {
      await request(server)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('returns a single permission and 404 for a missing one', async () => {
      const id = await createPermission('e2e.single');
      await request(server)
        .get(`/api/permissions/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      await request(server)
        .get('/api/permissions/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });

    it('forbids listing without permissions.read with 403', async () => {
      const user = await createUser(ctx, { email: 'noperm-r@b.com' });
      await request(server)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });
  });

  describe('PATCH /permissions/:id', () => {
    it('updates a permission', async () => {
      const id = await createPermission('e2e.update');
      const res = await request(server)
        .patch(`/api/permissions/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'updated' })
        .expect(200);
      expect(res.body.description).toBe('updated');
    });

    it('returns 404 for a missing permission', async () => {
      await request(server)
        .patch('/api/permissions/999999')
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /permissions/:id', () => {
    it('deletes a permission', async () => {
      const id = await createPermission('e2e.delete');
      await request(server)
        .delete(`/api/permissions/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('returns 404 for a missing permission', async () => {
      await request(server)
        .delete('/api/permissions/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });
});
