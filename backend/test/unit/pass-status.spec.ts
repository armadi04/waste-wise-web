import { describe, expect, it } from 'bun:test';
import {
  PASS_DISPLAY_EXPIRED,
  PASS_STATUS,
  ticketDisplayStatus,
  voucherDisplayStatus,
} from '@/portal/passes/pass-status';
import { TICKET_USE_WINDOW_MS } from '@/portal/passes/ticket-window';

const now = Date.parse('2026-10-03T00:00:00Z');

describe('pass display status', () => {
  it('derives Expired for issued vouchers at or after expiresAt', () => {
    expect(voucherDisplayStatus('Issued', new Date(now + 1), now)).toBe(
      'Issued',
    );
    expect(voucherDisplayStatus('Issued', new Date(now), now)).toBe(
      PASS_DISPLAY_EXPIRED,
    );
    expect(voucherDisplayStatus('Issued', new Date(now - 1), now)).toBe(
      'Expired',
    );
    expect(voucherDisplayStatus('Issued', null, now)).toBe('Issued');
  });

  it('derives Expired for issued tickets once the check-in window closes', () => {
    const openStart = new Date(now - TICKET_USE_WINDOW_MS + 1);
    const closedStart = new Date(now - TICKET_USE_WINDOW_MS);
    expect(ticketDisplayStatus('Issued', openStart, now)).toBe('Issued');
    expect(ticketDisplayStatus('Issued', closedStart, now)).toBe('Expired');
    expect(ticketDisplayStatus('Issued', undefined, now)).toBe('Issued');
  });

  it('never rewrites non-issued stored statuses', () => {
    const past = new Date(0);
    for (const status of [
      PASS_STATUS.Reserved,
      PASS_STATUS.Redeemed,
      PASS_STATUS.CheckedIn,
      PASS_STATUS.Cancelled,
    ]) {
      expect(voucherDisplayStatus(status, past, now)).toBe(status);
      expect(ticketDisplayStatus(status, past, now)).toBe(status);
    }
  });

  it('uses one spelling for checked-in tickets', () => {
    expect(PASS_STATUS.CheckedIn).toBe('CheckedIn');
  });
});
