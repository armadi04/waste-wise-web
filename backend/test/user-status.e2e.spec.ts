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
import {
  adminEmail,
  adminToken,
  createUser,
  loginViaHttp,
  tokenFor,
} from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { User } from '@/users/entities/user.entity';

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('User activation (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;
  let adminId: number;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer();
    admin = await adminToken(ctx);
    const repo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
    adminId = (await repo.findOneByOrFail({ email: adminEmail() })).id;
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  function setActive(id: number, isActive: boolean, token = admin) {
    return request(server)
      .patch(`/api/v1/users/${id}/status`)
      .set(bearer(token))
      .send({ isActive });
  }

  async function waitForAudit() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await request(server)
        .get('/api/v1/audit-logs')
        .query({ action: 'user.status_updated', limit: 10 })
        .set(bearer(admin));
      if (res.status === 200 && res.body.data.length > 0) return res.body.data;
      await Bun.sleep(25);
    }
    throw new Error('user.status_updated audit event was not recorded');
  }

  it('deactivates login, refresh and existing access tokens, then reactivates login', async () => {
    const user = await createUser(ctx, {
      email: 'deactivate@test.dev',
      password: 'password123',
      roleNames: ['user'],
    });
    const session = await loginViaHttp(ctx, user.email, 'password123');
    const oldBearer = tokenFor(ctx, user.id, user.email);

    const deactivated = await setActive(user.id, false).expect(200);
    expect(deactivated.body).toMatchObject({
      isActive: false,
      accountStatus: 'INACTIVE',
    });
    expect((await waitForAudit())[0]).toMatchObject({
      action: 'user.status_updated',
      subjectType: 'user',
      subjectId: String(user.id),
      metadata: { isActive: false },
    });

    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password123' })
      .expect(403);
    await request(server)
      .get('/api/v1/reports')
      .set(bearer(oldBearer))
      .expect(401);
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', session.cookies)
      .set('x-csrf-token', session.csrfToken)
      .expect(401);

    const listed = await request(server)
      .get('/api/v1/users')
      .query({ paginated: false, search: user.email })
      .set(bearer(admin))
      .expect(200);
    expect(listed.body[0]).toMatchObject({
      id: user.id,
      isActive: false,
      accountStatus: 'INACTIVE',
    });
    const filtered = await request(server)
      .get('/api/v1/users')
      .query({ paginated: false, accountStatus: 'INACTIVE' })
      .set(bearer(admin))
      .expect(200);
    expect(filtered.body.map((item: User) => item.id)).toEqual([user.id]);

    await setActive(user.id, true).expect(200);
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'password123' })
      .expect(201);
  });

  it('refuses self-deactivation and protects superadmin accounts', async () => {
    await setActive(adminId, false).expect(403);

    const actor = await createUser(ctx, {
      email: 'status-admin@test.dev',
      permissionNames: ['users.manage_status'],
    });
    await setActive(
      adminId,
      false,
      tokenFor(ctx, actor.id, actor.email),
    ).expect(403);
  });

  it('requires users.manage_status instead of users.update', async () => {
    const target = await createUser(ctx, { email: 'target-status@test.dev' });
    const updateOnly = await createUser(ctx, {
      email: 'update-only@test.dev',
      permissionNames: ['users.update'],
    });
    await setActive(
      target.id,
      false,
      tokenFor(ctx, updateOnly.id, updateOnly.email),
    ).expect(403);

    const statusAdmin = await createUser(ctx, {
      email: 'status-capable@test.dev',
      permissionNames: ['users.manage_status'],
    });
    await setActive(
      target.id,
      false,
      tokenFor(ctx, statusAdmin.id, statusAdmin.email),
    ).expect(200);
  });
});
