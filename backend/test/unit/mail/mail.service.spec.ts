import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { MailService } from '../../../src/mail/mail.service';
import { MailOutboxService } from '../../../src/mail/mail-outbox.service';

describe('MailService', () => {
  let service: MailService;
  let enqueue: jest.Mock;

  beforeEach(async () => {
    enqueue = jest.fn().mockResolvedValue({ id: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailOutboxService, useValue: { enqueue } },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('queues the verification email with the verify link', async () => {
    await service.sendVerificationEmail('user@b.com', 'http://verify/abc');

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [message] = enqueue.mock.calls[0] as [
      { to: string; subject: string; html: string; text: string },
    ];
    expect(message.to).toBe('user@b.com');
    expect(message.subject).toMatch(/verifikasi/i);
    expect(message.html).toContain('http://verify/abc');
    expect(message.html).toContain('Poppins');
    expect(message.html).toContain('#CA2222');
    expect(message.html).toContain('lang="id"');
  });

  it('queues the invitation email with the invite link', async () => {
    await service.sendInvitationEmail('user@b.com', 'http://invite/abc');

    const [message] = enqueue.mock.calls[0] as [
      { subject: string; text: string },
    ];
    expect(message.subject).toMatch(/undangan/i);
    expect(message.text).toContain('http://invite/abc');
  });

  it('queues the password reset email with the reset link', async () => {
    await service.sendPasswordReset('user@b.com', 'http://reset/abc');

    const [message] = enqueue.mock.calls[0] as [
      { subject: string; html: string },
    ];
    expect(message.subject).toMatch(/password/i);
    expect(message.html).toContain('http://reset/abc');
  });

  it('queues the OTP email with the one-time code', async () => {
    await service.sendLoginOtp('user@b.com', '123456');

    const [message] = enqueue.mock.calls[0] as [
      { subject: string; html: string; text: string },
    ];
    expect(message.subject).toBe(
      `Kode masuk ${process.env.APP_NAME || 'WasteWise'}`,
    );
    expect(message.html).toContain('123456');
    expect(message.html).toContain('10 menit');
    expect(message.text).toContain('123456');
  });

  it('escapes dynamic URLs in HTML attributes and content', async () => {
    const maliciousUrl = 'https://example.test/?a="&b=<script>';

    await service.sendVerificationEmail('user@b.com', maliciousUrl);

    const [message] = enqueue.mock.calls[0] as [{ html: string }];
    expect(message.html).toContain(
      'https://example.test/?a=&quot;&amp;b=&lt;script&gt;',
    );
    expect(message.html).not.toContain('<script>');
  });
});
