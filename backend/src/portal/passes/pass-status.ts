import { isTicketWindowOpen } from '@/portal/passes/ticket-window';

/**
 * Stored lifecycle of customer vouchers and tickets. These are the only values
 * written to `portal_vouchers.status` / `portal_tickets.status`.
 */
export const PASS_STATUS = {
  Reserved: 'Reserved',
  Issued: 'Issued',
  Redeemed: 'Redeemed',
  CheckedIn: 'CheckedIn',
  Cancelled: 'Cancelled',
} as const;

export type StoredPassStatus = (typeof PASS_STATUS)[keyof typeof PASS_STATUS];

/**
 * API-only status, never stored: an `Issued` pass that can no longer be used
 * because its voucher validity or ticket check-in window has closed.
 */
export const PASS_DISPLAY_EXPIRED = 'Expired';

export type PassDisplayStatus = StoredPassStatus | typeof PASS_DISPLAY_EXPIRED;

export const voucherDisplayStatus = (
  status: string,
  expiresAt: Date | null | undefined,
  now = Date.now(),
): string =>
  status === PASS_STATUS.Issued && expiresAt && expiresAt.getTime() <= now
    ? PASS_DISPLAY_EXPIRED
    : status;

/** A ticket whose event is missing keeps its stored status. */
export const ticketDisplayStatus = (
  status: string,
  eventStartsAt: Date | null | undefined,
  now = Date.now(),
): string =>
  status === PASS_STATUS.Issued &&
  eventStartsAt &&
  !isTicketWindowOpen(eventStartsAt, now)
    ? PASS_DISPLAY_EXPIRED
    : status;
