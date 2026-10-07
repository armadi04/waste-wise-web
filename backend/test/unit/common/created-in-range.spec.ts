import { describe, it, expect } from 'bun:test';
import {
  createdInRange,
  type CreatedInPreset,
} from '@/common/helpers/created-in-range';

describe('creation windows in WIB', () => {
  it.each([
    ['today', '2026-09-30T17:00:00.000Z'],
    ['7d', '2026-09-24T17:00:00.000Z'],
    ['1m', '2026-08-31T17:00:00.000Z'],
    ['3m', '2026-07-02T17:00:00.000Z'],
  ])(
    '%s includes its lower boundary and ends at exclusive next local midnight',
    (preset, expected) => {
      const now = new Date('2026-10-01T03:00:00Z');
      const range = createdInRange(preset as CreatedInPreset, now)!;
      expect(range.from.toISOString()).toBe(expected);
      expect(range.to.toISOString()).toBe('2026-10-01T17:00:00.000Z');
    },
  );
  it('uses WIB midnight across the year boundary', () => {
    expect(
      createdInRange(
        'today',
        new Date('2026-12-31T17:00:00Z'),
      )!.from.toISOString(),
    ).toBe('2026-12-31T17:00:00.000Z');
    expect(
      createdInRange(
        'today',
        new Date('2026-12-31T16:59:59Z'),
      )!.from.toISOString(),
    ).toBe('2026-12-30T17:00:00.000Z');
  });
  it('does not constrain an unfiltered request', () => {
    expect(createdInRange()).toBeUndefined();
  });
});
