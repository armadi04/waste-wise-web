import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

// Bearer clients do not rely on ambient browser cookies. Cookie-authenticated writes
// must prove possession of the readable CSRF cookie, including direct backend calls.
@Injectable()
export class CookieCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    if (/^Bearer\s+\S+$/i.test(req.headers.authorization ?? '')) return true;
    const cookies = req.cookies as Record<string, unknown> | undefined;
    if (!cookies?.accessToken) return true; // JWT guard still rejects missing credentials.
    const cookie = cookies.csrfToken;
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
