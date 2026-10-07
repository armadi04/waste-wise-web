import { Checkbox, Input } from '@heroui/react'
import { Controller, useWatch } from 'react-hook-form'
import type {
  PortalFormExtension,
  PortalFormValues,
} from '@/components/features/portal/lib/form-extension'
import type { CampaignRules } from '@/lib/schemas/campaign-rules'
import type { Control } from 'react-hook-form'
import {
  CAMPAIGN_RULE_KEYS,
  campaignRulesFromForm,
  campaignRulesToForm,
} from '@/lib/schemas/campaign-rules'
import { formatDateTime } from '@/lib/utils/format'

const inputs: Array<[string, string, string?]> = [
  ['rulesStartsAt', 'Rules start (WIB)', 'datetime-local'],
  ['rulesPaymentPoints', 'Points per paid order', 'number'],
  ['rulesUsagePoints', 'Points per redeem/check-in', 'number'],
  ['rulesReferralPoints', 'Points per referral', 'number'],
  ['rulesCouponIds', 'Eligible coupon IDs (comma-separated)'],
  ['rulesEventIds', 'Eligible event IDs (comma-separated)'],
  ['rulesRewardValue', 'Reward value', 'number'],
  ['rulesRewardMinimumOrder', 'Reward minimum order', 'number'],
  [
    'rulesRewardMaximumDiscount',
    'Reward maximum discount (optional)',
    'number',
  ],
]

export function CampaignRulesEditor({
  control,
  readOnly,
}: {
  control: Control<PortalFormValues>
  readOnly: boolean
}) {
  const enabled = Boolean(useWatch({ control, name: 'rulesEnabled' }))
  return (
    <section className="col-span-full grid gap-3 rounded-xl border border-default-200 p-4 md:grid-cols-2">
      <div className="col-span-full flex flex-col gap-1">
        <h3 className="font-semibold">Points rules</h3>
        <p className="text-sm text-default-500">
          Without rules the campaign is display-only and earns no points.
        </p>
        <Controller
          name="rulesEnabled"
          control={control}
          render={({ field }) => (
            <Checkbox
              isSelected={Boolean(field.value)}
              onValueChange={field.onChange}
              isDisabled={readOnly}
            >
              Enable points rules
            </Checkbox>
          )}
        />
      </div>
      {enabled && (
        <>
          {inputs.map(([name, label, type]) => (
            <Controller
              key={name}
              name={name}
              control={control}
              render={({ field }) => (
                <Input
                  label={label}
                  labelPlacement="outside"
                  variant="bordered"
                  type={type ?? 'text'}
                  step={type === 'datetime-local' ? '1' : undefined}
                  value={String(field.value ?? '')}
                  onValueChange={field.onChange}
                  isReadOnly={readOnly}
                />
              )}
            />
          ))}
          <Controller
            name="rulesRewardKind"
            control={control}
            render={({ field }) => (
              <label className="block text-sm">
                Reward kind
                <select
                  value={String(field.value ?? 'fixed')}
                  onChange={(event) => field.onChange(event.target.value)}
                  disabled={readOnly}
                  className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </label>
            )}
          />
        </>
      )}
    </section>
  )
}

function CampaignRulesDetails({
  control,
}: {
  control: Control<PortalFormValues>
}) {
  const rules = useWatch({ control, name: 'rules' }) as
    CampaignRules | null | undefined
  return (
    <section className="col-span-full rounded-large border border-default-100 bg-default-50 px-4 py-3 text-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-default-400">
        Points rules
      </div>
      {rules ? (
        <ul className="mt-1 grid gap-1 text-default-700">
          <li>Starts {formatDateTime(rules.startsAt)}</li>
          <li>
            Payment {rules.paymentPoints} · usage {rules.usagePoints} · referral{' '}
            {rules.referralPoints} points
          </li>
          <li>
            Coupons: {rules.couponIds.join(', ') || '—'} · events:{' '}
            {rules.eventIds.join(', ') || '—'}
          </li>
          <li>
            Reward:{' '}
            {rules.reward.kind === 'percentage'
              ? `${rules.reward.value}%`
              : `Rp ${rules.reward.value.toLocaleString('id-ID')}`}
            , minimum order Rp{' '}
            {rules.reward.minimumOrder.toLocaleString('id-ID')}
            {rules.reward.maximumDiscount
              ? `, max Rp ${rules.reward.maximumDiscount.toLocaleString('id-ID')}`
              : ''}
          </li>
        </ul>
      ) : (
        <p className="mt-1 text-default-700">None — display-only campaign.</p>
      )}
    </section>
  )
}

export const campaignFormExtension: PortalFormExtension = {
  initialize(values, entity) {
    const rules = (entity?.rules ?? null) as CampaignRules | null
    values.rules = rules as unknown as PortalFormValues[string]
    Object.assign(values, campaignRulesToForm(rules))
    if (!entity) values.active = true
  },
  prepare(values) {
    const parsed = campaignRulesFromForm(values)
    if (!parsed.success) return parsed
    const data: PortalFormValues = {
      ...values,
      rules: parsed.rules as unknown as PortalFormValues[string],
    }
    for (const key of CAMPAIGN_RULE_KEYS) delete data[key]
    return { success: true, data }
  },
  fields: (fields) => fields,
  beforeField: (key, control, readOnly) =>
    key === 'description' ? (
      <CampaignRulesEditor control={control} readOnly={readOnly} />
    ) : null,
  details: (control) => <CampaignRulesDetails control={control} />,
  booleanClassName: 'self-end pb-2',
  inputClassName: () => undefined,
}
