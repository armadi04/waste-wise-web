import { describe, expect, it } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import type { CreatePortalOrderDto } from '@/portal/commerce/dto/order.dto';

function fixture(stock = 1) {
  const state = { stock, orders: [] as any[], locks: [] as string[] };
  const queues = new Map<string, Promise<void>>();
  const service = Object.create(
    PortalCommerceService.prototype,
  ) as PortalCommerceService;
  Object.assign(service, {
    campaigns: { lockCommerce: async () => {}, assertPromoOwner: () => {} },
    dataSource: {
      transaction: async (run: (manager: any) => Promise<any>) => {
        const release: Array<() => void> = [];
        let nextStock = state.stock;
        const pending: any[] = [];
        const lock = async (key: string) => {
          const before = queues.get(key) ?? Promise.resolve();
          let unlock!: () => void;
          const after = new Promise<void>((resolve) => {
            unlock = resolve;
          });
          queues.set(key, after);
          await before;
          release.push(unlock);
          state.locks.push(key);
        };
        const event = {
          id: 1,
          slug: 'jazz',
          title: 'Jazz',
          imageUrl: '',
          active: true,
          startsAt: new Date('2099-01-01'),
        };
        const ticket = () => ({
          id: 2,
          eventId: 1,
          name: 'Regular',
          price: 100,
          stockRemaining: nextStock,
          stockTotal: stock,
        });
        const manager = {
          query: async (sql: string, values: string[]) => {
            if (sql.includes('clock_timestamp')) return [{ now: new Date() }];
            expect(sql).toContain('pg_advisory_xact_lock');
            await lock(`order:${values.join(':')}`);
          },
          getRepository: (entity: unknown) => {
            if (entity === PortalEvent) return { findOneBy: async () => event };
            if (entity === PortalEventTicket)
              return {
                findOne: async (options: any) => {
                  expect(options.lock.mode).toBe('pessimistic_write');
                  await lock('ticket:2');
                  nextStock = state.stock;
                  return ticket();
                },
                findOneBy: async () => ticket(),
                save: async (row: any) => {
                  nextStock = row.stockRemaining;
                  return row;
                },
              };
            if (entity === PortalOrder)
              return {
                createQueryBuilder: () => {
                  const query: any = {};
                  let orderNumber = '';
                  query.setLock = (mode: string) => {
                    expect(mode).toBe('pessimistic_write');
                    return query;
                  };
                  query.where = () => query;
                  query.andWhere = (_sql: string, params: any) => {
                    orderNumber = params.orderNumber;
                    return query;
                  };
                  query.getOne = async () => {
                    await lock(`existing-order:${orderNumber}`);
                    const row = state.orders.find(
                      (order) => order.orderNumber === orderNumber,
                    );
                    return row ? { ...row } : null;
                  };
                  return query;
                },
                findOneBy: async (where: any) =>
                  state.orders.find(
                    (row) =>
                      row.userId === where.userId &&
                      row.idempotencyKey === where.idempotencyKey,
                  ),
                find: async (options: any) =>
                  state.orders.filter(
                    (row) => row.userId === options.where.userId,
                  ),
                create: (row: any) => row,
                save: async (row: any) => {
                  const saved = {
                    ...row,
                    id: row.id ?? state.orders.length + 1,
                  };
                  pending.push(saved);
                  return saved;
                },
              };
            if (entity === PortalPromoCode)
              return { findOne: async () => null };
            return {
              findOneBy: async () => ({
                productType: 'ticket',
                productId: 2,
                quantity: 1,
              }),
              find: async () => [
                { id: 1, productType: 'ticket', productId: 2, quantity: 1 },
              ],
              update: async () => {},
              findOne: async () => null,
              create: (row: any) => row,
              save: async (row: any) => row,
            };
          },
        };
        try {
          const result = await run(manager);
          if (pending.length) {
            state.stock = nextStock;
            for (const row of pending) {
              const index = state.orders.findIndex(
                (order) => order.id === row.id,
              );
              if (index === -1) state.orders.push(row);
              else state.orders[index] = row;
            }
          }
          return result;
        } finally {
          for (const unlock of release.reverse()) unlock();
        }
      },
    },
  });
  const dto = {
    kind: 'ticket',
    slug: 'jazz',
    ticketType: 'Regular',
    attendee: 'Nadia',
    email: 'n@example.com',
    phone: '0812',
  } as CreatePortalOrderDto;
  return { state, service, dto };
}

describe('event checkout stock transactions', () => {
  it('allows only one order for the final ticket under concurrent buyers', async () => {
    const { state, service, dto } = fixture();
    const results = await Promise.allSettled([
      service.createOrder(1, dto, 'one'),
      service.createOrder(2, dto, 'two'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(ConflictException);
    expect(state.stock).toBe(0);
    expect(state.orders).toHaveLength(1);
    expect(state.locks.filter((key) => key === 'ticket:2')).toHaveLength(2);
  });

  it('serializes identical retries before checking stock and returns the same order', async () => {
    const { state, service, dto } = fixture();
    const results = await Promise.all([
      service.createOrder(1, dto, 'same'),
      service.createOrder(1, dto, 'same'),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(state.stock).toBe(0);
    expect(state.orders).toHaveLength(1);
    expect(state.locks.filter((key) => key === 'ticket:2')).toHaveLength(1);
  });

  it('rolls back reserved stock when later validation fails', async () => {
    const { state, service, dto } = fixture();
    await expect(
      service.createOrder(1, { ...dto, promoCode: 'INVALID' }, 'bad'),
    ).rejects.toThrow('Promo code not found');
    expect(state.stock).toBe(1);
    expect(state.orders).toHaveLength(0);
    await service.createOrder(2, dto, 'good');
    expect(state.stock).toBe(0);
  });
});

it('restores cancelled ticket stock under the row lock only once for repeated cancellation', async () => {
  const { state, service, dto } = fixture();
  const order = await service.createOrder(1, dto, 'purchase');
  expect(state.stock).toBe(0);
  const results = await Promise.all([
    service.cancelOrder(1, order.id),
    service.cancelOrder(1, order.id),
  ]);
  expect(results.every((result) => result.status === 'Cancelled')).toBe(true);
  expect(state.stock).toBe(1);
  expect(state.orders).toHaveLength(1);
  expect(state.locks.filter((key) => key === 'ticket:2')).toHaveLength(2);
});
