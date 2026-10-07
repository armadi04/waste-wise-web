import { PortalBookingsService } from '@/portal/bookings/portal-bookings.service';
import { describe, expect, it, jest } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';

const follow = {
  targetType: 'event',
  targetKey: 'jazz-night',
  targetName: 'Jazz Night',
  imageUrl: 'https://cdn.test/jazz.jpg',
};

describe('following', () => {
  it('restores a soft-deleted follow instead of inserting a duplicate', async () => {
    const builder = {
      insert: jest.fn(() => builder),
      into: jest.fn(() => builder),
      values: jest.fn(() => builder),
      orUpdate: jest.fn(() => builder),
      returning: jest.fn(() => builder),
      execute: jest.fn().mockResolvedValue({
        raw: [{ id: 3, userId: 7, ...follow, deletedAt: null }],
      }),
    };
    const service = Object.assign(
      Object.create(PortalCustomerService.prototype),
      {
        followRepository: {
          createQueryBuilder: () => builder,
          create: (value: unknown) => value,
        },
      },
    ) as PortalCustomerService;

    const result = await service.addFollowing(7, follow);

    expect(builder.values).toHaveBeenCalledWith({
      userId: 7,
      ...follow,
      deletedAt: null,
    });
    expect(builder.orUpdate).toHaveBeenCalledWith(
      ['targetName', 'imageUrl', 'deletedAt', 'updatedAt'],
      ['userId', 'targetType', 'targetKey'],
    );
    expect(result).toMatchObject({ id: 3, deletedAt: null });
  });
});

describe('booking slots', () => {
  it('lists only slots that have not started', async () => {
    const find = jest.fn().mockResolvedValue([]);
    const service = Object.assign(
      Object.create(PortalBookingsService.prototype),
      {
        eventRepository: {
          findOneBy: () => Promise.resolve({ id: 1, timeZone: 'Asia/Jakarta' }),
        },
        bookingSlotRepository: { find },
      },
    ) as PortalBookingsService;
    await service.listBookingSlots('jazz-night');
    const where = (find.mock.calls[0][0] as { where: { startsAt: unknown } })
      .where;
    expect(where.startsAt).toBeInstanceOf(FindOperator);
    expect((where.startsAt as FindOperator<Date>).type).toBe('moreThan');
  });

  it('refuses a slot that already started', async () => {
    const save = jest.fn();
    const slot = {
      id: 5,
      startsAt: new Date(Date.now() - 60_000),
      remaining: 3,
      status: 'Available',
    };
    const query = {
      setLock: () => query,
      where: () => query,
      getOne: () => Promise.resolve(slot),
    };
    const manager = {
      getRepository: () => ({
        findOneBy: () => Promise.resolve({ id: 1, slug: 'jazz-night' }),
        createQueryBuilder: () => query,
        save,
      }),
    };
    const service = Object.assign(
      Object.create(PortalBookingsService.prototype),
      {
        dataSource: {
          transaction: (work: (m: typeof manager) => unknown) => work(manager),
        },
      },
    ) as PortalBookingsService;
    await expect(
      service.createBooking(7, { eventSlug: 'jazz-night', slotId: 5 } as never),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(save).not.toHaveBeenCalled();
  });
});
