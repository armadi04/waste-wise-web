import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { OwnerOrPermissionGuard } from '../../../src/auth/owner-or-permission.guard';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

function makeContext(
  user: Partial<AuthenticatedUser>,
  paramId?: string,
): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user, params: { id: paramId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('OwnerOrPermissionGuard', () => {
  let guard: OwnerOrPermissionGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new OwnerOrPermissionGuard(reflector as unknown as Reflector);
  });

  it('should allow the owner regardless of permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.update']);

    expect(
      guard.canActivate(
        makeContext({ userId: 5, roles: [], permissions: [] }, '5'),
      ),
    ).toBe(true);
  });

  it('should allow a superadmin regardless of ownership', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.update']);

    expect(
      guard.canActivate(
        makeContext({ userId: 1, roles: ['superadmin'], permissions: [] }, '5'),
      ),
    ).toBe(true);
  });

  it('should allow when no permissions are required and not the owner', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(
      guard.canActivate(
        makeContext({ userId: 1, roles: [], permissions: [] }, '5'),
      ),
    ).toBe(true);
  });

  it('should allow a non-owner who holds the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.update']);

    expect(
      guard.canActivate(
        makeContext(
          { userId: 1, roles: [], permissions: ['users.update'] },
          '5',
        ),
      ),
    ).toBe(true);
  });

  it('should deny a non-owner lacking the required permission', () => {
    reflector.getAllAndOverride.mockReturnValue(['users.update']);

    expect(
      guard.canActivate(
        makeContext({ userId: 1, roles: [], permissions: [] }, '5'),
      ),
    ).toBe(false);
  });
});
