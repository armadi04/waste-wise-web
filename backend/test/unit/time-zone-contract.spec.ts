import { describe, expect, it } from 'bun:test';
import fixture from '../fixtures/time-zone-contract.json';
import {
  toBusinessDateInput,
  businessDateInputToISO,
  parseBusinessDate,
  resolveTimeZone,
  isTimeZone,
  parseCalendarDate,
} from '@/common/utils/business-time';
describe('timezone contract v1', () => {
  for (const { zone, local } of fixture.zones)
    it(`roundtrips milliseconds in ${zone}`, () => {
      expect(toBusinessDateInput(fixture.instant, zone)).toBe(local);
      expect(businessDateInputToISO(local, zone)).toBe(fixture.instant);
    });
  for (const value of fixture.invalid)
    it(`rejects non-absolute or invalid timestamp ${value}`, () =>
      expect(Number.isNaN(parseBusinessDate(value).getTime())).toBe(true));
  it('keeps explicit preference and supports global automatic detection', () => {
    expect(resolveTimeZone('Asia/Jayapura', 'America/New_York')).toBe(
      'Asia/Jayapura',
    );
    expect(resolveTimeZone(null, 'America/New_York')).toBe('America/New_York');
    expect(resolveTimeZone(null, 'bogus')).toBe('Asia/Jakarta');
    expect(isTimeZone('UTC')).toBe(true);
  });
  it('keeps calendar dates separate from instants', () => {
    expect(parseCalendarDate('2000-05-20').toISOString()).toBe(
      '2000-05-20T00:00:00.000Z',
    );
    expect(Number.isNaN(parseCalendarDate('2000-02-30').getTime())).toBe(true);
  });
});
