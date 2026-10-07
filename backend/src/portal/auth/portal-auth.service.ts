import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { randomInt, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { IsNull, Repository } from 'typeorm';
import { AuthService } from '@/auth/auth.service';
import { SessionsService } from '@/sessions/sessions.service';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { UsersService } from '@/users/users.service';
import type { User } from '@/users/entities/user.entity';
import { Role } from '@/roles/entities/role.entity';
import { MailService } from '@/mail/mail.service';
import { PortalAvatarImportService } from '@/portal/customer/portal-avatar-import.service';
import { PortalEmailOtpChallenge } from '@/portal/auth/entities/portal-email-otp-challenge.entity';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// Rolling per-email budgets across codes (a new code no longer resets the guesses).
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_REQUESTS_PER_WINDOW = 5;
const OTP_ATTEMPTS_PER_WINDOW = 10;
const CUSTOMER_ROLE = 'customer';
const GENERIC_MESSAGE = 'Jika email valid, kode masuk sudah dikirim.';

@Injectable()
export class PortalAuthService {
  private readonly logger = new Logger(PortalAuthService.name);
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId?: string;

  constructor(
    @InjectRepository(PortalEmailOtpChallenge)
    private readonly otpRepository: Repository<PortalEmailOtpChallenge>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly mailService: MailService,
    configService: ConfigService,
    private readonly avatarImports: PortalAvatarImportService,
    private readonly events: EventEmitter2 = new EventEmitter2(),
  ) {
    this.googleClientId = configService.get<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async requestEmailOtp(email: string, requestIp: string | undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    // Per-email budgets hold even when every request reaches us from one proxy IP:
    // they cap mail sent to an address and guesses spread over many codes.
    const recent = await this.recentActivity(normalizedEmail);
    if (
      recent.requests >= OTP_REQUESTS_PER_WINDOW ||
      recent.attempts >= OTP_ATTEMPTS_PER_WINDOW
    ) {
      throw new HttpException(
        'Terlalu banyak permintaan kode. Coba lagi dalam 1 jam.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const previous = await this.otpRepository.findOne({
      where: {
        email: normalizedEmail,
        purpose: 'portal-login',
        consumedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (
      previous?.lastSentAt &&
      Date.now() - previous.lastSentAt.getTime() < OTP_RESEND_MS
    ) {
      throw new HttpException(
        'Tunggu sebentar sebelum meminta kode baru.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (previous) {
      previous.consumedAt = new Date();
      await this.otpRepository.save(previous);
    }

    const code = String(randomInt(100000, 1000000));
    const challenge = this.otpRepository.create({
      email: normalizedEmail,
      purpose: 'portal-login',
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      consumedAt: null,
      requestIp: requestIp ?? null,
      lastSentAt: new Date(),
    });
    await this.otpRepository.save(challenge);
    await this.mailService.sendPortalOtp(normalizedEmail, code);
    return { message: GENERIC_MESSAGE, expiresInSeconds: OTP_TTL_MS / 1000 };
  }

  async verifyEmailOtp(
    email: string,
    code: string,
    context: { ipAddress: string; userAgent: string },
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const challenge = await this.otpRepository.findOne({
      where: {
        email: normalizedEmail,
        purpose: 'portal-login',
        consumedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    if (!challenge || challenge.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Kode tidak valid atau sudah kedaluwarsa.',
      );
    }
    const recent = await this.recentActivity(normalizedEmail);
    if (recent.attempts >= OTP_ATTEMPTS_PER_WINDOW) {
      throw new HttpException(
        'Terlalu banyak percobaan. Minta kode baru setelah 1 jam.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Reserve the attempt atomically before comparing, so parallel guesses can't
    // all read the same counter and exceed the limit.
    const reserved = await this.otpRepository
      .createQueryBuilder()
      .update(PortalEmailOtpChallenge)
      .set({ attempts: () => '"attempts" + 1' })
      .where('"id" = :id AND "attempts" < :max AND "consumedAt" IS NULL', {
        id: challenge.id,
        max: OTP_MAX_ATTEMPTS,
      })
      .execute();
    if (!reserved.affected) {
      throw new HttpException(
        'Batas percobaan kode tercapai. Minta kode baru.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await bcrypt.compare(code, challenge.codeHash);
    if (!valid) {
      throw new UnauthorizedException(
        'Kode tidak valid atau sudah kedaluwarsa.',
      );
    }

    // Consume atomically: of two concurrent correct submissions only one wins.
    const consumed = await this.otpRepository
      .createQueryBuilder()
      .update(PortalEmailOtpChallenge)
      .set({ consumedAt: () => 'now()' })
      .where('"id" = :id AND "consumedAt" IS NULL', { id: challenge.id })
      .execute();
    if (!consumed.affected) {
      throw new UnauthorizedException(
        'Kode tidak valid atau sudah kedaluwarsa.',
      );
    }
    const user = await this.ensurePortalUser(
      normalizedEmail,
      undefined,
      RegisterMethodEnum.EMAIL_OTP,
    );
    return this.completePortalLogin(user, context, 'email OTP');
  }

  async loginWithGoogle(
    token: string,
    context: { ipAddress: string; userAgent: string },
  ) {
    if (!token) throw new BadRequestException('Google token wajib diisi.');
    // Without a client id google-auth-library skips the audience check and
    // would accept ID tokens minted for any app, so fail closed.
    if (!this.googleClientId) {
      throw new ServiceUnavailableException('Login Google belum tersedia.');
    }
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: this.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Login Google tidak valid. Coba lagi.');
    }
    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException('Google email belum terverifikasi.');
    }

    const user = await this.ensurePortalUser(
      payload.email.toLowerCase(),
      payload.name,
      RegisterMethodEnum.GOOGLE,
    );
    return this.completePortalLogin(user, context, 'Google', payload.picture);
  }

  /**
   * The portal signs in customers only. Staff and admin accounts — and anyone
   * with a second factor — must use the dashboard login, which enforces 2FA and
   * lockout; an email inbox alone must never open an admin session.
   */
  private async completePortalLogin(
    user: User,
    context: { ipAddress: string; userAgent: string },
    method: string,
    googlePicture?: string,
  ) {
    const roles = user.roles?.map((role) => role.name) ?? [];
    if (
      roles.some((role) => role !== CUSTOMER_ROLE) ||
      user.twoFactorEnabledAt
    ) {
      this.events.emit('audit.record', {
        action: 'auth.login_failed',
        actorId: user.id,
        actorEmail: user.email,
        summary: `Portal ${method} sign-in refused for a dashboard account`,
        ipAddress: context.ipAddress,
      });
      throw new ForbiddenException(
        'Akun ini memakai login dashboard. Masuk lewat dashboard KuponMalam.',
      );
    }
    this.authService.assertNotLocked(user);
    const tokens = await this.authService.login(user, {
      context,
      audience: 'portal',
    });
    if (googlePicture && !user.avatar) {
      try {
        await this.avatarImports.enqueue(user.id, googlePicture);
      } catch {
        // Photo import is optional. Never log the provider URL or token.
        this.logger.warn(
          { userId: user.id },
          'Google profile photo enqueue failed',
        );
      }
    }
    this.events.emit('audit.record', {
      action: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      subjectType: 'user',
      subjectId: user.id,
      summary: `Signed in to the portal with ${method}`,
      ipAddress: context.ipAddress,
    });
    return tokens;
  }

  private async recentActivity(email: string) {
    const raw = await this.otpRepository
      .createQueryBuilder('challenge')
      .select('COUNT(*)', 'requests')
      .addSelect('COALESCE(SUM(challenge.attempts), 0)', 'attempts')
      .where(
        'challenge.email = :email AND challenge.purpose = :purpose AND challenge.createdAt > :since',
        {
          email,
          purpose: 'portal-login',
          since: new Date(Date.now() - OTP_WINDOW_MS),
        },
      )
      .getRawOne<{ requests: string | number; attempts: string | number }>();
    return {
      requests: Number(raw?.requests ?? 0),
      attempts: Number(raw?.attempts ?? 0),
    };
  }

  async ensurePortalUser(
    email: string,
    fullname?: string,
    registerMethod: RegisterMethodEnum = RegisterMethodEnum.UNKNOWN,
  ) {
    const existing = await this.usersService.findOneByEmail(email);
    if (existing) {
      if (!existing.emailVerifiedAt) {
        await this.usersService.markEmailVerified(existing.id);
      }
      return this.usersService.findOne(existing.id);
    }

    const customerRole = await this.getCustomerRole();
    const user = await this.usersService.create(
      {
        email,
        password: randomUUID(),
        fullname: fullname ?? email.split('@')[0],
        roleIds: [customerRole.id],
      },
      { autoVerify: true, registerMethod },
    );
    return this.usersService.findOne(user.id);
  }

  /** Revoke whatever the browser still holds; cookies are cleared by the caller regardless. */
  async logout(accessToken?: string, refreshToken?: string) {
    const session = this.authService.sessionFromTokens([
      accessToken,
      refreshToken,
    ]);
    // Only tokens we signed are recorded, so this unauthenticated endpoint can't
    // be used to fill the blacklist with arbitrary strings.
    for (const token of [accessToken, refreshToken])
      if (token && this.authService.sessionFromTokens([token]))
        await this.authService.blacklistToken(token);
    if (session?.sessionId)
      await this.sessionsService.revokeBySessionId(session.sessionId);
    if (session)
      this.events.emit('audit.record', {
        action: 'auth.logout',
        actorId: session.userId,
        actorEmail: session.email,
        summary: 'Signed out of the portal',
      });
    return { userId: session?.userId ?? null };
  }

  private async getCustomerRole() {
    const existing = await this.roleRepository.findOneBy({
      name: CUSTOMER_ROLE,
    });
    if (existing) return existing;
    return this.roleRepository.save(
      this.roleRepository.create({
        name: CUSTOMER_ROLE,
        description: 'KuponMalam portal user',
      }),
    );
  }
}
