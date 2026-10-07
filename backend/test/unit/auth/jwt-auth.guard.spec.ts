import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, beforeEach, afterEach, it, expect, jest } from 'bun:test';
import { JwtAuthGuard } from '../../../src/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

function makeContext(user: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let superCanActivate: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
    const passportProto = Object.getPrototypeOf(
      Object.getPrototypeOf(guard),
    ) as { canActivate: () => unknown };
    superCanActivate = jest.spyOn(passportProto, 'canActivate');
  });

  afterEach(() => {
    superCanActivate.mockRestore();
  });

  it('should return false when passport authentication fails', async () => {
    superCanActivate.mockResolvedValue(false);

    await expect(guard.canActivate(makeContext({}))).resolves.toBe(false);
  });

  it('should allow an unverified user on a route marked @AllowUnverified', async () => {
    superCanActivate.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(makeContext({ emailVerified: false })),
    ).resolves.toBe(true);
  });

  it('should allow an authenticated, verified user', async () => {
    superCanActivate.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(makeContext({ emailVerified: true })),
    ).resolves.toBe(true);
  });

  it('should reject an authenticated but unverified user', async () => {
    superCanActivate.mockResolvedValue(true);
    reflector.getAllAndOverride.mockReturnValue(false);

    await expect(
      guard.canActivate(makeContext({ emailVerified: false })),
    ).rejects.toThrow(ForbiddenException);
  });
});
