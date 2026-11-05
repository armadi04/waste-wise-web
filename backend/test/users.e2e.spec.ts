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
import { User } from '@/users/entities/user.entity';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { createdInRange } from '@/common/helpers/created-in-range';

describe('Users (e2e)', () => {
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

  describe('GET /users', () => {
    it('lists users for a caller with users.read', async () => {
      await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('forbids a caller without users.read with 403', async () => {
      const user = await createUser(ctx, { email: 'noperm@b.com' });
      await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(server).get('/api/v1/users').expect(401);
    });
  });

  describe('registration filters', () => {
    it('combines search, date and method; export includes all matching rows', async () => {
      const repo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const from = createdInRange('today')!.from;
      const fixtures = [
        {
          email: 'filter-first@example.test',
          fullname: 'Filter Alice',
          registerMethod: RegisterMethodEnum.EMAIL_OTP,
          createdAt: from,
        },
        {
          email: 'filter-second@example.test',
          fullname: 'Filter Bob',
          registerMethod: RegisterMethodEnum.EMAIL_OTP,
          createdAt: new Date(from.getTime() + 1000),
        },
        {
          email: 'filter-google@example.test',
          fullname: 'Filter Google',
          registerMethod: RegisterMethodEnum.GOOGLE,
          createdAt: from,
        },
        {
          email: 'filter-old@example.test',
          fullname: 'Filter Old',
          registerMethod: RegisterMethodEnum.EMAIL_OTP,
          createdAt: new Date(from.getTime() - 1),
        },
        {
          email: 'filter-future@example.test',
          fullname: 'Filter Future',
          registerMethod: RegisterMethodEnum.EMAIL_OTP,
          createdAt: new Date(Date.now() + 86400000),
        },
      ];
      for (const fixture of fixtures) {
        await repo.save(repo.create({ ...fixture, password: 'fixture-hash' }));
      }
      const filters = {
        search: 'Filter',
        createdIn: 'today',
        registerMethod: 'EMAIL_OTP',
        sort: 'email',
        direction: 'asc',
      };
      const result = await request(server)
        .get('/api/v1/users')
        .query({ ...filters, paginated: true, limit: 1, page: 2 })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(result.body.meta).toEqual({ total: 2, page: 2, lastPage: 2 });
      expect(result.body.data.map((user: User) => user.email)).toEqual([
        'filter-second@example.test',
      ]);
      const exported = await request(server)
        .get('/api/v1/users')
        .query({ ...filters, paginated: false })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(exported.body.map((user: User) => user.email)).toEqual([
        'filter-first@example.test',
        'filter-second@example.test',
      ]);
      expect(
        exported.body.every(
          (user: User) => user.registerMethod === RegisterMethodEnum.EMAIL_OTP,
        ),
      ).toBe(true);
      await repo.softDelete({ email: 'filter-first@example.test' });
      const afterDelete = await request(server)
        .get('/api/v1/users')
        .query({ ...filters, paginated: false, direction: 'desc' })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(afterDelete.body).toHaveLength(1);
    });

    it('rejects unsupported filter values', async () => {
      for (const query of [
        { createdIn: 'invalid' },
        { registerMethod: 'PASSWORD' },
      ]) {
        await request(server)
          .get('/api/v1/users')
          .query(query)
          .set('Authorization', `Bearer ${admin}`)
          .expect(400);
      }
    });

    it('keeps registration method during profile/password updates', async () => {
      const user = await createUser(ctx, { email: 'provenance@example.test' });
      const repo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      await repo.update(user.id, {
        registerMethod: RegisterMethodEnum.EMAIL_OTP,
      });
      await request(server)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .field('fullname', 'Updated')
        .field('password', 'new-password')
        .field('registerMethod', 'GOOGLE')
        .expect(200);
      expect((await repo.findOneByOrFail({ id: user.id })).registerMethod).toBe(
        RegisterMethodEnum.EMAIL_OTP,
      );
    });
  });

  describe('GET /users/:id', () => {
    it('lets a user read their own record (owner) without users.read', async () => {
      const user = await createUser(ctx, { email: 'owner@b.com' });
      await request(server)
        .get(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(200);
    });

    it('forbids reading another user without users.read with 403', async () => {
      const user = await createUser(ctx, { email: 'owner@b.com' });
      const other = await createUser(ctx, { email: 'other@b.com' });
      await request(server)
        .get(`/api/v1/users/${other.id}`)
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });

    it('returns 404 for a missing user (admin)', async () => {
      await request(server)
        .get('/api/v1/users/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });

  describe('PATCH /users/:id', () => {
    it('lets an admin update a user', async () => {
      const user = await createUser(ctx, { email: 'patch@b.com' });
      const res = await request(server)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .field('fullname', 'Patched Name')
        .expect(200);

      expect(res.body.fullname).toBe('Patched Name');
    });

    it('strips role changes when a non-admin updates themselves', async () => {
      const roleRepo = ctx.app.get<Repository<Role>>(getRepositoryToken(Role));
      const userRole = await roleRepo.findOneByOrFail({ name: 'user' });
      const user = await createUser(ctx, { email: 'selfpatch@b.com' });

      await request(server)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .field('fullname', 'Self Name')
        .field('roleIds[]', String(userRole.id))
        .expect(200);

      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const refreshed = await userRepo.findOneOrFail({
        where: { id: user.id },
        relations: { roles: true },
      });
      expect(refreshed.roles).toHaveLength(0);
    });

    it('rejects an invalid email with 400', async () => {
      const user = await createUser(ctx, { email: 'patch@b.com' });
      await request(server)
        .patch(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .field('email', 'not-an-email')
        .expect(400);
    });
  });

  describe('DELETE /users/:id', () => {
    it('lets an admin delete a user', async () => {
      const user = await createUser(ctx, { email: 'todelete@b.com' });
      await request(server)
        .delete(`/api/v1/users/${user.id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
    });

    it('forbids deletion without users.delete with 403', async () => {
      const actor = await createUser(ctx, { email: 'actor@b.com' });
      const victim = await createUser(ctx, { email: 'victim@b.com' });
      await request(server)
        .delete(`/api/v1/users/${victim.id}`)
        .set('Authorization', `Bearer ${tokenFor(ctx, actor.id, actor.email)}`)
        .expect(403);
    });

    it('returns 404 for a missing user', async () => {
      await request(server)
        .delete('/api/v1/users/999999')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });
  });

  describe('account status', () => {
    it('exposes active, unverified and locked states', async () => {
      const active = await createUser(ctx, { email: 'active@b.com' });
      const unverified = await createUser(ctx, {
        email: 'unverified-status@b.com',
        verified: false,
      });
      const locked = await createUser(ctx, { email: 'locked@b.com' });
      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      await userRepo.update(locked.id, {
        lockedUntil: new Date(Date.now() + 60_000),
      });

      const res = await request(server)
        .get('/api/v1/users')
        .query({ paginated: false })
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      const byEmail = new Map(
        (res.body as Array<User>).map((user) => [
          user.email,
          user.accountStatus,
        ]),
      );
      expect(byEmail.get(active.email)).toBe('ACTIVE');
      expect(byEmail.get(unverified.email)).toBe('UNVERIFIED');
      expect(byEmail.get(locked.email)).toBe('LOCKED');
    });
  });

  describe('role & permission management', () => {
    it('syncs roles for a user (users.manage_roles)', async () => {
      const roleRepo = ctx.app.get<Repository<Role>>(getRepositoryToken(Role));
      const userRole = await roleRepo.findOneByOrFail({ name: 'user' });
      const user = await createUser(ctx, { email: 'syncrole@b.com' });

      await request(server)
        .post(`/api/v1/users/${user.id}/roles/sync`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ roles: [userRole.id] })
        .expect(201);

      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const refreshed = await userRepo.findOneOrFail({
        where: { id: user.id },
        relations: { roles: true },
      });
      expect(refreshed.roles.map((r) => r.id)).toContain(userRole.id);
    });

    it('forbids role management without the permission with 403', async () => {
      const actor = await createUser(ctx, { email: 'actor2@b.com' });
      const user = await createUser(ctx, { email: 'target@b.com' });
      await request(server)
        .post(`/api/v1/users/${user.id}/roles/sync`)
        .set('Authorization', `Bearer ${tokenFor(ctx, actor.id, actor.email)}`)
        .send({ roles: [] })
        .expect(403);
    });

    it('syncs permissions for a user (users.manage_permissions)', async () => {
      const permRepo = ctx.app.get<Repository<Permission>>(
        getRepositoryToken(Permission),
      );
      const perm = await permRepo.findOneByOrFail({ name: 'media.read' });
      const user = await createUser(ctx, { email: 'syncperm@b.com' });

      await request(server)
        .post(`/api/v1/users/${user.id}/permissions/sync`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ permissions: [perm.id] })
        .expect(201);

      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const refreshed = await userRepo.findOneOrFail({
        where: { id: user.id },
        relations: { permissions: true },
      });
      expect(refreshed.permissions.map((p) => p.id)).toContain(perm.id);
    });

    it('rejects a malformed roles payload with 400', async () => {
      const user = await createUser(ctx, { email: 'badpayload@b.com' });
      await request(server)
        .post(`/api/v1/users/${user.id}/roles/sync`)
        .set('Authorization', `Bearer ${admin}`)
        .send({ roles: ['not-a-number'] })
        .expect(400);
    });
  });
});
