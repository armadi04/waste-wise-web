import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { RolesGuard } from '../../../src/auth/roles.guard';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

function makeContext(user: Partial<AuthenticatedUser>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should allow when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(makeContext({ roles: [] }))).toBe(true);
  });

  it('should allow when the user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(makeContext({ roles: ['admin'] }))).toBe(true);
  });

  it('should deny when the user lacks all required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(makeContext({ roles: ['user'] }))).toBe(false);
  });

  it('should deny when the user has no roles array', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(makeContext({}))).toBe(false);
  });
});
