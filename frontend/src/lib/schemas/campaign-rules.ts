import { z } from 'zod'
import {
  businessDateInputToISO,
  toBusinessDateInput,
} from '@/lib/utils/business-time'

/** Flat form keys for the nested campaign `rules` JSON accepted by the admin API. */
export const CAMPAIGN_RULE_KEYS = [
  'rulesEnabled',
  'rulesStartsAt',
  'rulesPaymentPoints',
  'rulesUsagePoints',
  'rulesReferralPoints',
  'rulesCouponIds',
  'rulesEventIds',
  'rulesRewardKind',
  'rulesRewardValue',
  'rulesRewardMinimumOrder',
  'rulesRewardMaximumDiscount',
] as const

export interface CampaignRules {
  startsAt: string
  paymentPoints: number
  usagePoints: number
  referralPoints: number
  couponIds: Array<number>
  eventIds: Array<number>
  reward: {
    kind: 'fixed' | 'percentage'
    value: number
    minimumOrder: number
    maximumDiscount: number | null
  }
}

const points = z.coerce
  .number()
  .int('Points must be whole numbers')
  .min(0, 'Points cannot be negative')
const ids = z
  .string()
  .transform((value, ctx) => {
    const parts = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const numbers = parts.map(Number)
    if (numbers.some((item) => !Number.isInteger(item) || item < 1)) {
      ctx.addIssue({
        code: 'custom',
        message: 'IDs must be comma-separated positive numbers',
      })
      return z.NEVER
    }
    return [...new Set(numbers)]
  })
  .pipe(z.array(z.number()).max(100, 'Use at most 100 IDs'))

const ruleSchema = z
  .object({
    rulesStartsAt: z.string().min(1, 'Enter when campaign rules start'),
    rulesPaymentPoints: points,
    rulesUsagePoints: points,
    rulesReferralPoints: points,
    rulesCouponIds: ids,
    rulesEventIds: ids,
    rulesRewardKind: z.enum(['fixed', 'percentage']),
    rulesRewardValue: z.coerce
      .number()
      .int()
      .min(1, 'Reward value must be at least 1'),
    rulesRewardMinimumOrder: points,
    rulesRewardMaximumDiscount: z.union([
      z.literal(''),
      z.coerce.number().int().min(1),
    ]),
  })
  .refine(
    (value) =>
      value.rulesRewardKind !== 'percentage' || value.rulesRewardValue <= 100,
    {
      message: 'Percentage reward cannot exceed 100',
    },
  )

export const campaignRulesToForm = (
  rules: CampaignRules | null | undefined,
) => ({
  rulesEnabled: Boolean(rules),
  rulesStartsAt: rules ? toBusinessDateInput(rules.startsAt) : '',
  rulesPaymentPoints: String(rules?.paymentPoints ?? 0),
  rulesUsagePoints: String(rules?.usagePoints ?? 0),
  rulesReferralPoints: String(rules?.referralPoints ?? 0),
  rulesCouponIds: (rules?.couponIds ?? []).join(', '),
  rulesEventIds: (rules?.eventIds ?? []).join(', '),
  rulesRewardKind: rules?.reward.kind ?? 'fixed',
  rulesRewardValue: String(rules?.reward.value ?? ''),
  rulesRewardMinimumOrder: String(rules?.reward.minimumOrder ?? 0),
  rulesRewardMaximumDiscount:
    rules?.reward.maximumDiscount == null
      ? ''
      : String(rules.reward.maximumDiscount),
})

export const campaignRulesFromForm = (
  values: Record<string, unknown>,
):
  | { success: true; rules: CampaignRules | null }
  | { success: false; message: string } => {
  if (!values.rulesEnabled) return { success: true, rules: null }
  const parsed = ruleSchema.safeParse(values)
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0].message }
  const data = parsed.data
  let startsAt: string
  try {
    startsAt = businessDateInputToISO(data.rulesStartsAt)
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Invalid start time',
    }
  }
  return {
    success: true,
    rules: {
      startsAt,
      paymentPoints: data.rulesPaymentPoints,
      usagePoints: data.rulesUsagePoints,
      referralPoints: data.rulesReferralPoints,
      couponIds: data.rulesCouponIds,
      eventIds: data.rulesEventIds,
      reward: {
        kind: data.rulesRewardKind,
        value: data.rulesRewardValue,
        minimumOrder: data.rulesRewardMinimumOrder,
        maximumDiscount:
          data.rulesRewardMaximumDiscount === ''
            ? null
            : data.rulesRewardMaximumDiscount,
      },
    },
  }
}
