import { isDeepStrictEqual } from 'node:util';
import { parseBusinessDate } from '@/common/utils/business-time';
import { BadRequestException } from '@nestjs/common';

export interface CampaignRules {
  startsAt: string;
  paymentPoints: number;
  usagePoints: number;
  referralPoints: number;
  couponIds: number[];
  eventIds: number[];
  reward: {
    kind: 'fixed' | 'percentage';
    value: number;
    minimumOrder: number;
    maximumDiscount: number | null;
  };
}

export function validateCampaignRules(rules: CampaignRules, target: number) {
  const integer = (n: number) =>
    Number.isSafeInteger(n) && n >= 0 && n <= 2147483647;
  if (
    !Number.isFinite(new Date(rules.startsAt).getTime()) ||
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(rules.startsAt) ||
    !integer(target) ||
    target === 0 ||
    ![rules.paymentPoints, rules.usagePoints, rules.referralPoints].every(
      integer,
    ) ||
    ![rules.paymentPoints, rules.usagePoints, rules.referralPoints].some(
      (n) => n > 0,
    ) ||
    !Array.isArray(rules.couponIds) ||
    !Array.isArray(rules.eventIds) ||
    ![...rules.couponIds, ...rules.eventIds].every(
      (n) => integer(n) && n > 0,
    ) ||
    !rules.reward ||
    !['fixed', 'percentage'].includes(rules.reward.kind) ||
    !integer(rules.reward.value) ||
    rules.reward.value === 0 ||
    (rules.reward.kind === 'percentage' && rules.reward.value > 100) ||
    !integer(rules.reward.minimumOrder) ||
    (rules.reward.maximumDiscount !== null &&
      (!integer(rules.reward.maximumDiscount) ||
        rules.reward.maximumDiscount === 0))
  ) {
    throw new BadRequestException('Invalid campaign rules');
  }
  parseBusinessDate(rules.startsAt);
  return rules;
}

export function campaignMatches(
  rules: CampaignRules,
  activity: { couponId?: number; eventId?: number },
) {
  if (!rules.couponIds.length && !rules.eventIds.length) return true;
  return (
    (activity.couponId !== undefined &&
      rules.couponIds.includes(activity.couponId)) ||
    (activity.eventId !== undefined &&
      rules.eventIds.includes(activity.eventId))
  );
}

export function campaignRewardLabel(rules: CampaignRules) {
  return rules.reward.kind === 'percentage'
    ? `Diskon checkout ${rules.reward.value}%`
    : `Diskon checkout Rp${rules.reward.value.toLocaleString('id-ID')}`;
}

/** Product selection is a set; timestamps represent instants, regardless of offset. */
export function campaignRulesEqual(
  left: CampaignRules | null,
  right: CampaignRules | null,
): boolean {
  if (left === null || right === null) return left === right;
  const normalize = (rules: CampaignRules) => ({
    ...rules,
    startsAt: parseBusinessDate(rules.startsAt).getTime(),
    couponIds: [...new Set(rules.couponIds)].sort((a, b) => a - b),
    eventIds: [...new Set(rules.eventIds)].sort((a, b) => a - b),
  });
  return isDeepStrictEqual(normalize(left), normalize(right));
}
