import { describe, expect, it } from 'bun:test';
import {
  campaignMatches,
  validateCampaignRules,
  type CampaignRules,
} from '@/portal/campaigns/campaign-rules';

const rules: CampaignRules = {
  startsAt: '2026-01-01T00:00:00Z',
  paymentPoints: 10,
  usagePoints: 5,
  referralPoints: 20,
  couponIds: [],
  eventIds: [],
  reward: {
    kind: 'fixed',
    value: 25000,
    minimumOrder: 0,
    maximumDiscount: null,
  },
};

describe('campaign rules', () => {
  it('matches all products only with empty filters and uses OR for selected products', () => {
    expect(campaignMatches(rules, {})).toBe(true);
    const filtered = { ...rules, couponIds: [2], eventIds: [3] };
    expect(campaignMatches(filtered, { couponId: 2 })).toBe(true);
    expect(campaignMatches(filtered, { eventId: 3 })).toBe(true);
    expect(campaignMatches(filtered, { couponId: 4 })).toBe(false);
    expect(campaignMatches(filtered, {})).toBe(false);
  });
  it('rejects negative/fractional points, missing rule fields, invalid rewards and ambiguous starts', () => {
    expect(validateCampaignRules(rules, 25)).toEqual(rules);
    for (const invalid of [
      { ...rules, paymentPoints: -1 },
      { ...rules, usagePoints: 0.5 },
      { ...rules, startsAt: '2026-01-01' },
      { ...rules, startsAt: 'invalid' },
      { ...rules, couponIds: [0] },
      { ...rules, reward: { ...rules.reward, value: 0 } },
      { ...rules, reward: { ...rules.reward, kind: 'percentage', value: 101 } },
      { ...rules, eventIds: undefined },
    ])
      expect(() =>
        validateCampaignRules(invalid as CampaignRules, 25),
      ).toThrow();
    expect(() => validateCampaignRules(rules, 0)).toThrow();
  });
});
