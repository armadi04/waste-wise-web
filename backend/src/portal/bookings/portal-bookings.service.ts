import { MoreThan } from 'typeorm';
import { BUSINESS_TIME_ZONE } from '@/common/utils/business-time';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalBookingSlot } from '@/portal/bookings/entities/portal-booking-slot.entity';
import { PortalBooking } from '@/portal/bookings/entities/portal-booking.entity';
import { CreatePortalBookingDto } from '@/portal/bookings/dto/booking.dto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PortalBookingsService {
  constructor(
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    @InjectRepository(PortalBookingSlot)
    private readonly bookingSlotRepository: Repository<PortalBookingSlot>,
    @InjectRepository(PortalBooking)
    private readonly bookingRepository: Repository<PortalBooking>,
    private readonly dataSource: DataSource,
  ) {}
  async listBookingSlots(slug: string) {
    const event = await this.eventRepository.findOneBy({ slug, active: true });
    if (!event) throw new NotFoundException('Event not found');
    // Slots that already started can't be reserved, so they aren't offered.
    const slots = await this.bookingSlotRepository.find({
      where: { eventId: event.id, startsAt: MoreThan(new Date()) },
      order: { startsAt: 'ASC' },
    });
    return slots.map((slot) => ({ ...slot, timeZone: event.timeZone }));
  }

  async createBooking(userId: number, dto: CreatePortalBookingDto) {
    return this.dataSource.transaction(async (manager) => {
      const event = await manager
        .getRepository(PortalEvent)
        .findOneBy({ slug: dto.eventSlug, active: true });
      if (!event) throw new NotFoundException('Event not found');
      const slots = manager.getRepository(PortalBookingSlot);
      const slot = await slots
        .createQueryBuilder('slot')
        .setLock('pessimistic_write')
        .where('slot.id = :id AND slot.eventId = :eventId', {
          id: dto.slotId,
          eventId: event.id,
        })
        .getOne();
      if (!slot) throw new NotFoundException('Booking slot not found');
      if (slot.startsAt <= new Date())
        throw new ConflictException('Booking slot has already started');
      const bookings = manager.getRepository(PortalBooking);
      const existing = await bookings.findOneBy({
        userId,
        slotId: slot.id,
      });
      if (existing && existing.status !== 'Cancelled')
        return this.serializeBooking(existing, event, slot);
      if (slot.remaining < 1 || slot.status !== 'Available') {
        throw new ConflictException('Booking slot is full');
      }
      slot.remaining -= 1;
      if (!slot.remaining) slot.status = 'Full';
      await slots.save(slot);
      const booking = existing
        ? await bookings.save({
            ...existing,
            attendee: dto.attendee,
            status: 'Reserved',
          })
        : await bookings.save(
            bookings.create({
              userId,
              eventId: event.id,
              slotId: slot.id,
              attendee: dto.attendee,
              status: 'Reserved',
            }),
          );
      return this.serializeBooking(booking, event, slot);
    });
  }

  async cancelBooking(userId: number, id: number) {
    return this.dataSource.transaction(async (manager) => {
      const bookings = manager.getRepository(PortalBooking);
      const booking = await bookings
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id AND booking.userId = :userId', { id, userId })
        .getOne();
      if (!booking) throw new NotFoundException('Booking not found');
      const event = await manager.getRepository(PortalEvent).findOneBy({
        id: booking.eventId,
      });
      const slots = manager.getRepository(PortalBookingSlot);
      const slot = await slots
        .createQueryBuilder('slot')
        .setLock('pessimistic_write')
        .where('slot.id = :id', { id: booking.slotId })
        .getOne();
      if (!slot) throw new NotFoundException('Booking slot not found');
      if (booking.status === 'Cancelled')
        return this.serializeBooking(booking, event ?? undefined, slot);
      if (booking.status !== 'Reserved')
        throw new ConflictException('Booking cannot be cancelled');

      slot.remaining = Math.min(slot.capacity, slot.remaining + 1);
      if (slot.status === 'Full') slot.status = 'Available';
      await slots.save(slot);
      booking.status = 'Cancelled';
      await bookings.save(booking);
      return this.serializeBooking(booking, event ?? undefined, slot);
    });
  }

  async listBookings(userId: number) {
    const bookings = await this.bookingRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const [events, slots] = await Promise.all([
      this.eventRepository.findBy({
        id: In(bookings.map((item) => item.eventId)),
      }),
      this.bookingSlotRepository.findBy({
        id: In(bookings.map((item) => item.slotId)),
      }),
    ]);
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const slotsById = new Map(slots.map((slot) => [slot.id, slot]));
    return bookings.map((booking) =>
      this.serializeBooking(
        booking,
        eventsById.get(booking.eventId),
        slotsById.get(booking.slotId),
      ),
    );
  }

  private serializeBooking(
    booking: PortalBooking,
    event?: PortalEvent,
    slot?: PortalBookingSlot,
  ) {
    return {
      id: booking.id,
      publicId: booking.publicId,
      eventSlug: event?.slug ?? '',
      eventTitle: event?.title ?? 'Event',
      venue: event?.venue ?? '',
      slotId: booking.slotId,
      timeZone: event?.timeZone ?? BUSINESS_TIME_ZONE,
      startsAt: slot?.startsAt ?? null,
      endsAt: slot?.endsAt ?? null,
      attendee: booking.attendee,
      status: booking.status,
      createdAt: booking.createdAt,
    };
  }
}
