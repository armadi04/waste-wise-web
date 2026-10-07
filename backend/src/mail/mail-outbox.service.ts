import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { OutboundEmail } from './entities/outbound-email.entity';

export interface OutboundEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Clear the body once delivery succeeds or gives up (one-time codes). */
  redactAfterSend?: boolean;
  /** Drop instead of sending once this passes (a late code is useless and confusing). */
  expiresAt?: Date;
}

const REDACTED_BODY = '[redacted after delivery]';

const MAX_ATTEMPTS = 5;
/** Backoff per attempt number (minutes): ~1m, 5m, 15m, 60m. */
const BACKOFF_MINUTES = [1, 5, 15, 60];
/** How many rows one dispatcher tick claims. */
const BATCH_SIZE = 20;
/** A claimed row is invisible for this long, so a crashed tick retries soon. */
const LEASE_MINUTES = 5;

/**
 * Durable outbox for outbound mail. `MailService` renders the message and drops
 * it here; this service owns delivery, retries and the SMTP transport.
 *
 * The queue is a Postgres table rather than a broker: Redis is optional in this
 * template (the cache falls back to memory), and making mail the one feature
 * that hard-requires it would be a poor trade for a starter. Rows are claimed
 * with `FOR UPDATE SKIP LOCKED`, so several instances can run the dispatcher
 * without sending anything twice.
 */
@Injectable()
export class MailOutboxService {
  private readonly logger = new Logger(MailOutboxService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(
    @InjectRepository(OutboundEmail)
    private readonly outboundEmailRepository: Repository<OutboundEmail>,
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const address =
      configService.get<string>('MAIL_FROM') ?? 'no-reply@example.com';
    const name = configService.get<string>('MAIL_FROM_NAME');
    this.from = name ? `"${name}" <${address}>` : address;

    // Without a host mail stays disabled: the app still boots and messages still
    // queue, but `deliver` fails them fast instead of retrying a server that
    // was never configured.
    const host = configService.get<string>('SMTP_HOST');
    const user = configService.get<string>('SMTP_USER');

    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: configService.get<number>('SMTP_PORT') ?? 587,
          secure: configService.get<boolean>('SMTP_SECURE') ?? false,
          auth: user
            ? { user, pass: configService.get<string>('SMTP_PASS') ?? '' }
            : undefined,
        })
      : null;
  }

  /** Queue a message. Returns as soon as it is durable — delivery happens later. */
  async enqueue(input: OutboundEmailInput): Promise<OutboundEmail> {
    return this.outboundEmailRepository.save(
      this.outboundEmailRepository.create({
        ...input,
        redactAfterSend: input.redactAfterSend ?? false,
        expiresAt: input.expiresAt ?? null,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      }),
    );
  }

  @Cron(CronExpression.EVERY_30_SECONDS, { timeZone: 'UTC' })
  async dispatchPending(): Promise<void> {
    const due = await this.claimDue();
    for (const email of due) {
      await this.deliver(email);
    }
  }

  /**
   * Take the next due rows for this instance alone. The claim and the status
   * flip happen in one transaction, so a row is never picked up twice.
   */
  private async claimDue(): Promise<Array<OutboundEmail>> {
    return this.dataSource.transaction(async (manager) => {
      const due = await manager
        .createQueryBuilder(OutboundEmail, 'email')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('email.status = :status', { status: 'pending' })
        .andWhere('email.nextAttemptAt <= :now', { now: new Date() })
        .orderBy('email.nextAttemptAt', 'ASC')
        .limit(BATCH_SIZE)
        .getMany();

      // Push the claimed rows out of reach for the lease window: if this
      // process dies mid-send, they come back on their own rather than sticking.
      if (due.length) {
        await manager.update(
          OutboundEmail,
          due.map((email) => email.id),
          { nextAttemptAt: new Date(Date.now() + LEASE_MINUTES * 60_000) },
        );
      }
      return due;
    });
  }

  private redaction(email: OutboundEmail) {
    return email.redactAfterSend
      ? { html: REDACTED_BODY, text: REDACTED_BODY }
      : {};
  }

  private async deliver(email: OutboundEmail): Promise<void> {
    if (!this.transporter) {
      await this.outboundEmailRepository.update(email.id, {
        status: 'failed',
        lastError: 'SMTP is not configured (set SMTP_HOST)',
        ...this.redaction(email),
      });
      // Log the row id, not the recipient address.
      this.logger.warn(`Dropping email #${email.id}: SMTP is not configured`);
      return;
    }
    if (email.expiresAt && email.expiresAt <= new Date()) {
      await this.outboundEmailRepository.update(email.id, {
        status: 'failed',
        lastError: 'Expired before delivery',
        ...this.redaction(email),
      });
      return;
    }

    const attempts = email.attempts + 1;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await this.outboundEmailRepository.update(email.id, {
        status: 'sent',
        attempts,
        sentAt: new Date(),
        lastError: null,
        ...this.redaction(email),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = attempts >= MAX_ATTEMPTS;

      await this.outboundEmailRepository.update(email.id, {
        status: exhausted ? 'failed' : 'pending',
        attempts,
        lastError: message,
        nextAttemptAt: this.backoffFrom(attempts),
        ...(exhausted ? this.redaction(email) : {}),
      });

      this.logger.error(
        `Delivery of email #${email.id} failed (attempt ${attempts}/${MAX_ATTEMPTS})${
          exhausted ? ' — giving up' : ''
        }: ${message}`,
      );
    }
  }

  private backoffFrom(attempts: number): Date {
    const minutes =
      BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length) - 1] ?? 60;
    return new Date(Date.now() + minutes * 60_000);
  }
}
