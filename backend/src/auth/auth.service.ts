import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  BlacklistedToken,
  type BlacklistReason,
} from './entities/blacklisted-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { RevokedSsoSession } from './entities/revoked-sso-session.entity';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail/mail.service';

import { User } from '../users/entities/user.entity';
import { sessionPolicy, type SessionAudience } from '@/sessions/session-policy';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/** Tokens for one device session plus its absolute deadline (cookie lifetime). */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionExpiresAt: Date;
}
import type { AuthenticatedUser } from './interfaces/auth-request.interface';
import {
  SessionsService,
  type SessionContext,
} from '../sessions/sessions.service';

/** Role name seeded with every permission — see `seeder.service.ts`. */
const SUPERADMIN_ROLE = 'superadmin';

/**
 * Failed sign-ins are counted per account, not per IP: the global throttler
 * already caps requests from one address, which does nothing against an
 * attacker rotating addresses through one account's password space.
 */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

/** Refresh tokens are typed 'refresh'; untyped tokens are legacy (pre-typing) logins. */
/** How long a rotated refresh token stays spendable (concurrent refreshes from tabs). */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export const isRefreshableTokenType = (tokenType: JwtPayload['tokenType']) =>
  tokenType === 'refresh' || tokenType === undefined;

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(BlacklistedToken)
    private blacklistedTokenRepository: Repository<BlacklistedToken>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(EmailVerificationToken)
    private verificationTokenRepository: Repository<EmailVerificationToken>,
    @InjectRepository(RevokedSsoSession)
    private revokedSsoSessionRepository: Repository<RevokedSsoSession>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private mailService: MailService,
    private sessionsService: SessionsService,
    private eventEmitter: EventEmitter2,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Omit<User, 'password'> | null> {
    const user = await this.usersService.findOneByEmail(email);
    // An unknown address is never locked out — that would turn the lockout into
    // an oracle for which addresses have accounts.
    if (!user) return null;

    this.assertNotLocked(user);

    if (!(await bcrypt.compare(pass, user.password))) {
      await this.registerFailedLogin(user);
      return null;
    }

    this.assertActive(user);
    await this.clearFailedLogins(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  /** Rejects a sign-in while the account is serving its lockout. */
  assertNotLocked(user: Pick<User, 'lockedUntil'>): void {
    if (!user.lockedUntil || user.lockedUntil <= new Date()) return;

    const minutes = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
    );
    throw new ForbiddenException({
      message: `Too many failed sign-in attempts. Try again in ${minutes} minute${
        minutes === 1 ? '' : 's'
      }.`,
      code: 'ACCOUNT_LOCKED',
    });
  }

  assertActive(user: Pick<User, 'isActive'>): void {
    if (user.isActive === false)
      throw new ForbiddenException({
        message: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE',
      });
  }

  /**
   * Count a failed attempt — a wrong password or a wrong second factor, since
   * both are guesses at the same account — and lock once they pile up.
   */
  async registerFailedLogin(user: Pick<User, 'id' | 'failedLoginAttempts'>) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;

    await this.userRepository.update(user.id, {
      failedLoginAttempts: attempts,
      lockedUntil: locked
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null,
    });

    if (locked) {
      this.eventEmitter.emit('audit.record', {
        action: 'auth.locked',
        subjectType: 'user',
        subjectId: user.id,
        summary: `Account locked after ${attempts} failed sign-in attempts`,
        metadata: { attempts, minutes: LOCKOUT_MINUTES },
      });
    }
  }

  /** A successful sign-in wipes the slate. */
  async clearFailedLogins(
    user: Pick<User, 'id' | 'failedLoginAttempts' | 'lockedUntil'>,
  ) {
    if (!user.failedLoginAttempts && !user.lockedUntil) return;
    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  async validateGoogleUser(token: string): Promise<Omit<User, 'password'>> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }

      return await this.resolveGoogleUser({
        email: payload.email,
        fullname: payload.name,
        emailVerified: payload.email_verified,
      });
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  /**
   * Existing Google accounts sign in; unknown ones are auto-registered by the
   * users service with the default `user` role. The backend remains the source
   * of truth for identity, account status, roles and permissions.
   */
  private async resolveGoogleUser(payload: {
    email?: string | null;
    fullname?: string | null;
    emailVerified?: boolean;
  }): Promise<Omit<User, 'password'>> {
    if (!payload.email) {
      throw new UnauthorizedException('Invalid Google identity');
    }
    if (payload.emailVerified === false) {
      throw new UnauthorizedException('Google email is not verified');
    }
    const user = await this.usersService.findOrCreateGoogleUser({
      email: payload.email,
      fullname: payload.fullname,
    });
    this.assertActive(user);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  async validateGoogleAccessToken(
    accessToken: string,
  ): Promise<Omit<User, 'password'>> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid Google access token');
      }

      const payload = (await response.json()) as {
        email?: string;
        name?: string;
        email_verified?: boolean;
      };
      if (!payload || !payload.email) {
        throw new UnauthorizedException('Invalid Google user information');
      }

      return await this.resolveGoogleUser({
        email: payload.email,
        fullname: payload.name,
        emailVerified: payload.email_verified,
      });
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Google access token validation failed');
    }
  }

  // Mint an access/refresh token pair scoped to the user's active role.
  //
  // - A chosen `activeRole` the user actually holds becomes the token's role.
  // - With no valid choice we fall back to the user's sole role, or — for a
  //   multi-role user who hasn't picked yet — no role, so the selection screen
  //   is a real gate rather than cosmetic.
  //
  // Permissions are deliberately not embedded: JwtStrategy reloads them from
  // the database on every request (scoped by `activeRole`), and listing them
  // made a superadmin's token outgrow the ~4 KB browser cookie limit, so the
  // browser silently dropped the accessToken cookie and every login bounced.
  private buildTokens(
    user: Omit<User, 'password'>,
    opts: {
      sid?: string;
      activeRole?: string;
      sessionId?: string;
      impersonatorId?: number;
      audience?: SessionAudience;
      sessionExpiresAt?: Date;
    } = {},
  ): SessionTokens {
    const roleNames = user.roles?.map((r) => r.name) ?? [];
    const activeRole =
      opts.activeRole && roleNames.includes(opts.activeRole)
        ? opts.activeRole
        : roleNames.length === 1
          ? roleNames[0]
          : undefined;

    const payload: JwtPayload = {
      email: user.email,
      sub: user.id,
      // No active role → no roles either, so @Roles()-gated routes and
      // req.user.roles checks fail closed until a multi-role user picks one.
      roles: activeRole ? [activeRole] : [],
      emailVerified: !!user.emailVerifiedAt,
      ...(activeRole ? { activeRole } : {}),
      ...(opts.sid ? { sid: opts.sid } : {}),
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
      ...(opts.impersonatorId ? { impersonatorId: opts.impersonatorId } : {}),
    };
    // Typed so neither can stand in for the other: a stolen access token can't
    // be refreshed into a week-long session, and a refresh token can't call APIs.
    // A refresh token outliving the idle window would be refused by the
    // session check anyway; matching it keeps a leaked one short-lived.
    const audience = opts.audience ?? 'admin';
    const { idleMs, absoluteMs } = sessionPolicy(audience);
    return {
      accessToken: this.jwtService.sign({ ...payload, tokenType: 'user' }),
      refreshToken: this.jwtService.sign(
        { ...payload, tokenType: 'refresh', jti: crypto.randomUUID() },
        { expiresIn: Math.ceil(idleMs / 1000) },
      ),
      sessionExpiresAt:
        opts.sessionExpiresAt ?? new Date(Date.now() + absoluteMs),
    };
  }

  /**
   * A correct password with two-factor enabled buys only this: a short-lived
   * token that proves the first factor. It authenticates nothing (the JWT
   * strategy rejects it) and is spent at POST /auth/2fa/verify.
   */
  issueTwoFactorChallenge(user: Pick<User, 'id' | 'email'>): string {
    return this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles: [],
        emailVerified: true,
        tokenType: '2fa' as const,
      },
      { expiresIn: '5m' },
    );
  }

  /** Validate a challenge token and return the user it was issued for. */
  consumeTwoFactorChallenge(token: string): number {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException({
        message: 'Your sign-in attempt expired — start again',
        code: 'TWO_FACTOR_CHALLENGE_EXPIRED',
      });
    }
    if (payload.tokenType !== '2fa') {
      throw new UnauthorizedException({
        message: 'Invalid verification token',
        code: 'TWO_FACTOR_CHALLENGE_INVALID',
      });
    }
    return payload.sub;
  }

  // `sid` is the OIDC session id, passed only for SSO logins so the session can
  // be revoked on back-channel logout. `context` (IP + user agent) is recorded
  // on the device session so the user can recognise it in the session list.
  async login(
    user: Omit<User, 'password'>,
    opts: {
      sid?: string;
      context?: SessionContext;
      impersonatorId?: number;
      /** Session lifetime policy. */
      audience?: SessionAudience;
    } = {},
  ) {
    this.assertActive(user);
    const session = await this.sessionsService.start(user.id, opts.context, {
      audience: opts.audience ?? 'admin',
      isSso: !!opts.sid,
      impersonatedById: opts.impersonatorId,
    });
    return this.buildTokens(user, {
      sid: opts.sid,
      sessionId: session.sessionId,
      impersonatorId: opts.impersonatorId,
      audience: session.audience,
      sessionExpiresAt: session.absoluteExpiresAt,
    });
  }

  // Re-issue tokens scoped to a different role the user holds (profile switcher
  // + post-login selection). Rejects roles the user isn't assigned.
  async switchRole(
    userId: number,
    roleName: string,
    sid?: string,
    sessionId?: string,
    impersonatorId?: number,
  ) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    this.assertActive(user);
    if (!user.roles?.some((r) => r.name === roleName)) {
      throw new ForbiddenException('You do not have that role');
    }
    // Same device session: keep its audience and absolute deadline.
    const session = sessionId
      ? await this.sessionsService.findBySessionId(sessionId)
      : null;
    return this.buildTokens(user, {
      activeRole: roleName,
      sid,
      sessionId,
      impersonatorId,
      audience: session?.audience,
      sessionExpiresAt: session?.absoluteExpiresAt,
    });
  }

  /**
   * Open a session as another user, keeping the administrator's own id on the
   * token so the session can be handed back and is never mistaken for the
   * user's own.
   *
   * The actor may only impersonate someone whose permissions they already hold:
   * without that, "sign in as" would be a way for a limited admin to borrow a
   * superadmin's access. Nesting is refused for the same reason.
   */
  async impersonate(
    actor: AuthenticatedUser,
    targetId: number,
    context?: SessionContext,
  ) {
    if (actor.impersonatorId) {
      throw new ForbiddenException(
        'Return to your own account before signing in as someone else',
      );
    }
    if (actor.userId === targetId) {
      throw new BadRequestException('You are already signed in as yourself');
    }

    const target = await this.usersService.findOne(targetId);
    if (!target) {
      throw new NotFoundException(`User #${targetId} not found`);
    }

    // The superadmin role is the keys to the building: only another superadmin
    // may step into it, whatever permissions the actor happens to hold.
    if (target.roles?.some((r) => r.name === SUPERADMIN_ROLE)) {
      const actorUser = await this.usersService.findOne(actor.userId);
      const actorIsSuperadmin = actorUser?.roles?.some(
        (r) => r.name === SUPERADMIN_ROLE,
      );
      if (!actorIsSuperadmin) {
        throw new ForbiddenException(
          'Only a superadmin can sign in as a superadmin',
        );
      }
    }

    const actorPermissions = new Set(actor.permissions);
    const targetPermissions = new Set<string>();
    target.permissions?.forEach((p) => targetPermissions.add(p.name));
    target.roles?.forEach((r) =>
      r.permissions?.forEach((p) => targetPermissions.add(p.name)),
    );

    const escalates = [...targetPermissions].some(
      (permission) => !actorPermissions.has(permission),
    );
    if (escalates) {
      throw new ForbiddenException(
        'You cannot sign in as a user with permissions you do not have',
      );
    }

    this.eventEmitter.emit('audit.record', {
      action: 'user.impersonated',
      actorId: actor.userId,
      actorEmail: actor.email,
      subjectType: 'user',
      subjectId: target.id,
      summary: `Signed in as ${target.email}`,
      ipAddress: context?.ipAddress ?? null,
    });

    return this.login(target, { context, impersonatorId: actor.userId });
  }

  /** Hand an impersonated session back to the administrator who opened it. */
  async stopImpersonating(actor: AuthenticatedUser, context?: SessionContext) {
    if (!actor.impersonatorId) {
      throw new BadRequestException('This session is not an impersonation');
    }

    const impersonator = await this.usersService.findOne(actor.impersonatorId);
    if (!impersonator) {
      throw new UnauthorizedException('Your account no longer exists');
    }

    this.eventEmitter.emit('audit.record', {
      action: 'user.impersonation_ended',
      actorId: impersonator.id,
      actorEmail: impersonator.email,
      subjectType: 'user',
      subjectId: actor.userId,
      summary: `Returned from signing in as ${actor.email}`,
      ipAddress: context?.ipAddress ?? null,
    });

    return this.login(impersonator, { context });
  }

  async revokeSession(sid: string, sub?: string | null): Promise<void> {
    const existing = await this.revokedSsoSessionRepository.findOneBy({ sid });
    if (existing) return;
    await this.revokedSsoSessionRepository.save(
      this.revokedSsoSessionRepository.create({ sid, sub: sub ?? null }),
    );
  }

  async isSessionRevoked(sid: string): Promise<boolean> {
    const found = await this.revokedSsoSessionRepository.findOneBy({ sid });
    return !!found;
  }

  async blacklistToken(token: string, reason: BlacklistReason = 'logout') {
    // Idempotent: a token can already be listed (rotated, then logged out).
    await this.blacklistedTokenRepository
      .createQueryBuilder()
      .insert()
      .into(BlacklistedToken)
      .values({ token, reason })
      .orIgnore()
      .execute();
  }

  /**
   * Identify the session behind a logout, even once the access token expired:
   * signature is still required, expiry is not. Challenge and machine tokens
   * never identify a user session.
   */
  sessionFromTokens(
    tokens: Array<string | undefined>,
  ): { userId: number; email: string; sessionId?: string } | null {
    for (const token of tokens) {
      if (!token) continue;
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          ignoreExpiration: true,
        });
        if (payload.tokenType === '2fa' || payload.tokenType === 'client')
          continue;
        return {
          userId: payload.sub,
          email: payload.email,
          sessionId: payload.sessionId,
        };
      } catch {
        // Not ours or tampered: try the next token.
      }
    }
    return null;
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistedToken = await this.blacklistedTokenRepository.findOneBy({
      token,
    });
    return !!blacklistedToken;
  }

  async refresh(refreshToken: string, context?: SessionContext) {
    // A refresh token blacklisted at logout must not be usable, even though it
    // hasn't expired — otherwise logout doesn't actually end the session.
    // Rotation retires each refresh token once it is used. Within a short grace
    // window the same token may still be spent: two tabs refreshing together send
    // it concurrently. After that window, a retired token coming back means a
    // copy is in someone else's hands, so the whole session is revoked.
    const listed = await this.blacklistedTokenRepository.findOneBy({
      token: refreshToken,
    });
    const inGrace =
      listed?.reason === 'rotated' &&
      Date.now() - listed.invalidatedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
    if (listed && !inGrace) {
      if (listed.reason === 'rotated')
        await this.revokeReusedSession(refreshToken);
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    // Only refresh tokens refresh. Access, machine and especially two-factor
    // challenge tokens are rejected — a challenge token placed in the cookie
    // would otherwise skip the second factor. Untyped tokens predate typing and
    // stay accepted until they expire (at most 7 days after deploy).
    if (!isRefreshableTokenType(payload.tokenType)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // An SSO session that has been revoked (back-channel logout) can't be refreshed.
    if (payload.sid && (await this.isSessionRevoked(payload.sid))) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // A device session the user (or an admin) signed out can't be refreshed
    // either — otherwise revoking it would only last until the access token expired.
    if (
      payload.sessionId &&
      !(await this.sessionsService.isActive(payload.sessionId))
    ) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    this.assertActive(user);

    // Carry the chosen role forward (buildTokens drops it if the user no longer
    // holds it).
    // Refreshing is real activity: slide the session's expiry forward with it.
    // Tokens minted before session tracking existed carry no `sessionId` — open
    // one now, so an already-signed-in user doesn't sit with an empty session
    // list until their refresh token finally expires.
    let session: {
      sessionId: string;
      audience: SessionAudience;
      absoluteExpiresAt: Date;
    } | null;
    if (payload.sessionId) {
      session = await this.sessionsService.touch(payload.sessionId, true);
      if (!session) throw new UnauthorizedException('Session has been revoked');
    } else {
      session = await this.sessionsService.start(user.id, context, {
        audience: 'admin',
        isSso: !!payload.sid,
      });
    }

    const tokens = this.buildTokens(user, {
      sid: payload.sid,
      activeRole: payload.activeRole,
      sessionId: session.sessionId,
      impersonatorId: payload.impersonatorId,
      audience: session.audience,
      sessionExpiresAt: session.absoluteExpiresAt,
    });
    if (!listed) await this.blacklistToken(refreshToken, 'rotated');
    return tokens;
  }

  /** A retired refresh token was replayed after the grace window: end its session. */
  private async revokeReusedSession(refreshToken: string) {
    const session = this.sessionFromTokens([refreshToken]);
    if (session?.sessionId)
      await this.sessionsService.revokeBySessionId(session.sessionId);
    this.eventEmitter.emit('audit.record', {
      action: 'auth.refresh_reuse',
      actorId: session?.userId,
      actorEmail: session?.email,
      summary: 'Retired refresh token reused; session revoked',
    });
  }

  async getProfile(userId: number) {
    return this.usersService.findOne(userId);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const GENERIC_MESSAGE =
      'If an account with that email exists, a reset link has been sent.';

    const user = await this.usersService.findOneByEmail(email);
    if (!user) return { message: GENERIC_MESSAGE };

    // Remove any existing unused tokens for this user
    await this.resetTokenRepository.delete({
      userId: user.id,
      usedAt: IsNull(),
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.resetTokenRepository.save(
      this.resetTokenRepository.create({ token, userId: user.id, expiresAt }),
    );

    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset(email, resetUrl);

    return { message: GENERIC_MESSAGE };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    const INVALID_MSG = 'Invalid or expired reset token.';

    const resetToken = await this.resetTokenRepository.findOneBy({ token });
    if (!resetToken) throw new BadRequestException(INVALID_MSG);
    if (resetToken.usedAt !== null) throw new BadRequestException(INVALID_MSG);
    if (resetToken.expiresAt < new Date())
      throw new BadRequestException(INVALID_MSG);

    await this.usersService.update(resetToken.userId, { password });

    resetToken.usedAt = new Date();
    await this.resetTokenRepository.save(resetToken);

    this.eventEmitter.emit('audit.record', {
      action: 'auth.password_reset',
      actorId: resetToken.userId,
      subjectType: 'user',
      subjectId: resetToken.userId,
      summary: 'Password reset using an emailed link',
    });

    return { message: 'Password has been reset successfully.' };
  }

  async findUserByEmailForVerification(email: string) {
    return this.usersService.findOneByEmail(email);
  }

  @OnEvent('user.created')
  async onUserCreated(payload: {
    userId: number;
    email: string;
    emailVerified?: boolean;
  }) {
    // Invited users arrive via an emailed link, so their address is already
    // proven — skip the separate verification email for them.
    if (payload.emailVerified) return;
    await this.sendVerificationEmail(payload.userId, payload.email);
  }

  async sendVerificationEmail(userId: number, email: string): Promise<void> {
    // Remove existing unused tokens for this user
    await this.verificationTokenRepository.delete({
      userId,
      usedAt: IsNull(),
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.verificationTokenRepository.save(
      this.verificationTokenRepository.create({ token, userId, expiresAt }),
    );

    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    await this.mailService.sendVerificationEmail(email, verifyUrl);
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.verificationTokenRepository.findOneBy({ token });
    if (!record) throw new NotFoundException('Verification token not found');
    if (record.usedAt) throw new BadRequestException('Token already used');
    if (record.expiresAt < new Date())
      throw new BadRequestException('Token expired');

    await this.usersService.markEmailVerified(record.userId);

    record.usedAt = new Date();
    await this.verificationTokenRepository.save(record);

    return { message: 'Email verified successfully' };
  }
}
