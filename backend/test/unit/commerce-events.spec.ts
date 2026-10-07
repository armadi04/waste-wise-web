import { describe, expect, it, mock } from 'bun:test';
import type { DataSource } from 'typeorm';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { deliverCommerceEvents } from '@/portal/commerce/commerce-events';

describe('commerce outbox delivery', () => {
  it('records listener failures without blocking later events and stops retrying after five failures', async () => {
    const rows = [
      {
        id: 1,
        operationKey: 'bad',
        eventName: 'bad',
        payload: {},
        attempts: 0,
        deliveredAt: null,
        failedAt: null,
        lastError: null,
      },
      {
        id: 2,
        operationKey: 'good',
        eventName: 'good',
        payload: { userId: 7 },
        attempts: 0,
        deliveredAt: null,
        failedAt: null,
        lastError: null,
      },
    ];
    const save = mock(async () => undefined);
    const repo = {
      find: async (options: any) => {
        expect(options.lock.mode).toBe('pessimistic_write');
        expect(options.take).toBe(100);
        return rows.filter((row) => !row.deliveredAt && !row.failedAt);
      },
      save,
    };
    const source = {
      transaction: async (run: any) => run({ getRepository: () => repo }),
    } as unknown as DataSource;
    const emitAsync = mock(async (name: string) => {
      if (name === 'bad') throw new Error('Listener unavailable');
      return [];
    });
    const events = { emitAsync } as unknown as EventEmitter2;
    expect(await deliverCommerceEvents(source, events)).toBe(2);
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toBe('Listener unavailable');
    expect(rows[1].deliveredAt).toBeInstanceOf(Date);
    expect(emitAsync).toHaveBeenCalledWith('good', {
      userId: 7,
      eventId: 'good',
    });
    for (let attempt = 1; attempt < 5; attempt++)
      await deliverCommerceEvents(source, events);
    expect(rows[0].failedAt).toBeInstanceOf(Date);
    expect(rows[0].attempts).toBe(5);
    expect(await deliverCommerceEvents(source, events)).toBe(0);
    expect(emitAsync).toHaveBeenCalledTimes(6);
    expect(save).toHaveBeenCalledTimes(6);
  });

  it('returns zero when the outbox transaction fails so a later worker can retry', async () => {
    const source = {
      transaction: async () => {
        throw new Error('Database unavailable');
      },
    } as unknown as DataSource;
    const emitAsync = mock(async () => []);
    expect(
      await deliverCommerceEvents(source, {
        emitAsync,
      } as unknown as EventEmitter2),
    ).toBe(0);
    expect(emitAsync).not.toHaveBeenCalled();
  });
});
