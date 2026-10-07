import { describe, expect, it, mock } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import {
  PortalBookingAdminService,
  PortalBookingSlotAdminService,
} from '@/portal/admin/portal-admin.service';
import { PortalBooking } from '@/portal/bookings/entities/portal-booking.entity';
import { PortalBookingSlot } from '@/portal/bookings/entities/portal-booking-slot.entity';

function fixture(remaining = 0, status = 'Full') {
  const slot = {
    id: 2,
    eventId: 1,
    capacity: 5,
    remaining,
    status,
    startsAt: new Date('2027-01-01T00:00:00Z'),
    endsAt: new Date('2027-01-01T01:00:00Z'),
  };
  const booking = { id: 1, slotId: 2, status: 'Reserved' };
  const builder = (row: object) => {
    const query = {
      setLock: (mode: string) => {
        expect(mode).toBe('pessimistic_write');
        return query;
      },
      where: () => query,
      getOne: async () => ({ ...row }),
    };
    return query;
  };
  const slots = {
    create: (row: object) => row,
    findOne: async () => ({ ...slot }),
    createQueryBuilder: () => builder(slot),
    save: mock(async (row: object) => {
      Object.assign(slot, row);
      return row;
    }),
  };
  const bookings = {
    createQueryBuilder: () => builder(booking),
    save: mock(async (row: object) => {
      Object.assign(booking, row);
      return row;
    }),
    softRemove: mock(async () => {}),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === PortalBooking
        ? bookings
        : entity === PortalBookingSlot
          ? slots
          : { findOne: async () => ({ id: 1, timeZone: 'Asia/Jakarta' }) },
  };
  const transaction = async (run: any) => run(manager);
  return {
    slot,
    booking,
    slots,
    bookings,
    bookingService: new PortalBookingAdminService({
      ...bookings,
      manager: { transaction },
    } as any),
    slotService: new PortalBookingSlotAdminService(
      { ...slots, manager: { transaction } } as any,
      { prepare: async (row: object) => ({ ...row }) } as any,
    ),
  };
}

describe('admin booking inventory', () => {
  it('preserves consumed seats and ignores stale remaining values on capacity edits', async () => {
    const f = fixture(2, 'Available');
    expect(
      await f.slotService.update(2, { capacity: 7, remaining: 5 }),
    ).toMatchObject({ capacity: 7, remaining: 4 });
    await expect(f.slotService.update(2, { capacity: 2 })).rejects.toThrow(
      ConflictException,
    );
  });
  it('derives full availability while preserving the manually closed state', async () => {
    const f = fixture(0);
    expect(
      await f.slotService.update(2, { status: 'Available' }),
    ).toMatchObject({ status: 'Full' });
    expect(
      await f.slotService.update(2, { status: 'Closed', capacity: 6 }),
    ).toMatchObject({ status: 'Closed', remaining: 1 });
  });
  it('returns one seat on cancellation and takes it once on reinstatement', async () => {
    const f = fixture();
    await f.bookingService.update(1, { status: 'Cancelled' });
    expect(f.slot).toMatchObject({ remaining: 1, status: 'Available' });
    await f.bookingService.update(1, { status: 'Cancelled' });
    expect(f.slot.remaining).toBe(1);
    await f.bookingService.update(1, { status: 'Confirmed' });
    expect(f.slot).toMatchObject({ remaining: 0, status: 'Full' });
  });
  it('refuses reinstatement into a full slot before saving the booking', async () => {
    const f = fixture();
    f.booking.status = 'Cancelled';
    await expect(
      f.bookingService.update(1, { status: 'Confirmed' }),
    ).rejects.toThrow(ConflictException);
    expect(f.bookings.save).not.toHaveBeenCalled();
  });
  it('returns seats on soft-delete without reopening a closed slot', async () => {
    const f = fixture(0, 'Closed');
    await f.bookingService.remove(1);
    expect(f.slot).toMatchObject({ remaining: 1, status: 'Closed' });
    expect(f.bookings.softRemove).toHaveBeenCalledTimes(1);
  });
});
