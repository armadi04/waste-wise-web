import { beforeEach, describe, expect, it, jest } from 'bun:test';
import {
  ForbiddenException,
  Logger,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { PortalAvatarImportService } from '@/portal/customer/portal-avatar-import.service';
import { PortalAuthService } from '@/portal/auth/portal-auth.service';
import { PortalEmailOtpChallenge } from '@/portal/auth/entities/portal-email-otp-challenge.entity';
import { Role } from '@/roles/entities/role.entity';
import { UsersService } from '@/users/users.service';
import { AuthService } from '@/auth/auth.service';
import { SessionsService } from '@/sessions/sessions.service';
import { MailService } from '@/mail/mail.service';
import { RegisterMethodEnum } from '@/users/register-method.enum';

const customer = {
  id: 42,
  email: 'new@example.test',
  roles: [{ name: 'customer' }],
};
const context = { ipAddress: '127.0.0.1', userAgent: 'test' };

describe('PortalAuthService', () => {
  let service: PortalAuthService;
  let avatars: { enqueue: ReturnType<typeof jest.fn> };
  let users: Record<
    'findOneByEmail' | 'create' | 'findOne' | 'markEmailVerified',
    ReturnType<typeof jest.fn>
  >;
  let otp: {
    findOne: ReturnType<typeof jest.fn>;
    save: ReturnType<typeof jest.fn>;
    create: ReturnType<typeof jest.fn>;
    createQueryBuilder: ReturnType<typeof jest.fn>;
  };
  let builder: Record<string, ReturnType<typeof jest.fn>>;
  let auth: Record<
    'login' | 'assertNotLocked' | 'sessionFromTokens' | 'blacklistToken',
    ReturnType<typeof jest.fn>
  >;
  let sessions: { revokeBySessionId: ReturnType<typeof jest.fn> };
  let mail: { sendPortalOtp: ReturnType<typeof jest.fn> };
  let events: { emit: ReturnType<typeof jest.fn> };

  const build = (googleClientId?: string) =>
    new PortalAuthService(
      otp as unknown as Repository<PortalEmailOtpChallenge>,
      {
        findOneBy: jest.fn().mockResolvedValue({ id: 3 }),
      } as unknown as Repository<Role>,
      users as unknown as UsersService,
      auth as unknown as AuthService,
      sessions as unknown as SessionsService,
      mail as unknown as MailService,
      // A stub, not ConfigService: the real one also reads GOOGLE_CLIENT_ID from .env.
      { get: () => googleClientId } as unknown as ConfigService,
      avatars as unknown as PortalAvatarImportService,
      events as unknown as EventEmitter2,
    );

  const pendingChallenge = async (code = '123456') => ({
    id: 9,
    codeHash: await bcrypt.hash(code, 4),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
  });

  beforeEach(() => {
    users = {
      findOneByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 42 }),
      findOne: jest.fn().mockResolvedValue(customer),
      markEmailVerified: jest.fn(),
    };
    builder = {
      update: jest.fn(() => builder),
      set: jest.fn(() => builder),
      where: jest.fn(() => builder),
      select: jest.fn(() => builder),
      addSelect: jest.fn(() => builder),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      getRawOne: jest.fn().mockResolvedValue({ requests: 0, attempts: 0 }),
    };
    otp = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value: unknown) => value),
      createQueryBuilder: jest.fn(() => builder),
    };
    auth = {
      login: jest
        .fn()
        .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
      assertNotLocked: jest.fn(),
      sessionFromTokens: jest.fn(),
      blacklistToken: jest.fn(),
    };
    sessions = { revokeBySessionId: jest.fn() };
    mail = { sendPortalOtp: jest.fn() };
    events = { emit: jest.fn() };
    avatars = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = build('test-client');
  });

  describe('account provenance', () => {
    it('creates an EMAIL_OTP account after valid OTP verification', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      await service.verifyEmailOtp('New@Example.test', '123456', context);
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.test' }),
        { autoVerify: true, registerMethod: RegisterMethodEnum.EMAIL_OTP },
      );
    });

    it('creates a GOOGLE account after provider verification', async () => {
      const client = (
        service as unknown as {
          googleClient: { verifyIdToken: ReturnType<typeof jest.fn> };
        }
      ).googleClient;
      client.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'google@example.test',
          email_verified: true,
          name: 'Google User',
        }),
      });
      await service.loginWithGoogle('valid-token', context);
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'google@example.test' }),
        { autoVerify: true, registerMethod: RegisterMethodEnum.GOOGLE },
      );
    });

    it('keeps the original method when an existing account logs in differently', async () => {
      users.findOneByEmail.mockResolvedValue({
        id: 42,
        registerMethod: RegisterMethodEnum.INVITATION,
        emailVerifiedAt: new Date(),
      });
      users.findOne.mockResolvedValue({
        id: 42,
        registerMethod: RegisterMethodEnum.INVITATION,
      });
      const user = await service.ensurePortalUser(
        'existing@example.test',
        undefined,
        RegisterMethodEnum.EMAIL_OTP,
      );
      expect(user.registerMethod).toBe(RegisterMethodEnum.INVITATION);
      expect(users.create).not.toHaveBeenCalled();
    });

    it('does not provision a user for an invalid OTP', async () => {
      otp.findOne.mockResolvedValue(null);
      await expect(
        service.verifyEmailOtp('new@example.test', '123456', context),
      ).rejects.toThrow();
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('customer-only portal login', () => {
    it.each([
      ['an admin role', { ...customer, roles: [{ name: 'admin' }] }],
      [
        'a mixed role set',
        { ...customer, roles: [{ name: 'customer' }, { name: 'staff' }] },
      ],
      ['two-factor enabled', { ...customer, twoFactorEnabledAt: new Date() }],
    ])('refuses %s and records the attempt', async (_label, user) => {
      users.findOneByEmail.mockResolvedValue({
        ...user,
        emailVerifiedAt: new Date(),
      });
      users.findOne.mockResolvedValue(user);
      otp.findOne.mockResolvedValue(await pendingChallenge());
      await expect(
        service.verifyEmailOtp('new@example.test', '123456', context),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auth.login).not.toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'auth.login_failed' }),
      );
    });

    it('checks lockout and audits a successful customer login', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      await service.verifyEmailOtp('new@example.test', '123456', context);
      expect(auth.assertNotLocked).toHaveBeenCalledWith(customer);
      expect(events.emit).toHaveBeenCalledWith(
        'audit.record',
        expect.objectContaining({ action: 'auth.login', actorId: 42 }),
      );
    });
  });

  describe('OTP limits', () => {
    it('reserves an attempt atomically before comparing the code', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      await expect(
        service.verifyEmailOtp('new@example.test', '000000', context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(builder.set).toHaveBeenCalledWith({
        attempts: expect.any(Function),
      });
      expect(otp.save).not.toHaveBeenCalled();
    });

    it('stops guessing once the challenge has no attempts left', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      builder.execute.mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.verifyEmailOtp('new@example.test', '123456', context),
      ).rejects.toBeInstanceOf(HttpException);
      expect(auth.login).not.toHaveBeenCalled();
    });

    it('lets only one of two concurrent correct submissions sign in', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      builder.execute
        .mockResolvedValueOnce({ affected: 1 })
        .mockResolvedValueOnce({ affected: 0 });
      await expect(
        service.verifyEmailOtp('new@example.test', '123456', context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(auth.login).not.toHaveBeenCalled();
    });

    it('keeps the per-email guess budget across new codes', async () => {
      otp.findOne.mockResolvedValue(await pendingChallenge());
      builder.getRawOne.mockResolvedValue({ requests: '3', attempts: '10' });
      await expect(
        service.verifyEmailOtp('new@example.test', '123456', context),
      ).rejects.toMatchObject({ status: 429 });
      await expect(
        service.requestEmailOtp('new@example.test', '1.2.3.4'),
      ).rejects.toMatchObject({
        status: 429,
      });
      expect(mail.sendPortalOtp).not.toHaveBeenCalled();
    });

    it('caps how many codes are mailed to one address per hour', async () => {
      builder.getRawOne.mockResolvedValue({ requests: 5, attempts: 0 });
      await expect(
        service.requestEmailOtp('new@example.test', '1.2.3.4'),
      ).rejects.toMatchObject({
        status: 429,
      });
      expect(mail.sendPortalOtp).not.toHaveBeenCalled();
    });
  });

  describe('Google', () => {
    const picture = 'https://lh3.googleusercontent.com/photo';
    const verifyGoogle = (photo: string | undefined = picture) => {
      const client = (
        service as unknown as {
          googleClient: { verifyIdToken: ReturnType<typeof jest.fn> };
        }
      ).googleClient;
      client.verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: customer.email,
          email_verified: true,
          name: 'Google User',
          picture: photo,
        }),
      });
    };

    it.each([false, true])(
      'queues the photo for an empty avatar (existing: %s)',
      async (existing) => {
        verifyGoogle();
        if (existing)
          users.findOneByEmail.mockResolvedValue({
            ...customer,
            emailVerifiedAt: new Date(),
          });
        await service.loginWithGoogle('valid-token', context);
        expect(avatars.enqueue).toHaveBeenCalledWith(customer.id, picture);
        expect(users.create).toHaveBeenCalledTimes(existing ? 0 : 1);
      },
    );

    it('preserves any saved avatar', async () => {
      verifyGoogle();
      users.findOne.mockResolvedValue({ ...customer, avatar: { id: 12 } });
      await service.loginWithGoogle('valid-token', context);
      expect(avatars.enqueue).not.toHaveBeenCalled();
    });

    it('allows a payload without a photo', async () => {
      verifyGoogle('');
      await service.loginWithGoogle('valid-token', context);
      expect(avatars.enqueue).not.toHaveBeenCalled();
    });

    it('continues login and logs no provider data when enqueue fails', async () => {
      verifyGoogle();
      avatars.enqueue.mockRejectedValue(new Error(picture));
      const warning = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      try {
        expect(await service.loginWithGoogle('valid-token', context)).toEqual({
          accessToken: 'a',
          refreshToken: 'r',
        });
        expect(warning).toHaveBeenCalledWith(
          { userId: customer.id },
          'Google profile photo enqueue failed',
        );
      } finally {
        warning.mockRestore();
      }
    });

    it.each([
      { ...customer, roles: [{ name: 'admin' }] },
      { ...customer, twoFactorEnabledAt: new Date() },
    ])('does not import for a dashboard account', async (user) => {
      verifyGoogle();
      users.findOne.mockResolvedValue(user);
      await expect(
        service.loginWithGoogle('valid-token', context),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(avatars.enqueue).not.toHaveBeenCalled();
    });

    it('does not import for a locked account or a failed session', async () => {
      verifyGoogle();
      auth.assertNotLocked.mockImplementationOnce(() => {
        throw new ForbiddenException();
      });
      await expect(
        service.loginWithGoogle('valid-token', context),
      ).rejects.toThrow();
      auth.login.mockRejectedValueOnce(new Error('Session unavailable'));
      await expect(
        service.loginWithGoogle('valid-token', context),
      ).rejects.toThrow();
      expect(avatars.enqueue).not.toHaveBeenCalled();
    });
    it('fails closed without a configured client id', async () => {
      await expect(
        build().loginWithGoogle('token', context),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('answers 401 instead of 500 for an invalid ID token', async () => {
      const client = (
        service as unknown as {
          googleClient: { verifyIdToken: ReturnType<typeof jest.fn> };
        }
      ).googleClient;
      client.verifyIdToken = jest
        .fn()
        .mockRejectedValue(new Error('Wrong recipient'));
      await expect(
        service.loginWithGoogle('token', context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(avatars.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session behind an expired access token', async () => {
      auth.sessionFromTokens.mockImplementation(
        (tokens: Array<string | undefined>) =>
          tokens.some((token) => token === 'expired' || token === 'refresh')
            ? { userId: 42, email: 'a@b.test', sessionId: 'sess-1' }
            : null,
      );
      await service.logout('expired', 'refresh');
      expect(sessions.revokeBySessionId).toHaveBeenCalledWith('sess-1');
      expect(auth.blacklistToken).toHaveBeenCalledWith('expired');
      expect(auth.blacklistToken).toHaveBeenCalledWith('refresh');
    });

    it('never records unsigned strings in the blacklist', async () => {
      auth.sessionFromTokens.mockReturnValue(null);
      await service.logout('garbage', undefined);
      expect(auth.blacklistToken).not.toHaveBeenCalled();
      expect(sessions.revokeBySessionId).not.toHaveBeenCalled();
    });
  });
});
