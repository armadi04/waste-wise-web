import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import type { FastifyRequest as Request } from 'fastify';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SessionsService } from '@/sessions/sessions.service';

/**
 * Reads the JWT from the httpOnly `accessToken` cookie. Browser (SPA) sessions
 * authenticate this way so the token is never exposed to page JavaScript;
 * mobile and third-party clients keep using the Authorization header.
 */
const cookieExtractor = (req: Request): string | null => {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const token = cookies?.accessToken;
  return typeof token === 'string' ? token : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
    private sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
        (req: Request) => {
          const query = req.query as Record<string, unknown>;
          const token = query.token;
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secretKey',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const query = req.query as Record<string, unknown>;
    const queryToken = query.token;
    const token =
      ExtractJwt.fromAuthHeaderAsBearerToken()(req) ||
      cookieExtractor(req) ||
      (typeof queryToken === 'string' ? queryToken : undefined);

    if (token && (await this.authService.isTokenBlacklisted(token))) {
      throw new UnauthorizedException('Token is invalidated');
    }

    // A two-factor challenge token proves the password only. It must never
    // authenticate a request — it is spendable at POST /auth/2fa/verify alone.
    if (payload.tokenType === '2fa') {
      throw new UnauthorizedException('Two-factor verification required');
    }
    // Refresh tokens are spent at /auth/refresh only, never as a Bearer.
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException(
        'Refresh tokens cannot authenticate requests',
      );
    }

    // Device sessions signed out from the profile page (or by an admin) stop
    // working immediately, rather than lingering for the token's remaining TTL.
    // Tokens minted before session tracking carry no `sessionId` and stay valid.
    if (payload.sessionId) {
      if (!(await this.sessionsService.isActive(payload.sessionId))) {
        throw new UnauthorizedException('Session has been revoked');
      }
      await this.sessionsService.touch(payload.sessionId);
    }

    const user = await this.authService.getProfile(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isActive === false)
      throw new UnauthorizedException('Account is inactive');

    // Scope authorization to the chosen role (validated against the freshly
    // loaded user). Mirrors AuthService.buildTokens: a valid activeRole scopes
    // to that role + direct perms; a single-role user is scoped to their role;
    // a multi-role user who hasn't chosen gets no role permissions.
    const roleNames = user.roles?.map((r) => r.name) ?? [];
    const activeRole =
      payload.activeRole && roleNames.includes(payload.activeRole)
        ? payload.activeRole
        : roleNames.length === 1
          ? roleNames[0]
          : undefined;

    const permissions = new Set<string>();
    user.permissions?.forEach((p) => permissions.add(p.name));
    if (activeRole) {
      user.roles
        ?.find((r) => r.name === activeRole)
        ?.permissions?.forEach((p) => permissions.add(p.name));
    } else if (roleNames.length <= 1) {
      user.roles?.forEach((r) =>
        r.permissions?.forEach((p) => permissions.add(p.name)),
      );
    }

    return {
      userId: user.id,
      email: user.email,
      // No active role → no roles either, so @Roles()-gated routes and
      // req.user.roles checks fail closed until a multi-role user picks one.
      roles: activeRole ? [activeRole] : [],
      permissions: Array.from(permissions),
      emailVerified: !!user.emailVerifiedAt,
      ...(activeRole ? { activeRole } : {}),
      ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
      ...(payload.impersonatorId
        ? { impersonatorId: payload.impersonatorId }
        : {}),
    };
  }
}
