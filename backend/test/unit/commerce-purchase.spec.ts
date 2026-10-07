import { describe, expect, it } from 'bun:test';
import {
  normalizePurchase,
  splitValue,
  assertPurchaseLimit,
  saleDeadline,
} from '@/portal/commerce/commerce-purchase';

const dto = {
  kind: 'ticket',
  slug: 'concert',
  attendee: 'Nadia',
  email: 'nadia@example.test',
  phone: '0812',
};
describe('purchase contract', () => {
  it('normalizes legacy and current single participant requests identically', () => {
    expect(normalizePurchase(dto).fingerprint).toBe(
      normalizePurchase({ ...dto, quantity: 1, attendees: [' Nadia '] })
        .fingerprint,
    );
  });
  it('allows duplicate names but rejects conflicting legacy or missing participants', () => {
    expect(
      normalizePurchase({ ...dto, quantity: 2, attendees: ['Nadia', 'Nadia'] })
        .input.attendees,
    ).toEqual(['Nadia', 'Nadia']);
    expect(() => normalizePurchase({ ...dto, attendees: ['Other'] })).toThrow(
      'conflict',
    );
    expect(() => normalizePurchase({ ...dto, quantity: 2 })).toThrow(
      'One participant',
    );
  });
  it.each([0, -1, 1.5, 11, NaN])('rejects invalid quantity %s', (quantity) => {
    expect(() => normalizePurchase({ ...dto, quantity })).toThrow('Quantity');
  });
  it('changes fingerprints when meaningful request fields change', () => {
    const original = normalizePurchase(dto).fingerprint;
    expect(
      normalizePurchase({ ...dto, quantity: 2, attendees: ['Nadia', 'Nadia'] })
        .fingerprint,
    ).not.toBe(original);
    expect(normalizePurchase({ ...dto, phone: '0813' }).fingerprint).not.toBe(
      original,
    );
  });
  it('enforces per-order and cumulative user limits independently', () => {
    expect(() => assertPurchaseLimit(3, { maxPerOrder: 2 }, 0)).toThrow(
      'limit',
    );
    expect(() => assertPurchaseLimit(2, { maxPerUser: 3 }, 2)).toThrow('limit');
    expect(() => assertPurchaseLimit(2, {}, 100)).not.toThrow();
  });
  it('preserves exact component totals and assigns rounding remainder to tickets', () => {
    expect(splitValue(101, 100, 100)).toEqual({ coupon: 50, ticket: 51 });
    expect(splitValue(101, 0, 0)).toEqual({ coupon: 50, ticket: 51 });
    expect(splitValue(100, 100, 0)).toEqual({ coupon: 100, ticket: 0 });
  });
  it('caps payment by the earliest explicit deadline', () => {
    expect(saleDeadline(new Date(100), null, new Date(50)).getTime()).toBe(50);
  });
});
