import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveTurnstileConfig } from '@/auth/turnstile-config';

export type TurnstileAction = 'admin-login' | 'portal-email-otp';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly config: ReturnType<typeof resolveTurnstileConfig>;

  constructor(configService: ConfigService) {
    this.config = resolveTurnstileConfig({
      NODE_ENV: configService.get<string>('NODE_ENV'),
      TURNSTILE_ENABLED: configService.get<boolean | string>(
        'TURNSTILE_ENABLED',
      ),
      TURNSTILE_SECRET: configService.get<string>('TURNSTILE_SECRET'),
      TURNSTILE_SECRET_KEY: configService.get<string>('TURNSTILE_SECRET_KEY'),
      TURNSTILE_ALLOWED_HOSTNAMES: configService.get<string>(
        'TURNSTILE_ALLOWED_HOSTNAMES',
      ),
    });
  }

  private reject(action: TurnstileAction, reason: string): never {
    this.logger.warn({
      event: 'turnstile.verification',
      outcome: 'rejected',
      action,
      reason,
    });
    throw new BadRequestException(
      'Security verification failed. Please try again.',
    );
  }

  private unavailable(action: TurnstileAction, reason: string): never {
    this.logger.warn({
      event: 'turnstile.verification',
      outcome: 'unavailable',
      action,
      reason,
    });
    throw new ServiceUnavailableException(
      'Security verification service unavailable',
    );
  }

  async verify(
    token: string,
    ip: string | undefined,
    action: TurnstileAction,
  ): Promise<void> {
    if (!this.config.enabled) return;
    if (!token.trim() || token.length > 2048)
      this.reject(action, 'invalid-input');
    const body = new URLSearchParams({
      secret: this.config.secret!,
      response: token,
    });
    if (ip) body.append('remoteip', ip);
    let response: Response;
    try {
      response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch {
      this.unavailable(action, 'network-or-timeout');
    }
    if (!response.ok) this.unavailable(action, 'provider-http-error');
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      this.unavailable(action, 'invalid-response');
    }
    if (
      !value ||
      typeof value !== 'object' ||
      !('success' in value) ||
      typeof value.success !== 'boolean'
    ) {
      this.unavailable(action, 'invalid-response');
    }
    if (!value.success) {
      const errors: Array<unknown> =
        'error-codes' in value && Array.isArray(value['error-codes'])
          ? value['error-codes']
          : [];
      if (
        errors.some((code) =>
          [
            'internal-error',
            'invalid-input-secret',
            'missing-input-secret',
          ].includes(typeof code === 'string' ? code : ''),
        )
      ) {
        this.unavailable(action, 'provider-or-secret-error');
      }
      const reason = errors.includes('timeout-or-duplicate')
        ? 'expired-or-duplicate'
        : 'challenge-failed';
      this.reject(action, reason);
    }
    // Official dummy keys exercise provider success/failure, not production origin/action isolation.
    if (!this.config.testSecret) {
      if (!('action' in value) || value.action !== action)
        this.reject(action, 'action-mismatch');
      if (
        this.config.hostnames.length > 0 &&
        (!('hostname' in value) ||
          typeof value.hostname !== 'string' ||
          !this.config.hostnames.includes(value.hostname.toLowerCase()))
      ) {
        this.reject(action, 'hostname-mismatch');
      }
    }
    this.logger.log({
      event: 'turnstile.verification',
      outcome: 'verified',
      action,
    });
  }
}
