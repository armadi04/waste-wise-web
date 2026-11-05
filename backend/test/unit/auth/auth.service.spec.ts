import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { describe, beforeEach, afterEach, it, expect, jest } from 'bun:test';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/auth/auth.service';
import { UsersService } from '../../../src/users/users.service';
import { MailService } from '../../../src/mail/mail.service';
import { BlacklistedToken } from '../../../src/auth/entities/blacklisted-token.entity';
import { PasswordResetToken } from '../../../src/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../../../src/auth/entities/email-verification-token.entity';
import { User } from '../../../src/users/entities/user.entity';
import { SessionsService } from '../../../src/sessions/sessions.service';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findOneByEmail: jest.Mock;
    findOrCreateGoogleUser: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    markEmailVerified: jest.Mock;
  };
  let jwtService: JwtService;
  let mailService: {
    sendPasswordReset: jest.Mock;
    sendVerificationEmail: jest.Mock;
    sendInvitationEmail: jest.Mock;
  };
  let resetTokenRepository: {
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let verificationTokenRepository: {
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let blacklistRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let blacklistInsert: Record<string, jest.Mock>;
  let userRepository: { update: jest.Mock };
  const sessionDeadline = new Date('2030-01-01T08:00:00Z');
  let sessionsService: {
    start: jest.Mock;
    isActive: jest.Mock;
    touch: jest.Mock;
    findBySessionId: jest.Mock;
    revokeBySessionId: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findOneByEmail: jest.fn(),
      findOrCreateGoogleUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      markEmailVerified: jest.fn(),
    };
    mailService = {
      sendPasswordReset: jest.fn(),
      sendVerificationEmail: jest.fn(),
      sendInvitationEmail: jest.fn(),
    };
    resetTokenRepository = {
      delete: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve(e)),
      findOneBy: jest.fn(),
    };
    verificationTokenRepository = {
      delete: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve(e)),
      findOneBy: jest.fn(),
    };
    blacklistInsert = {
      insert: jest.fn(() => blacklistInsert),
      into: jest.fn(() => blacklistInsert),
      values: jest.fn(() => blacklistInsert),
      orIgnore: jest.fn(() => blacklistInsert),
      execute: jest.fn(() => Promise.resolve({})),
    };
    blacklistRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve(e)),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(() => blacklistInsert),
    };
    userRepository = { update: jest.fn(() => Promise.resolve({})) };
    sessionsService = {
      start: jest.fn(
        (_userId: number, _context: unknown, opts?: { audience?: string }) =>
          Promise.resolve({
            sessionId: 'session-uuid',
            audience: opts?.audience ?? 'admin',
            absoluteExpiresAt: sessionDeadline,
          }),
      ),
      isActive: jest.fn(() => Promise.resolve(true)),
      touch: jest.fn((sessionId: string) =>
        Promise.resolve({
          sessionId,
          audience: 'admin',
          absoluteExpiresAt: sessionDeadline,
        }),
      ),
      findBySessionId: jest.fn(() => Promise.resolve(null)),
      revokeBySessionId: jest.fn(() => Promise.resolve()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'signed-token'), verify: jest.fn() },
        },
        {
          provide: getRepositoryToken(BlacklistedToken),
          useValue: blacklistRepository,
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: resetTokenRepository,
        },
        {
          provide: getRepositoryToken(EmailVerificationToken),
          useValue: verificationTokenRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GOOGLE_CLIENT_ID') return 'google-client-id';
              if (key === 'APP_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
        { provide: MailService, useValue: mailService },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SessionsService, useValue: sessionsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return the user without the password when credentials match', async () => {
      const hash = await bcrypt.hash('secret', 10);
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: hash,
      });

      const result = await service.validateUser('a@b.com', 'secret');

      expect(result).toBeTruthy();
      expect((result as Record<string, unknown>).password).toBeUndefined();
      expect((result as User).email).toBe('a@b.com');
    });

    it('should return null when the password is wrong', async () => {
      const hash = await bcrypt.hash('secret', 10);
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: hash,
      });

      await expect(
        service.validateUser('a@b.com', 'wrong'),
      ).resolves.toBeNull();
    });

    it('should return null when the email is unknown', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('missing@b.com', 'secret'),
      ).resolves.toBeNull();
    });

    it('should reject a correct password for an inactive account', async () => {
      const hash = await bcrypt.hash('secret', 10);
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'inactive@b.com',
        password: hash,
        isActive: false,
      });

      await expect(
        service.validateUser('inactive@b.com', 'secret'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('refuses to mint tokens for an inactive account', async () => {
      const user = {
        id: 1,
        email: 'inactive@b.com',
        isActive: false,
      } as User;

      await expect(service.login(user)).rejects.toThrow(ForbiddenException);
      expect(sessionsService.start).not.toHaveBeenCalled();
    });

    it('keeps same-second login and rotation refresh tokens distinct and usable', async () => {
      const clock = jest.spyOn(Date, 'now').mockReturnValue(1791244800000);
      try {
        const realJwt = new JwtService({
          secret: 'unit-test-secret',
          signOptions: { expiresIn: '15m' },
        });
        (jwtService.sign as jest.Mock).mockImplementation((payload, options) =>
          realJwt.sign(payload, options),
        );
        (jwtService.verify as jest.Mock).mockImplementation((token) =>
          realJwt.verify(token),
        );
        const user = {
          id: 1,
          email: 'a@b.com',
          roles: [{ name: 'admin' }],
        } as unknown as User;
        usersService.findOne.mockResolvedValue(user);
        const first = await service.login(user);
        const second = await service.login(user);
        expect(first.refreshToken).not.toBe(second.refreshToken);
        const rotated = await service.refresh(second.refreshToken);
        expect(rotated.refreshToken).not.toBe(second.refreshToken);
        expect(realJwt.verify(rotated.refreshToken).jti).toBeString();
        blacklistRepository.findOneBy.mockImplementation(({ token }) =>
          token === second.refreshToken
            ? { reason: 'rotated', invalidatedAt: new Date(Date.now()) }
            : null,
        );
        await expect(
          service.refresh(rotated.refreshToken),
        ).resolves.toHaveProperty('refreshToken');
        expect(sessionsService.revokeBySessionId).not.toHaveBeenCalled();
      } finally {
        clock.mockRestore();
      }
    });

    it('should sign compact access and refresh tokens without permission lists', async () => {
      const user = {
        id: 1,
        email: 'a@b.com',
        emailVerifiedAt: new Date(),
        permissions: [{ name: 'direct.perm' }],
        roles: [{ name: 'editor', permissions: [{ name: 'role.perm' }] }],
      } as unknown as User;

      const result = await service.login(user);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0] as {
        emailVerified: boolean;
        roles: string[];
      };
      // Permissions are reloaded per request; embedding them overflowed cookies.
      expect(payload).not.toHaveProperty('permissions');
      expect(payload.roles).toEqual(['editor']);
      expect(payload.emailVerified).toBe(true);
    });
  });

  describe('active role scoping', () => {
    const multiRoleUser = {
      id: 1,
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
      permissions: [{ name: 'direct.perm' }],
      roles: [
        { name: 'editor', permissions: [{ name: 'editor.perm' }] },
        { name: 'auditor', permissions: [{ name: 'auditor.perm' }] },
      ],
    } as unknown as User;

    const signedPayload = () =>
      (jwtService.sign as jest.Mock).mock.calls[0][0] as {
        roles: string[];
        activeRole?: string;
      };

    it('grants no role to a multi-role user who has not chosen', async () => {
      await service.login(multiRoleUser);

      const payload = signedPayload();
      expect(payload.roles).toEqual([]);
      expect(payload.activeRole).toBeUndefined();
    });

    it('scopes the token to the chosen role on switchRole', async () => {
      usersService.findOne.mockResolvedValue(multiRoleUser);

      await service.switchRole(1, 'auditor');

      const payload = signedPayload();
      expect(payload.activeRole).toBe('auditor');
      expect(payload.roles).toEqual(['auditor']);
    });

    it('rejects a role the user does not hold', async () => {
      usersService.findOne.mockResolvedValue(multiRoleUser);

      await expect(service.switchRole(1, 'superadmin')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('carries the chosen role through a refresh', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 1,
        activeRole: 'editor',
      });
      usersService.findOne.mockResolvedValue(multiRoleUser);

      await service.refresh('valid-refresh');

      const payload = signedPayload();
      expect(payload.activeRole).toBe('editor');
      expect(payload.roles).toEqual(['editor']);
    });
  });

  describe('token blacklist', () => {
    it('blacklistToken should persist the token idempotently', async () => {
      await service.blacklistToken('abc');
      expect(blacklistInsert.values).toHaveBeenCalledWith({
        token: 'abc',
        reason: 'logout',
      });
      expect(blacklistInsert.orIgnore).toHaveBeenCalled();
    });

    it('isTokenBlacklisted should reflect repository lookups', async () => {
      blacklistRepository.findOneBy.mockResolvedValue({ token: 'abc' });
      await expect(service.isTokenBlacklisted('abc')).resolves.toBe(true);

      blacklistRepository.findOneBy.mockResolvedValue(null);
      await expect(service.isTokenBlacklisted('abc')).resolves.toBe(false);
    });
  });

  describe('refresh', () => {
    it('should issue fresh tokens for a valid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: 1 });
      usersService.findOne.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        roles: [],
        permissions: [],
      });

      const result = await service.refresh('valid-refresh');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it.each(['2fa', 'user', 'client'] as const)(
      'refuses a %s token presented as a refresh token',
      async (tokenType) => {
        (jwtService.verify as jest.Mock).mockReturnValue({ sub: 1, tokenType });
        await expect(service.refresh('wrong-type')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(usersService.findOne).not.toHaveBeenCalled();
      },
    );

    it('types issued tokens so access and refresh cannot be swapped', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: 1,
        tokenType: 'refresh',
      });
      usersService.findOne.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        roles: [],
        permissions: [],
      });
      await service.refresh('typed-refresh');
      const signed = (jwtService.sign as jest.Mock).mock.calls.map(
        ([payload]) => (payload as { tokenType?: string }).tokenType,
      );
      expect(signed).toEqual(['user', 'refresh']);
    });

    describe('session lifetime policy', () => {
      const user = { id: 1, email: 'a@b.com', roles: [], permissions: [] };
      const refreshExpiresIn = () =>
        (
          (jwtService.sign as jest.Mock).mock.calls[1][1] as {
            expiresIn: number;
          }
        ).expiresIn;

      it('issues refresh tokens that live only for the audience idle window', async () => {
        await service.login(user as unknown as User);
        expect(refreshExpiresIn()).toBe(2 * 60 * 60);
        (jwtService.sign as jest.Mock).mockClear();
        await service.login(user as unknown as User, { audience: 'admin' });
        expect(sessionsService.start).toHaveBeenLastCalledWith(1, undefined, {
          audience: 'admin',
          impersonatedById: undefined,
        });
        expect(refreshExpiresIn()).toBe(2 * 60 * 60);
      });

      it('returns the session absolute deadline for cookie lifetimes', async () => {
        await expect(
          service.login(user as unknown as User),
        ).resolves.toMatchObject({
          sessionExpiresAt: sessionDeadline,
        });
      });

      it('refuses a refresh once the session passed its idle or absolute deadline', async () => {
        (jwtService.verify as jest.Mock).mockReturnValue({
          sub: 1,
          tokenType: 'refresh',
          sessionId: 'sess-1',
        });
        usersService.findOne.mockResolvedValue(user);
        sessionsService.isActive.mockResolvedValue(false);
        await expect(service.refresh('expired')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(sessionsService.touch).not.toHaveBeenCalled();
      });

      it('slides the idle deadline on refresh and keeps the absolute one', async () => {
        (jwtService.verify as jest.Mock).mockReturnValue({
          sub: 1,
          tokenType: 'refresh',
          sessionId: 'sess-1',
        });
        usersService.findOne.mockResolvedValue(user);
        const tokens = await service.refresh('valid');
        expect(sessionsService.touch).toHaveBeenCalledWith('sess-1', true);
        expect(tokens.sessionExpiresAt).toBe(sessionDeadline);
      });

      it('opens a dashboard session for tokens without a session', async () => {
        (jwtService.verify as jest.Mock).mockReturnValue({
          sub: 1,
          tokenType: 'refresh',
        });
        usersService.findOne.mockResolvedValue({
          ...user,
          roles: [{ name: 'user', permissions: [] }],
        });
        await service.refresh('legacy');
        expect(sessionsService.start).toHaveBeenCalledWith(1, undefined, {
          audience: 'admin',
        });
      });
    });

    describe('rotation', () => {
      const user = { id: 1, email: 'a@b.com', roles: [], permissions: [] };
      beforeEach(() => {
        (jwtService.verify as jest.Mock).mockReturnValue({
          sub: 1,
          email: 'a@b.com',
          tokenType: 'refresh',
          sessionId: 'sess-1',
        });
        usersService.findOne.mockResolvedValue(user);
        sessionsService.isActive.mockResolvedValue(true);
      });

      it('retires the used refresh token', async () => {
        blacklistRepository.findOneBy.mockResolvedValue(null);
        await service.refresh('first');
        expect(blacklistInsert.values).toHaveBeenCalledWith({
          token: 'first',
          reason: 'rotated',
        });
      });

      it('lets a concurrent tab spend a just-rotated token', async () => {
        blacklistRepository.findOneBy.mockResolvedValue({
          token: 'first',
          reason: 'rotated',
          invalidatedAt: new Date(Date.now() - 5_000),
        });
        await expect(service.refresh('first')).resolves.toHaveProperty(
          'refreshToken',
        );
        expect(sessionsService.revokeBySessionId).not.toHaveBeenCalled();
      });

      it('revokes the session when a rotated token is replayed after the grace window', async () => {
        blacklistRepository.findOneBy.mockResolvedValue({
          token: 'first',
          reason: 'rotated',
          invalidatedAt: new Date(Date.now() - 120_000),
        });
        await expect(service.refresh('first')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(sessionsService.revokeBySessionId).toHaveBeenCalledWith(
          'sess-1',
        );
      });

      it('rejects a token revoked at logout without touching the session', async () => {
        blacklistRepository.findOneBy.mockResolvedValue({
          token: 'first',
          reason: 'logout',
          invalidatedAt: new Date(),
        });
        await expect(service.refresh('first')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(sessionsService.revokeBySessionId).not.toHaveBeenCalled();
      });
    });

    it('identifies the session of an expired token for logout', () => {
      (jwtService.verify as jest.Mock).mockImplementation(
        (token: string, opts?: { ignoreExpiration?: boolean }) => {
          if (token === 'forged') throw new Error('bad signature');
          expect(opts?.ignoreExpiration).toBe(true);
          return token === 'challenge'
            ? { sub: 1, email: 'a@b.com', tokenType: '2fa' }
            : { sub: 1, email: 'a@b.com', sessionId: 'sess-1' };
        },
      );
      expect(
        service.sessionFromTokens(['forged', 'challenge', 'expired']),
      ).toEqual({
        userId: 1,
        email: 'a@b.com',
        sessionId: 'sess-1',
      });
      expect(service.sessionFromTokens([undefined, 'forged'])).toBeNull();
    });

    it('should throw UnauthorizedException for an invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('bad token');
      });

      await expect(service.refresh('bad')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should return the generic message without mailing an unknown email', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword('nobody@b.com');

      expect(result.message).toContain('If an account');
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('should create a reset token and send the email for a known user', async () => {
      usersService.findOneByEmail.mockResolvedValue({ id: 1 });

      await service.forgotPassword('a@b.com');

      expect(resetTokenRepository.delete).toHaveBeenCalled();
      expect(resetTokenRepository.save).toHaveBeenCalled();
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        'a@b.com',
        expect.stringContaining('/reset-password?token='),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reject an unknown token', async () => {
      resetTokenRepository.findOneBy.mockResolvedValue(null);
      await expect(service.resetPassword('t', 'pw')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an already used token', async () => {
      resetTokenRepository.findOneBy.mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });
      await expect(service.resetPassword('t', 'pw')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an expired token', async () => {
      resetTokenRepository.findOneBy.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });
      await expect(service.resetPassword('t', 'pw')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update the password and consume the token when valid', async () => {
      const token = {
        userId: 5,
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      };
      resetTokenRepository.findOneBy.mockResolvedValue(token);

      const result = await service.resetPassword('t', 'new-pw');

      expect(usersService.update).toHaveBeenCalledWith(5, {
        password: 'new-pw',
      });
      expect(token.usedAt).toBeInstanceOf(Date);
      expect(result.message).toContain('reset successfully');
    });
  });

  describe('validateGoogleUser', () => {
    it('should throw when the Google payload has no email', async () => {
      (service as unknown as { googleClient: unknown }).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({ getPayload: () => null }),
      };

      await expect(service.validateGoogleUser('tok')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an unverified Google email', async () => {
      (service as unknown as { googleClient: unknown }).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ email: 'x@b.com', email_verified: false }),
        }),
      };

      await expect(service.validateGoogleUser('tok')).rejects.toThrow(
        'Google email is not verified',
      );
      expect(usersService.findOrCreateGoogleUser).not.toHaveBeenCalled();
    });

    it('should auto-register an unknown Google account', async () => {
      (service as unknown as { googleClient: unknown }).googleClient = {
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({ email: 'x@b.com', name: 'Google User' }),
        }),
      };
      usersService.findOrCreateGoogleUser.mockResolvedValue({
        id: 1,
        email: 'x@b.com',
        password: 'secret-hash',
        isActive: true,
      });

      const result = await service.validateGoogleUser('tok');

      expect(usersService.findOrCreateGoogleUser).toHaveBeenCalledWith({
        email: 'x@b.com',
        fullname: 'Google User',
      });
      expect((result as Record<string, unknown>).password).toBeUndefined();
    });

    it('should return the user without password when registered', async () => {
      (service as unknown as { googleClient: unknown }).googleClient = {
        verifyIdToken: jest
          .fn()
          .mockResolvedValue({ getPayload: () => ({ email: 'x@b.com' }) }),
      };
      usersService.findOrCreateGoogleUser.mockResolvedValue({
        id: 1,
        email: 'x@b.com',
        password: 'secret-hash',
        isActive: true,
      });

      const result = await service.validateGoogleUser('tok');
      expect((result as Record<string, unknown>).password).toBeUndefined();
    });
  });

  describe('validateGoogleAccessToken', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should throw when Google rejects the access token', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({ ok: false }) as never;

      await expect(service.validateGoogleAccessToken('ya29.x')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return the registered user for a valid access token', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ email: 'x@b.com', name: 'Google User' }),
      }) as never;
      usersService.findOrCreateGoogleUser.mockResolvedValue({
        id: 1,
        email: 'x@b.com',
        password: 'secret-hash',
        isActive: true,
      });

      const result = await service.validateGoogleAccessToken('ya29.x');
      expect((result as User).email).toBe('x@b.com');
    });
  });

  describe('verifyEmail', () => {
    it('should throw NotFoundException for an unknown token', async () => {
      verificationTokenRepository.findOneBy.mockResolvedValue(null);
      await expect(service.verifyEmail('t')).rejects.toThrow(NotFoundException);
    });

    it('should reject an already used token', async () => {
      verificationTokenRepository.findOneBy.mockResolvedValue({
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
      });
      await expect(service.verifyEmail('t')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject an expired token', async () => {
      verificationTokenRepository.findOneBy.mockResolvedValue({
        usedAt: null,
        expiresAt: new Date(Date.now() - 10000),
      });
      await expect(service.verifyEmail('t')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark the email verified and consume the token when valid', async () => {
      const record = {
        userId: 5,
        usedAt: null,
        expiresAt: new Date(Date.now() + 10000),
      };
      verificationTokenRepository.findOneBy.mockResolvedValue(record);

      const result = await service.verifyEmail('t');

      expect(usersService.markEmailVerified).toHaveBeenCalledWith(5);
      expect(record.usedAt).toBeInstanceOf(Date);
      expect(result.message).toContain('verified');
    });
  });

  describe('sendVerificationEmail', () => {
    it('should purge old tokens, persist a new one and mail the link', async () => {
      await service.sendVerificationEmail(5, 'a@b.com');

      expect(verificationTokenRepository.delete).toHaveBeenCalled();
      expect(verificationTokenRepository.save).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'a@b.com',
        expect.stringContaining('/verify-email?token='),
      );
    });
  });

  describe('impersonate', () => {
    const actor = {
      userId: 1,
      email: 'admin@b.com',
      roles: ['superadmin'],
      permissions: ['users.impersonate', 'posts.read'],
      emailVerified: true,
    } as AuthenticatedUser;

    const target = {
      id: 2,
      email: 'user@b.com',
      permissions: [{ name: 'posts.read' }],
      roles: [{ name: 'user', permissions: [] }],
    } as unknown as User;

    it('opens a session as the target, stamped with the actor', async () => {
      usersService.findOne.mockResolvedValue(target);

      await service.impersonate(actor, 2);

      expect(sessionsService.start).toHaveBeenCalledWith(2, undefined, {
        audience: 'admin',
        impersonatedById: 1,
      });
      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0] as {
        sub: number;
        impersonatorId?: number;
      };
      expect(payload.sub).toBe(2);
      expect(payload.impersonatorId).toBe(1);
    });

    it('refuses a target holding permissions the actor lacks', async () => {
      usersService.findOne.mockResolvedValue({
        ...target,
        permissions: [{ name: 'users.delete' }],
      });

      await expect(service.impersonate(actor, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses a non-superadmin signing in as a superadmin', async () => {
      usersService.findOne.mockImplementation((id: number) =>
        Promise.resolve(
          id === 2
            ? {
                id: 2,
                email: 'root@b.com',
                permissions: [],
                roles: [{ name: 'superadmin', permissions: [] }],
              }
            : { id: 1, email: 'admin@b.com', roles: [{ name: 'manager' }] },
        ),
      );

      await expect(service.impersonate(actor, 2)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses to nest impersonations', async () => {
      await expect(
        service.impersonate({ ...actor, impersonatorId: 9 }, 2),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to impersonate yourself', async () => {
      await expect(service.impersonate(actor, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('hands the session back to the impersonator', async () => {
      usersService.findOne.mockResolvedValue({ id: 1, email: 'admin@b.com' });

      await service.stopImpersonating({ ...actor, impersonatorId: 1 });

      const payload = (jwtService.sign as jest.Mock).mock.calls[0][0] as {
        sub: number;
        impersonatorId?: number;
      };
      expect(payload.sub).toBe(1);
      expect(payload.impersonatorId).toBeUndefined();
    });

    it('refuses to stop when the session is not an impersonation', async () => {
      await expect(service.stopImpersonating(actor)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('sign-in lockout', () => {
    const hashFor = (pass: string) => bcrypt.hash(pass, 10);

    it('counts a wrong password against the account', async () => {
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: await hashFor('secret'),
        failedLoginAttempts: 1,
        lockedUntil: null,
      });

      await expect(
        service.validateUser('a@b.com', 'wrong'),
      ).resolves.toBeNull();
      expect(userRepository.update).toHaveBeenCalledWith(1, {
        failedLoginAttempts: 2,
        lockedUntil: null,
      });
    });

    it('locks the account once the attempts pile up', async () => {
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: await hashFor('secret'),
        failedLoginAttempts: 4,
        lockedUntil: null,
      });

      await service.validateUser('a@b.com', 'wrong');

      const [, update] = userRepository.update.mock.calls[0] as [
        number,
        { lockedUntil: Date | null },
      ];
      expect(update.lockedUntil).toBeInstanceOf(Date);
    });

    it('refuses a sign-in while the lockout is running', async () => {
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: await hashFor('secret'),
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });

      await expect(service.validateUser('a@b.com', 'secret')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('wipes the count on a successful sign-in', async () => {
      usersService.findOneByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        password: await hashFor('secret'),
        failedLoginAttempts: 3,
        lockedUntil: null,
      });

      await expect(
        service.validateUser('a@b.com', 'secret'),
      ).resolves.toBeTruthy();
      expect(userRepository.update).toHaveBeenCalledWith(1, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    });

    it('never locks out an address with no account', async () => {
      usersService.findOneByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('nobody@b.com', 'secret'),
      ).resolves.toBeNull();
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });
});
