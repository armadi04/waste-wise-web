import { PASS_STATUS } from '@/portal/passes/pass-status';

type RefundFacts = { status: string; refundStatus?: string | null };

export const USED_BENEFIT_STATUSES: string[] = [
  PASS_STATUS.Redeemed,
  PASS_STATUS.CheckedIn,
];
export const REFUND_REQUEST_ACTIVE_STATUSES = [
  'Requested',
  'Processing',
  'Failed',
];

export const hasUsedBenefit = (statuses: Iterable<string>) =>
  [...statuses].some((status) => USED_BENEFIT_STATUSES.includes(status));

export const canRequestOrderRefund = (order: RefundFacts, used = false) =>
  order.status === 'Paid' &&
  ['', 'Rejected'].includes(order.refundStatus ?? '') &&
  !used;
