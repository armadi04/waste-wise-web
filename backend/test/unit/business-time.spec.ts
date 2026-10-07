import { describe, expect, it } from 'bun:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  businessDateInputToISO,
  toBusinessDateInput,
} from '../../src/common/utils/business-time';
import { UpdatePortalCouponDto } from '../../src/portal/admin/dto/admin.dto';

describe('business timezone and timestamp DTOs', () => {
  it('roundtrips existing instants, including milliseconds', () => {
    const utc = '2026-10-18T16:59:42.123Z';
    expect(toBusinessDateInput(utc)).toBe('2026-10-18T23:59:42.123');
    expect(businessDateInputToISO(toBusinessDateInput(utc))).toBe(utc);
    expect(businessDateInputToISO('2026-10-19T00:01')).toBe(
      '2026-10-18T17:01:00.000Z',
    );
  });
  it('rejects zone-less instants and keeps explicit offsets', async () => {
    for (const input of ['2026-10-18T23:59:00+07:00', '2026-10-18T16:59:00Z']) {
      const dto = plainToInstance(UpdatePortalCouponDto, { expiresAt: input });
      expect(dto.expiresAt.toISOString()).toBe('2026-10-18T16:59:00.000Z');
      expect(await validate(dto)).toHaveLength(0);
    }
  });
  it('returns validation errors for malformed dates instead of throwing', async () => {
    for (const expiresAt of [
      '2026-02-30T10:00',
      '2026-02-30T10:00Z',
      '2026-02-30',
      '2026-10-18T23:59:00',
      'bad',
      42,
      {},
    ]) {
      const dto = plainToInstance(UpdatePortalCouponDto, { expiresAt });
      expect(
        (await validate(dto)).some((error) => error.property === 'expiresAt'),
      ).toBe(true);
    }
  });
});
