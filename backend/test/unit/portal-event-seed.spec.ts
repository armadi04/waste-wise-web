import { describe, expect, it } from 'bun:test';
import { DEMO_EVENT_SEEDS } from '@/portal/seed/portal-event-seed.data';
import { PortalSeedService } from '@/portal/seed/portal-seed.service';

function repository() {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    create: (data: Record<string, unknown>) => ({ ...data }),
    findOneBy: async (where: Record<string, unknown>) =>
      rows.find((row) =>
        Object.entries(where).every(([key, value]) =>
          row[key] instanceof Date && value instanceof Date
            ? row[key].getTime() === value.getTime()
            : row[key] === value,
        ),
      ),
    save: async (data: Record<string, unknown>) => {
      const row = { ...data, id: rows.length + 1 };
      rows.push(row);
      return row;
    },
  };
}

describe('local event fixtures', () => {
  it('provides 15 complete, distinct events with valid related stock and schedules', () => {
    expect(DEMO_EVENT_SEEDS).toHaveLength(15);
    expect(new Set(DEMO_EVENT_SEEDS.map((s) => s.event.slug)).size).toBe(15);
    expect(new Set(DEMO_EVENT_SEEDS.map((s) => s.event.city)).size).toBe(7);
    expect(new Set(DEMO_EVENT_SEEDS.map((s) => s.event.timeZone)).size).toBe(3);
    for (const seed of DEMO_EVENT_SEEDS) {
      for (const key of [
        'slug',
        'title',
        'type',
        'city',
        'timeZone',
        'venue',
        'dateLabel',
        'monthLabel',
        'dayLabel',
        'timeLabel',
        'statusLabel',
        'imageUrl',
        'description',
      ] as const)
        expect(seed.event[key].length).toBeGreaterThan(0);
      expect(seed.event.title.startsWith('[Demo]')).toBe(true);
      expect(seed.event.active).toBe(true);
      expect(Number.isFinite(seed.event.startsAt.getTime())).toBe(true);
      expect(seed.event.imageUrl.length).toBeLessThanOrEqual(255);
      expect(seed.tickets).toHaveLength(3);
      expect(Math.min(...seed.tickets.map((t) => t.price))).toBe(
        seed.event.basePrice,
      );
      for (const ticket of seed.tickets) {
        expect(ticket.stockRemaining).toBeGreaterThanOrEqual(0);
        expect(ticket.stockRemaining).toBeLessThanOrEqual(ticket.stockTotal);
      }
      expect(seed.slots).toHaveLength(2);
      expect(seed.slots[0].offsetMinutes).toBeLessThan(
        seed.slots[1].offsetMinutes,
      );
      for (const slot of seed.slots) {
        expect(slot.remaining).toBeGreaterThanOrEqual(0);
        expect(slot.remaining).toBeLessThanOrEqual(slot.capacity);
      }
    }
    const soldOut = DEMO_EVENT_SEEDS.filter(
      (s) => s.event.statusLabel === 'Tiket habis',
    );
    expect(soldOut).toHaveLength(1);
    expect(soldOut[0].tickets.every((t) => t.stockRemaining === 0)).toBe(true);
    expect(soldOut[0].slots.every((s) => s.remaining === 0)).toBe(true);
  });

  it('seeds relationships without duplicates or restoring consumed stock on rerun', async () => {
    const events = repository();
    const tickets = repository();
    const bookingSlots = repository();
    const service = Object.assign(Object.create(PortalSeedService.prototype), {
      events,
      tickets,
      bookingSlots,
    }) as {
      seedEvents: () => Promise<Array<Record<string, unknown>>>;
      seedTickets: (events: Array<Record<string, unknown>>) => Promise<void>;
      seedBookingSlots: (
        events: Array<Record<string, unknown>>,
      ) => Promise<void>;
    };
    const first = await service.seedEvents();
    await service.seedTickets(first);
    await service.seedBookingSlots(first);
    expect(events.rows).toHaveLength(18);
    expect(tickets.rows).toHaveLength(54);
    expect(bookingSlots.rows).toHaveLength(33);
    tickets.rows[4].stockRemaining = 1;
    bookingSlots.rows[4].remaining = 0;
    const second = await service.seedEvents();
    await service.seedTickets(second);
    await service.seedBookingSlots(second);
    expect(events.rows).toHaveLength(18);
    expect(tickets.rows).toHaveLength(54);
    expect(bookingSlots.rows).toHaveLength(33);
    expect(tickets.rows[4].stockRemaining).toBe(1);
    expect(bookingSlots.rows[4].remaining).toBe(0);
  });
});
