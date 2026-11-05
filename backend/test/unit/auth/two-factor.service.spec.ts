import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { generate } from 'otplib';
import { TwoFactorService } from '../../../src/auth/two-factor.service';
import { TwoFactorRecoveryCode } from '../../../src/auth/entities/two-factor-recovery-code.entity';
import { User } from '../../../src/users/entities/user.entity';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let user: User;
  let recoveryCodes: Array<TwoFactorRecoveryCode>;

  beforeEach(async () => {
    user = {
      id: 1,
      email: 'a@b.com',
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorLastStep: null,
    } as unknown as User;
    recoveryCodes = [];

    const userRepository = {
      findOne: jest.fn(() => Promise.resolve(user)),
      save: jest.fn((e: User) => {
        Object.assign(user, e);
        return Promise.resolve(user);
      }),
    };
    const recoveryCodeRepository = {
      create: jest.fn((dto: TwoFactorRecoveryCode) => dto),
      // `save` is called with the full set on issue and with a single row when
      // a code is spent — mirror both so the store stays consistent.
      save: jest.fn(
        (input: TwoFactorRecoveryCode | Array<TwoFactorRecoveryCode>) => {
          if (Array.isArray(input)) {
            recoveryCodes = input;
          } else {
            recoveryCodes = recoveryCodes.map((c) =>
              c.codeHash === input.codeHash ? input : c,
            );
          }
          return Promise.resolve(input);
        },
      ),
      find: jest.fn(() =>
        Promise.resolve(recoveryCodes.filter((c) => c.usedAt === null)),
      ),
      delete: jest.fn(() => {
        recoveryCodes = [];
        return Promise.resolve({});
      }),
      count: jest.fn(() =>
        Promise.resolve(recoveryCodes.filter((c) => c.usedAt === null).length),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(TwoFactorRecoveryCode),
          useValue: recoveryCodeRepository,
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'test-secret-value-1234'),
            get: jest.fn((key: string) =>
              key === 'JWT_SECRET' ? 'test-secret-value-1234' : 'WasteWise',
            ),
          },
        },
      ],
    }).compile();

    service = module.get(TwoFactorService);
  });

  it('is off until enrollment is confirmed', async () => {
    const enrollment = await service.startEnrollment(1);

    expect(enrollment.secret).toBeTruthy();
    expect(enrollment.qrDataUrl.startsWith('data:image/png;base64,')).toBe(
      true,
    );
    expect(service.isEnabled(user)).toBe(false);
  });

  it('stores the secret encrypted, not in the clear', async () => {
    const { secret } = await service.startEnrollment(1);

    expect(user.twoFactorSecret).toBeTruthy();
    expect(user.twoFactorSecret).not.toBe(secret);
  });

  it('enables with a valid code and issues recovery codes', async () => {
    const { secret } = await service.startEnrollment(1);
    const token = await generate({ secret });

    const codes = await service.confirm(1, token);

    expect(service.isEnabled(user)).toBe(true);
    expect(codes).toHaveLength(10);
    expect(recoveryCodes).toHaveLength(10);
  });

  it('rejects a wrong code', async () => {
    await service.startEnrollment(1);

    await expect(service.confirm(1, '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.isEnabled(user)).toBe(false);
  });

  it('refuses to restart enrollment while it is enabled', async () => {
    const { secret } = await service.startEnrollment(1);
    await service.confirm(1, await generate({ secret }));

    await expect(service.startEnrollment(1)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('will not accept the same code twice', async () => {
    const { secret } = await service.startEnrollment(1);
    const token = await generate({ secret });
    await service.confirm(1, token);

    await expect(service.verify(1, token)).resolves.toBe(false);
  });

  it('accepts a recovery code once, then never again', async () => {
    const { secret } = await service.startEnrollment(1);
    const codes = await service.confirm(1, await generate({ secret }));

    await expect(service.verify(1, codes[0])).resolves.toBe(true);
    await expect(service.verify(1, codes[0])).resolves.toBe(false);
  });

  it('clears everything when disabled with a recovery code', async () => {
    const { secret } = await service.startEnrollment(1);
    const codes = await service.confirm(1, await generate({ secret }));

    await service.disable(1, codes[1]);

    expect(user.twoFactorSecret).toBeNull();
    expect(user.twoFactorEnabledAt).toBeNull();
    expect(recoveryCodes).toHaveLength(0);
  });
});
