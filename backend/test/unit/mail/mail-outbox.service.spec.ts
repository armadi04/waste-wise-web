import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { MailOutboxService } from '../../../src/mail/mail-outbox.service';
import { OutboundEmail } from '../../../src/mail/entities/outbound-email.entity';

interface MailTransport {
  sendMail: jest.Mock;
}

describe('MailOutboxService', () => {
  let service: MailOutboxService;
  let repository: { create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let sendMail: jest.Mock;

  const message = {
    to: 'user@b.com',
    subject: 'Hello',
    html: '<p>Hello</p>',
    text: 'Hello',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
      update: jest.fn(() => Promise.resolve({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailOutboxService,
        { provide: getRepositoryToken(OutboundEmail), useValue: repository },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SMTP_HOST') return 'smtp.test.com';
              if (key === 'SMTP_PORT') return 587;
              if (key === 'SMTP_USER') return 'user@test.com';
              if (key === 'SMTP_PASS') return 'test-pass';
              if (key === 'MAIL_FROM') return 'no-reply@test.com';
              if (key === 'MAIL_FROM_NAME') return 'Nestplate';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MailOutboxService);
    // The real transport is built in the constructor (network-free). Swap it for
    // a fake so no SMTP connection is ever opened during the tests.
    sendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
    (service as unknown as { transporter: MailTransport }).transporter = {
      sendMail,
    };
  });

  it('queues a message as pending, due immediately', async () => {
    await service.enqueue(message);

    const [row] = repository.save.mock.calls[0] as [
      { status: string; attempts: number; nextAttemptAt: Date },
    ];
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(row.nextAttemptAt).toBeInstanceOf(Date);
  });

  const queued = (overrides: Partial<OutboundEmail> = {}) =>
    ({ id: 1, ...message, attempts: 0, ...overrides }) as OutboundEmail;

  it('marks a delivered message sent', async () => {
    await (
      service as unknown as { deliver: (e: OutboundEmail) => Promise<void> }
    ).deliver(queued());

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      from: '"Nestplate" <no-reply@test.com>',
      to: message.to,
    });
    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; sentAt: Date },
    ];
    expect(update.status).toBe('sent');
    expect(update.sentAt).toBeInstanceOf(Date);
  });

  it('leaves a failed message pending for another try', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));

    await (
      service as unknown as { deliver: (e: OutboundEmail) => Promise<void> }
    ).deliver(queued());

    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; attempts: number; lastError: string },
    ];
    expect(update.status).toBe('pending');
    expect(update.attempts).toBe(1);
    expect(update.lastError).toBe('smtp down');
  });

  it('gives up once the attempts are exhausted', async () => {
    sendMail.mockRejectedValue(new Error('smtp down'));

    await (
      service as unknown as { deliver: (e: OutboundEmail) => Promise<void> }
    ).deliver(queued({ attempts: 4 }));

    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; attempts: number },
    ];
    expect(update.status).toBe('failed');
    expect(update.attempts).toBe(5);
  });

  it('fails fast when SMTP is not configured, without retrying', async () => {
    const unconfigured = await Test.createTestingModule({
      providers: [
        MailOutboxService,
        { provide: getRepositoryToken(OutboundEmail), useValue: repository },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    const bare = unconfigured.get(MailOutboxService);

    await (
      bare as unknown as { deliver: (e: OutboundEmail) => Promise<void> }
    ).deliver(queued());

    expect(sendMail).not.toHaveBeenCalled();
    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; lastError: string },
    ];
    expect(update.status).toBe('failed');
    expect(update.lastError).toContain('SMTP is not configured');
  });

  const deliver = (email: OutboundEmail) =>
    (
      service as unknown as { deliver: (e: OutboundEmail) => Promise<void> }
    ).deliver(email);

  it('clears a one-time code from the outbox once it is delivered', async () => {
    await deliver(queued({ redactAfterSend: true }));
    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; html: string; text: string },
    ];
    expect(update.status).toBe('sent');
    expect(update.html).not.toContain('Hello');
    expect(update.text).not.toContain('Hello');
  });

  it('keeps ordinary mail bodies after delivery', async () => {
    await deliver(queued());
    const [, update] = repository.update.mock.calls[0] as [
      number,
      Record<string, unknown>,
    ];
    expect(update).not.toHaveProperty('html');
  });

  it('drops a code that expired while queued instead of sending it late', async () => {
    await deliver(
      queued({
        redactAfterSend: true,
        expiresAt: new Date(Date.now() - 1000),
      }),
    );
    expect(sendMail).not.toHaveBeenCalled();
    const [, update] = repository.update.mock.calls[0] as [
      number,
      { status: string; lastError: string; text: string },
    ];
    expect(update.status).toBe('failed');
    expect(update.lastError).toBe('Expired before delivery');
    expect(update.text).not.toContain('Hello');
  });

  it('stores the redaction flag and expiry when queueing', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await service.enqueue({ ...message, redactAfterSend: true, expiresAt });
    expect(repository.save.mock.calls[0][0]).toMatchObject({
      redactAfterSend: true,
      expiresAt,
    });
  });
});
