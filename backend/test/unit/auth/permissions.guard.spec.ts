import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { PermissionsGuard } from '../../../src/auth/permissions.guard';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

function makeContext(user: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PermissionsGuard(reflector as unknown as Reflector);
  });

  it('should allow when no permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('should allow when the user holds one of the required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);

    expect(
      guard.canActivate(makeContext({ permissions: ['users.read'] })),
    ).toBe(true);
  });

  it('should deny when the user holds none of the required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.delete']);

    expect(
      guard.canActivate(makeContext({ permissions: ['users.read'] })),
    ).toBe(false);
  });

  it('should deny when the user has no permissions array', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);

    expect(guard.canActivate(makeContext({}))).toBe(false);
  });
});
