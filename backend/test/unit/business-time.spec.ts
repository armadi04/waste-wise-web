import { describe, expect, it } from 'bun:test';
import {
  businessDateInputToISO,
  toBusinessDateInput,
} from '../../src/common/utils/business-time';

describe('business timezone and timestamp DTOs', () => {
  it('roundtrips existing instants, including milliseconds', () => {
    const utc = '2026-10-18T16:59:42.123Z';
    expect(toBusinessDateInput(utc)).toBe('2026-10-18T23:59:42.123');
    expect(businessDateInputToISO(toBusinessDateInput(utc))).toBe(utc);
    expect(businessDateInputToISO('2026-10-19T00:01')).toBe(
      '2026-10-18T17:01:00.000Z',
    );
  });
});
