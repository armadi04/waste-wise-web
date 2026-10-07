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
import { User } from '@/users/entities/user.entity';
import { Invitation } from '@/invitations/entities/invitation.entity';

describe('Invitations (e2e)', () => {
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

  async function invite(email: string): Promise<{ id: number; token: string }> {
    const res = await request(server)
      .post('/api/invitations')
      .set('Authorization', `Bearer ${admin}`)
      .send({ email })
      .expect(201);
    return {
      id: res.body.invitation.id as number,
      token: res.body.invitation.token as string,
    };
  }

  describe('POST /invitations', () => {
    it('creates and "sends" an invitation', async () => {
      const res = await request(server)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .send({ email: 'invitee@b.com' })
        .expect(201);

      expect(res.body.inviteUrl).toContain('token=');
      expect(ctx.mail.sendInvitationEmail).toHaveBeenCalled();
    });

    it('rejects inviting an existing user with 409', async () => {
      await createUser(ctx, { email: 'existing@b.com' });
      await request(server)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .send({ email: 'existing@b.com' })
        .expect(409);
    });

    it('rejects a malformed email with 400', async () => {
      await request(server)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });

    it('forbids inviting without users.invite with 403', async () => {
      const user = await createUser(ctx, { email: 'noinvite@b.com' });
      await request(server)
        .post('/api/invitations')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .send({ email: 'x@b.com' })
        .expect(403);
    });
  });

  describe('GET /invitations', () => {
    it('lists invitations for an authorized admin', async () => {
      await invite('listed@b.com');
      const res = await request(server)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('forbids listing without users.invite with 403', async () => {
      const user = await createUser(ctx, { email: 'nolist@b.com' });
      await request(server)
        .get('/api/invitations')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .expect(403);
    });
  });

  describe('POST /invitations/:id/resend & DELETE /invitations/:id', () => {
    it('resends an invitation', async () => {
      const { id } = await invite('resend@b.com');
      await request(server)
        .post(`/api/invitations/${id}/resend`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(201);
    });

    it('returns 404 when resending a missing invitation', async () => {
      await request(server)
        .post('/api/invitations/999999/resend')
        .set('Authorization', `Bearer ${admin}`)
        .expect(404);
    });

    it('revokes an invitation', async () => {
      const { id } = await invite('revoke@b.com');
      const res = await request(server)
        .delete(`/api/invitations/${id}`)
        .set('Authorization', `Bearer ${admin}`)
        .expect(200);
      expect(res.body.message).toBeDefined();

      const invitationRepo = ctx.app.get<Repository<Invitation>>(
        getRepositoryToken(Invitation),
      );
      const revoked = await invitationRepo
        .createQueryBuilder('invitation')
        .withDeleted()
        .where('invitation.id = :id', { id })
        .getOneOrFail();
      expect(revoked.deletedAt).toBeInstanceOf(Date);

      await request(server)
        .get(`/api/invitations/accept?token=${revoked.token}`)
        .expect(400);
    });
  });

  describe('invitation acceptance (public)', () => {
    it('resolves the invitee email by token', async () => {
      const { token } = await invite('accept-prefill@b.com');
      const res = await request(server)
        .get(`/api/invitations/accept?token=${token}`)
        .expect(200);
      expect(res.body.email).toBe('accept-prefill@b.com');
    });

    it('returns 404 when the token query param is missing', async () => {
      await request(server).get('/api/invitations/accept').expect(404);
    });

    it('rejects an invalid token with 400', async () => {
      await request(server)
        .get('/api/invitations/accept?token=does-not-exist')
        .expect(400);
    });

    it('accepts an invitation and creates a verified account', async () => {
      const { token } = await invite('newaccount@b.com');

      await request(server)
        .post('/api/invitations/accept')
        .send({ token, password: 'password123', fullname: 'New Account' })
        .expect(201);

      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const created = await userRepo.findOneByOrFail({
        email: 'newaccount@b.com',
      });
      expect(created.emailVerifiedAt).toBeTruthy();
    });

    it('rejects acceptance with a too-short password with 400', async () => {
      const { token } = await invite('shortpw@b.com');
      await request(server)
        .post('/api/invitations/accept')
        .send({ token, password: '123' })
        .expect(400);
    });
  });
});
