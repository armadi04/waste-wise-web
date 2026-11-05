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
import { randomUUID } from 'crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ThrottlerStorage } from '@nestjs/throttler';
import { Repository } from 'typeorm';
import { setupTestApp, type TestContext } from './utils/setup-app';
import {
  adminEmail,
  adminPassword,
  adminToken,
  createUser,
  loginViaHttp,
  tokenFor,
} from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import { generate } from 'otplib';
import { AuthService } from '@/auth/auth.service';
import { PasswordResetToken } from '@/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '@/auth/entities/email-verification-token.entity';
import { TwoFactorService } from '@/auth/two-factor.service';
import { User } from '@/users/entities/user.entity';

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  let server: App;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer();
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
    // Route budgets (e.g. 5/min on /auth/mobile/2fa/verify) persist in memory
    // across cases; clear them so each case starts with a full budget.
    resetThrottleStorage();
  });

  function resetThrottleStorage(): void {
    ctx.moduleRef.get(ThrottlerStorage, { strict: false }).storage.clear();
  }

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /auth/login', () => {
    it('logs the admin in and sets auth cookies', async () => {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail(), password: adminPassword() })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('csrfToken='))).toBe(true);
    });

    it('rejects a wrong password with 401', async () => {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail(), password: 'wrong-password' })
        .expect(401);
    });

    it('rejects a malformed email with 400', async () => {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'whatever' })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token with a valid refresh + CSRF pair', async () => {
      const { cookies, csrfToken } = await loginViaHttp(
        ctx,
        adminEmail(),
        adminPassword(),
      );

      const res = await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
    });

    it('rejects when the CSRF token is missing with 403', async () => {
      const { cookies } = await loginViaHttp(
        ctx,
        adminEmail(),
        adminPassword(),
      );

      await request(server)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies)
        .expect(403);
    });
  });

  describe('POST /auth/logout', () => {
    it('blacklists the access token so it can no longer be used', async () => {
      const { accessToken, cookies, csrfToken } = await loginViaHttp(
        ctx,
        adminEmail(),
        adminPassword(),
      );

      await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .expect(201);

      await request(server)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });

    it('rejects logout without a CSRF token with 403', async () => {
      const { accessToken } = await loginViaHttp(
        ctx,
        adminEmail(),
        adminPassword(),
      );

      await request(server)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });

  describe('GET /auth/profile', () => {
    it('returns the current user for a valid token', async () => {
      const token = await adminToken(ctx);

      const res = await request(server)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe(adminEmail());
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(server).get('/api/v1/auth/profile').expect(401);
    });

    it('stays reachable for an unverified user (guarded by raw AuthGuard)', async () => {
      // /auth/profile uses AuthGuard('jwt') directly — not the email-verifying
      // JwtAuthGuard — so it must remain accessible before verification.
      const user = await createUser(ctx, {
        email: 'unverified@b.com',
        verified: false,
      });
      const token = tokenFor(ctx, user.id, user.email);

      await request(server)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the session identity for a valid token', async () => {
      const token = await adminToken(ctx);

      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe(adminEmail());
      expect(res.body.userId).toBeGreaterThan(0);
    });

    // Regression: the route once lost its @UseGuards when a new endpoint was
    // inserted between its decorators and its handler, so it answered 200 with
    // an empty body and the SPA never learned who it was talking to.
    it('rejects an unauthenticated request with 401', async () => {
      await request(server).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('POST /auth/switch-role', () => {
    // The CSRF middleware only requires cookie and header to agree, and
    // JwtStrategy re-derives the principal from the DB — so minting a token
    // avoids spending the throttled /auth/login budget on each case.
    const csrf = 'test-csrf-token';

    const identityFor = async (token: string) => {
      const res = await request(server)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      return res.body as {
        roles: string[];
        permissions: string[];
        activeRole?: string;
      };
    };

    it('grants no role permissions until a multi-role user picks one', async () => {
      const user = await createUser(ctx, {
        email: 'multi@b.com',
        roleNames: ['superadmin', 'user'],
      });

      const identity = await identityFor(tokenFor(ctx, user.id, user.email));

      expect(identity.roles).toEqual([]);
      expect(identity.activeRole).toBeUndefined();
      expect(identity.permissions).toEqual([]);
    });

    it('scopes the session to the chosen role', async () => {
      const user = await createUser(ctx, {
        email: 'switcher@b.com',
        roleNames: ['superadmin', 'user'],
      });

      const res = await request(server)
        .post('/api/v1/auth/switch-role')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .set('Cookie', [`csrfToken=${csrf}`])
        .set('X-CSRF-Token', csrf)
        .send({ role: 'user' })
        .expect(201);

      const identity = await identityFor(res.body.accessToken as string);

      expect(identity.activeRole).toBe('user');
      expect(identity.roles).toEqual(['user']);
      expect(identity.permissions.length).toBeGreaterThan(0);
    });

    it('rejects a role the user does not hold with 403', async () => {
      const user = await createUser(ctx, {
        email: 'norole@b.com',
        roleNames: ['user'],
      });

      await request(server)
        .post('/api/v1/auth/switch-role')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .set('Cookie', [`csrfToken=${csrf}`])
        .set('X-CSRF-Token', csrf)
        .send({ role: 'superadmin' })
        .expect(403);
    });

    it('rejects a request without the CSRF header with 403', async () => {
      const user = await createUser(ctx, {
        email: 'nocsrf@b.com',
        roleNames: ['superadmin', 'user'],
      });

      await request(server)
        .post('/api/v1/auth/switch-role')
        .set('Authorization', `Bearer ${tokenFor(ctx, user.id, user.email)}`)
        .set('Cookie', [`csrfToken=${csrf}`])
        .send({ role: 'user' })
        .expect(403);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('returns a generic message and mails a known address', async () => {
      const res = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: adminEmail() })
        .expect(201);

      expect(res.body.message).toContain('If an account');
      expect(ctx.mail.sendPasswordReset).toHaveBeenCalled();
    });

    it('rejects a malformed email with 400', async () => {
      await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nope' })
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('resets the password for a valid token', async () => {
      const user = await createUser(ctx, { email: 'resettable@b.com' });
      const repo = ctx.app.get<Repository<PasswordResetToken>>(
        getRepositoryToken(PasswordResetToken),
      );
      const token = randomUUID();
      await repo.save(
        repo.create({
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );

      await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token, password: 'brand-new-pass' })
        .expect(201);

      await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'resettable@b.com', password: 'brand-new-pass' })
        .expect(201);
    });

    it('rejects an unknown token with 400', async () => {
      await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token: randomUUID(), password: 'brand-new-pass' })
        .expect(400);
    });

    it('rejects a non-UUID token with 400', async () => {
      await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'not-a-uuid', password: 'brand-new-pass' })
        .expect(400);
    });
  });

  describe('GET /auth/verify-email', () => {
    it('verifies the email for a valid token', async () => {
      const user = await createUser(ctx, {
        email: 'toverify@b.com',
        verified: false,
      });
      const repo = ctx.app.get<Repository<EmailVerificationToken>>(
        getRepositoryToken(EmailVerificationToken),
      );
      const token = 'verify-token-123';
      await repo.save(
        repo.create({
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      );

      await request(server)
        .get(`/api/v1/auth/verify-email?token=${token}`)
        .expect(200);

      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      const refreshed = await userRepo.findOneByOrFail({ id: user.id });
      expect(refreshed.emailVerifiedAt).toBeTruthy();
    });

    it('returns 404 when the token is missing', async () => {
      await request(server).get('/api/v1/auth/verify-email').expect(404);
    });

    it('returns 404 for an unknown token', async () => {
      await request(server)
        .get('/api/v1/auth/verify-email?token=does-not-exist')
        .expect(404);
    });
  });

  describe('POST /auth/mobile/2fa/verify', () => {
    const enableTwoFactor = async (email: string) => {
      const user = await createUser(ctx, { email });
      const twoFactor = ctx.app.get(TwoFactorService);
      const authService = ctx.app.get(AuthService);

      const enrollment = await twoFactor.startEnrollment(user.id);
      const code = await generate({ secret: enrollment.secret });
      const recoveryCodes = await twoFactor.confirm(user.id, code);

      return {
        user,
        recoveryCodes,
        challengeToken: authService.issueTwoFactorChallenge(user),
      };
    };

    it('returns a mobile token pair for a valid challenge and code', async () => {
      const { challengeToken, recoveryCodes } =
        await enableTwoFactor('mobile-2fa@b.com');

      const res = await request(server)
        .post('/api/v1/auth/mobile/2fa/verify')
        .send({ challengeToken, code: recoveryCodes[0] })
        .expect(200);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.refreshToken).toBeTruthy();
      expect(res.body.sessionExpiresAt).toBeTruthy();
    });

    it('rejects a wrong code with a structured error', async () => {
      const { challengeToken } = await enableTwoFactor('mobile-bad-code@b.com');

      const res = await request(server)
        .post('/api/v1/auth/mobile/2fa/verify')
        .send({ challengeToken, code: '000000' })
        .expect(401);

      expect(res.body.code).toBe('TWO_FACTOR_INVALID_CODE');
    });

    it('rejects an expired challenge with a structured error', async () => {
      const res = await request(server)
        .post('/api/v1/auth/mobile/2fa/verify')
        .send({ challengeToken: 'not-a-challenge', code: '000000' })
        .expect(401);

      expect(res.body.code).toBe('TWO_FACTOR_CHALLENGE_EXPIRED');
    });

    it('rejects a locked account with a structured error', async () => {
      const { challengeToken } = await enableTwoFactor('mobile-locked@b.com');

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(server)
          .post('/api/v1/auth/mobile/2fa/verify')
          .send({ challengeToken, code: '000000' })
          .expect(401);
      }

      // The loop above already spent the 5/min route budget; clear it so the
      // final request reaches the lockout check instead of being throttled.
      resetThrottleStorage();

      const res = await request(server)
        .post('/api/v1/auth/mobile/2fa/verify')
        .send({ challengeToken, code: '000000' })
        .expect(403);

      expect(res.body.code).toBe('ACCOUNT_LOCKED');
    });

    it('rejects an inactive account with a structured error', async () => {
      const { user, challengeToken, recoveryCodes } = await enableTwoFactor(
        'mobile-inactive@b.com',
      );
      const userRepo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
      await userRepo.update(user.id, { isActive: false });

      const res = await request(server)
        .post('/api/v1/auth/mobile/2fa/verify')
        .send({ challengeToken, code: recoveryCodes[0] })
        .expect(403);

      expect(res.body.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('POST /auth/google', () => {
    it('rejects an invalid Google token with 401', async () => {
      await request(server)
        .post('/api/v1/auth/google')
        .send({ token: 'invalid-google-id-token' })
        .expect(401);
    });
  });
});
