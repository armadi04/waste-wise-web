import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';

const SESSION_CSRF = 'sessionCsrf';
export const RequireSessionCsrf = () => SetMetadata(SESSION_CSRF, true);

/** Strict double-submit check for session mutations, including Bearer requests. */
@Injectable()
export class SessionCsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      !this.reflector.getAllAndOverride<boolean>(SESSION_CSRF, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const cookie = req.cookies?.csrfToken;
    const header = req.headers['x-csrf-token'];
    if (
      typeof cookie !== 'string' ||
      !cookie ||
      typeof header !== 'string' ||
      cookie !== header
    )
      throw new ForbiddenException('Invalid CSRF token');
    return true;
  }
}
