import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { TwoFactorRecoveryCode } from './entities/two-factor-recovery-code.entity';

/** Tolerate a modest clock skew between the phone and the server. */
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;
const RECOVERY_CODE_COUNT = 10;

export interface TwoFactorEnrollment {
  /** Shown once, for authenticator apps that can't scan. */
  secret: string;
  otpauthUrl: string;
  /** PNG data URL — the SPA renders it directly, no QR library on the client. */
  qrDataUrl: string;
}

/**
 * TOTP (RFC 6238) second factor, opt-in per user and off until enrollment is
 * confirmed. Secrets are encrypted at rest with a key derived from `JWT_SECRET`,
 * so reading the users table isn't enough to mint codes.
 */
@Injectable()
export class TwoFactorService {
  private readonly key: Buffer;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TwoFactorRecoveryCode)
    private readonly recoveryCodeRepository: Repository<TwoFactorRecoveryCode>,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.key = crypto.scryptSync(
      this.configService.get<string>('JWT_SECRET') ?? 'secretKey',
      'nestplate.two-factor',
      32,
    );
  }

  isEnabled(user: Pick<User, 'twoFactorEnabledAt'>): boolean {
    return !!user.twoFactorEnabledAt;
  }

  /**
   * Generate (or regenerate) a pending secret and the QR to scan. Enrollment
   * isn't live until {@link confirm} proves the user can produce a code, so
   * calling this on an already-enabled account is refused rather than silently
   * replacing a working secret.
   */
  async startEnrollment(userId: number): Promise<TwoFactorEnrollment> {
    const user = await this.getUser(userId);
    if (this.isEnabled(user)) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: this.configService.get<string>('APP_NAME') ?? 'Nestplate',
      label: user.email,
      secret,
    });

    user.twoFactorSecret = this.encrypt(secret);
    user.twoFactorLastStep = null;
    await this.userRepository.save(user);

    return {
      secret,
      otpauthUrl,
      qrDataUrl: await QRCode.toDataURL(otpauthUrl),
    };
  }

  /** Confirm enrollment with a code from the app; returns the recovery codes. */
  async confirm(userId: number, code: string): Promise<Array<string>> {
    const user = await this.getUser(userId);
    if (this.isEnabled(user)) {
      throw new BadRequestException(
        'Two-factor authentication is already enabled',
      );
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Start the setup before confirming it');
    }
    const step = await this.matchTotpStep(user, code);
    if (step === null) {
      throw new UnauthorizedException('That code is not valid');
    }

    user.twoFactorEnabledAt = new Date();
    user.twoFactorLastStep = String(step);
    await this.userRepository.save(user);

    this.eventEmitter.emit('audit.record', {
      action: '2fa.enabled',
      actorId: user.id,
      actorEmail: user.email,
      subjectType: 'user',
      subjectId: user.id,
      summary: 'Turned two-factor authentication on',
    });

    return this.replaceRecoveryCodes(userId);
  }

  /**
   * Turn the second factor off. Requires a current code (or a recovery code) —
   * an unlocked browser alone must not be able to remove it.
   */
  async disable(userId: number, code: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!this.isEnabled(user)) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }
    if (!(await this.verify(userId, code))) {
      throw new UnauthorizedException('That code is not valid');
    }

    user.twoFactorSecret = null;
    user.twoFactorEnabledAt = null;
    user.twoFactorLastStep = null;
    await this.userRepository.save(user);
    await this.recoveryCodeRepository.delete({ userId });

    this.eventEmitter.emit('audit.record', {
      action: '2fa.disabled',
      actorId: user.id,
      actorEmail: user.email,
      subjectType: 'user',
      subjectId: user.id,
      summary: 'Turned two-factor authentication off',
    });
  }

  /**
   * Verify a login challenge: a TOTP code, or one of the single-use recovery
   * codes. Consumes whatever it accepts so neither can be replayed.
   */
  async verify(userId: number, code: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user.twoFactorSecret) return false;

    const step = await this.matchTotpStep(user, code);
    if (step !== null) {
      user.twoFactorLastStep = String(step);
      await this.userRepository.save(user);
      return true;
    }

    return this.consumeRecoveryCode(userId, code);
  }

  /** Issue a fresh set, invalidating any codes the user still had. */
  async replaceRecoveryCodes(userId: number): Promise<Array<string>> {
    await this.recoveryCodeRepository.delete({ userId });

    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      crypto.randomBytes(5).toString('hex').toUpperCase(),
    );

    await this.recoveryCodeRepository.save(
      await Promise.all(
        codes.map(async (code) =>
          this.recoveryCodeRepository.create({
            userId,
            codeHash: await bcrypt.hash(code, 10),
            usedAt: null,
          }),
        ),
      ),
    );

    return codes;
  }

  countUnusedRecoveryCodes(userId: number): Promise<number> {
    return this.recoveryCodeRepository.count({
      where: { userId, usedAt: IsNull() },
    });
  }

  private async consumeRecoveryCode(
    userId: number,
    code: string,
  ): Promise<boolean> {
    const candidates = await this.recoveryCodeRepository.find({
      where: { userId, usedAt: IsNull() },
    });
    const normalized = code.replace(/\s|-/g, '').toUpperCase();

    for (const candidate of candidates) {
      if (await bcrypt.compare(normalized, candidate.codeHash)) {
        candidate.usedAt = new Date();
        await this.recoveryCodeRepository.save(candidate);
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the time-step the code belongs to, or null if it doesn't match.
   * Working in steps (rather than "is it valid right now") is what makes replay
   * detection exact: the same digits stay valid across the tolerance window, so
   * only the step tells us whether they have already been spent — otplib
   * enforces that for us through `afterTimeStep`.
   */
  private async matchTotpStep(
    user: User,
    code: string,
  ): Promise<number | null> {
    if (!user.twoFactorSecret) return null;
    const token = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return null;

    try {
      const result = await verifyTotp({
        secret: this.decrypt(user.twoFactorSecret),
        token,
        epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
        ...(user.twoFactorLastStep !== null
          ? { afterTimeStep: Number(user.twoFactorLastStep) }
          : {}),
      });
      // The result type is a TOTP/HOTP union; only the TOTP arm carries the
      // time step we need for replay protection.
      return result.valid && 'timeStep' in result ? result.timeStep : null;
    } catch {
      return null;
    }
  }

  private async getUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join('.');
  }

  private decrypt(value: string): string {
    const [iv, tag, ciphertext] = value.split('.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
