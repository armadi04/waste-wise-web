import { describe, expect, it } from 'bun:test';
import {
  eventAvailability,
  eventAvailabilityLabel,
} from '@/portal/catalog/event-availability';

describe('event availability', () => {
  it.each([
    [0, 'sold-out', 'Tiket habis'],
    [1, 'limited', 'Sisa 1 tiket'],
    [10, 'limited', 'Sisa 10 tiket'],
    [11, 'available', 'Tersedia'],
  ] as const)('classifies stock %i', (stock, state, label) => {
    const availability = eventAvailability([stock]);
    expect(availability).toEqual({ state, remaining: stock });
    expect(eventAvailabilityLabel(availability)).toBe(label);
  });

  it('rejects corrupt stock rather than returning an invalid public contract', () => {
    for (const stock of [-1, 1.5, NaN, Infinity])
      expect(() => eventAvailability([stock])).toThrow();
  });

  it('sums stock across categories including sold-out categories', () => {
    expect(eventAvailability([0, 6, 5])).toEqual({
      state: 'available',
      remaining: 11,
    });
    expect(eventAvailability([0, 6, 4])).toEqual({
      state: 'limited',
      remaining: 10,
    });
    expect(eventAvailability([0, 0])).toEqual({
      state: 'sold-out',
      remaining: 0,
    });
  });

  it('distinguishes an unconfigured event from a sold-out event', () => {
    const availability = eventAvailability([]);
    expect(availability).toEqual({ state: 'unavailable', remaining: 0 });
    expect(eventAvailabilityLabel(availability)).toBe('Tiket belum tersedia');
  });
});
