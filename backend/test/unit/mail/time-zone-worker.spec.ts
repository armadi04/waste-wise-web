import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, jest, setSystemTime } from 'bun:test';
import { DataSource, Repository } from 'typeorm';
import { MailOutboxService } from '@/mail/mail-outbox.service';
import { OutboundEmail } from '@/mail/entities/outbound-email.entity';
import { AvatarCleanupService } from '@/media/avatar-cleanup.service';

afterEach(() => setSystemTime());
describe('Technical worker timezones', () => {
  it('pins mail and avatar cron to UTC independently of business zones', () => {
    for (const worker of [MailOutboxService, AvatarCleanupService]) {
      expect(
        Reflect.getMetadata(
          'SCHEDULE_CRON_OPTIONS',
          worker.prototype.dispatchPending,
        ).timeZone,
      ).toBe('UTC');
    }
  });
  it('retries against absolute time and stops sending after successful delivery', async () => {
    const now = Date.parse('2026-10-02T16:00:42.123Z');
    setSystemTime(new Date(now));
    const row = {
      id: 1,
      to: 'worker@example.test',
      subject: 'Test',
      html: 'Test',
      text: 'Test',
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(now),
    } as OutboundEmail;
    const update = jest.fn(
      async (_id: number, fields: Partial<OutboundEmail>) =>
        Object.assign(row, fields),
    );
    const repository = { update } as unknown as Repository<OutboundEmail>;
    const lock = jest.fn();
    const query = {
      setLock: (value: string) => {
        lock(value);
        return query;
      },
      setOnLocked: (value: string) => {
        lock(value);
        return query;
      },
      where: () => query,
      andWhere: () => query,
      orderBy: () => query,
      limit: () => query,
      getMany: async () =>
        row.status === 'pending' && row.nextAttemptAt.getTime() <= Date.now()
          ? [{ ...row }]
          : [],
    };
    const source = {
      transaction: async (run: (manager: unknown) => Promise<unknown>) =>
        run({
          createQueryBuilder: () => query,
          update: async (
            _entity: unknown,
            _ids: unknown,
            fields: Partial<OutboundEmail>,
          ) => Object.assign(row, fields),
        }),
    } as unknown as DataSource;
    const service = new MailOutboxService(repository, source, {
      get: () => undefined,
    } as unknown as ConfigService);
    const sendMail = jest
      .fn()
      .mockRejectedValueOnce(new Error('Temporary SMTP failure'))
      .mockResolvedValue({});
    Reflect.set(service, 'transporter', { sendMail });
    await service.dispatchPending();
    expect(row.nextAttemptAt.toISOString()).toBe('2026-10-02T16:01:42.123Z');
    expect(row.attempts).toBe(1);
    await service.dispatchPending();
    expect(sendMail).toHaveBeenCalledTimes(1);
    setSystemTime(new Date(now + 60_000));
    await service.dispatchPending();
    expect(row.status).toBe('sent');
    expect(row.sentAt?.toISOString()).toBe('2026-10-02T16:01:42.123Z');
    await service.dispatchPending();
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(lock).toHaveBeenCalledWith('pessimistic_write');
    expect(lock).toHaveBeenCalledWith('skip_locked');
  });
});
