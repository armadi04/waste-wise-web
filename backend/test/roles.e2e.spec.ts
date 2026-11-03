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
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { Role } from '@/roles/entities/role.entity';
import { Permission } from '@/permissions/entities/permission.entity';

describe('Roles (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer();
    admin = await adminToken(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createRole(name: string): Promise<number> {
    const res = await request(server)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${admin}`)
      .send({ name, description: 'temp' })
      .expect(201);
    return res.body.id as number;
  }

  describe('POST /roles', () => {
    it('creates a role for an admin', async () => {
      const res = await request(server)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: 'e2e-editor', description: 'Editor' })
        .expect(201);

      expect(res.body.name).toBe('e2e-editor');
    });

    it('rejects a duplicate role name with 400 (IsUnique)', async () => {
      await createRole('dup-role');
      await request(server)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: 'dup-role' })
        .expect(400);
    });

    it('rejects an invalid permissions payload with 400', async () => {
      await request(server)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${admin}`)
        .send({ name: 'bad-perms-role', permissions: ['not-a-number'] })
        .expect(400);
    });

    it('forbids creation without roles.create with 403', async () => {
      const user = await createUser(ctx, { email: 'noroles@b.com' });
      await request(server)
        .post('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .send({ name: 'nope' })
        .expect(403);
    });
  });

  describe('GET /roles', () => {
    it('lists roles for an admin', async () => {
      await request(server)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('returns a single role and 404 for a missing one', async () => {
      const id = await createRole('single-role');
      await request(server)
        .get(`/api/v1/roles/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      await request(server)
        .get('/api/v1/roles/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });

    it('forbids listing without roles.read with 403', async () => {
      const user = await createUser(ctx, { email: 'noread@b.com' });
      await request(server)
        .get('/api/v1/roles')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });
  });

  describe('PATCH /roles/:id', () => {
    it('updates a role', async () => {
      const id = await createRole('patch-role');
      const res = await request(server)
        .patch(`/api/v1/roles/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'updated' })
        .expect(200);
      expect(res.body.description).toBe('updated');
    });

    it('returns 404 for a missing role', async () => {
      await request(server)
        .patch('/api/v1/roles/999999')
        .set('Authorization', `Bearer ${admin}`)
        .send({ description: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /roles/:id', () => {
    it('deletes a role', async () => {
      const id = await createRole('delete-role');
      await request(server)
        .delete(`/api/v1/roles/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('returns 404 for a missing role', async () => {
      await request(server)
        .delete('/api/v1/roles/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });

  describe('role permission management', () => {
    it('syncs permissions onto a role', async () => {
      const id = await createRole('perm-role');
      const permRepo = ctx.app.get<Repository<Permission>>(
        getRepositoryToken(Permission),
      );
      const perm = await permRepo.findOneByOrFail({ name: 'media.read' });

      await request(server)
        .post(`/api/v1/roles/${id}/permissions/sync`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ permissions: [perm.id] })
        .expect(201);

      const roleRepo = ctx.app.get<Repository<Role>>(getRepositoryToken(Role));
      const refreshed = await roleRepo.findOneOrFail({
        where: { id },
        relations: { permissions: true },
      });
      expect(refreshed.permissions.map((p) => p.id)).toContain(perm.id);
    });

    it('forbids permission management without roles.manage_permissions', async () => {
      const id = await createRole('perm-role-2');
      const user = await createUser(ctx, { email: 'nomanage@b.com' });
      await request(server)
        .post(`/api/v1/roles/${id}/permissions/sync`)
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .send({ permissions: [] })
        .expect(403);
    });
  });
});
