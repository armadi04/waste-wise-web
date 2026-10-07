import { describe, expect, it } from 'bun:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OrderQueryDto } from '@/portal/commerce/dto/order-query.dto';
import {
  canRequestOrderRefund,
  hasUsedBenefit,
} from '@/portal/commerce/order-refund-policy';

describe('order refund policy', () => {
  it.each([null, '', 'Rejected'])(
    'allows an unused paid order with refund status %s',
    (refundStatus) => {
      expect(canRequestOrderRefund({ status: 'Paid', refundStatus })).toBe(
        true,
      );
      expect(
        canRequestOrderRefund({ status: 'Paid', refundStatus }, true),
      ).toBe(false);
    },
  );
  it.each(['Requested', 'Processing', 'Failed', 'Refunded', 'Unknown'])(
    'fails closed for refund status %s',
    (refundStatus) => {
      expect(canRequestOrderRefund({ status: 'Paid', refundStatus })).toBe(
        false,
      );
    },
  );
  it.each(['Pending', 'Cancelled', 'Expired', 'Failed', 'Refunded', 'Unknown'])(
    'rejects payment status %s',
    (status) => {
      expect(canRequestOrderRefund({ status })).toBe(false);
    },
  );
  it('uses stored usage states, independent of display expiry', () => {
    expect(hasUsedBenefit(['Issued', 'Expired'])).toBe(false);
    expect(hasUsedBenefit(['Redeemed'])).toBe(true);
    expect(hasUsedBenefit(['CheckedIn'])).toBe(true);
  });
});

describe('order history query validation', () => {
  it('accepts bounded numeric search and known filters', async () => {
    const query = plainToInstance(OrderQueryDto, {
      page: '2',
      limit: '50',
      filter: 'Refunded',
    });
    expect(await validate(query)).toHaveLength(0);
    expect(query.page).toBe(2);
    expect(query.limit).toBe(50);
  });
  it.each([
    { page: 0 },
    { page: 100001 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 51 },
    { limit: 'bad' },
    { filter: 'Failed' },
  ])('rejects invalid query %j', async (input) => {
    expect(
      (await validate(plainToInstance(OrderQueryDto, input))).length,
    ).toBeGreaterThan(0);
  });
});
