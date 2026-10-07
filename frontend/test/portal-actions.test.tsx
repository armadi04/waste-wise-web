// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PortalRecord } from '@/types/portal'
import { getPortalColumns } from '@/components/features/portal/components/table-columns'
import {
  portalCapabilities,
  portalResourceConfig,
} from '@/components/features/portal/lib/config'
import {
  campaignRulesFromForm,
  campaignRulesToForm,
} from '@/lib/schemas/campaign-rules'
import {
  adjustPortalCampaignPoints,
  scanPortalPass,
  verifyPortalPass,
} from '@/lib/services/portal.service'
import { passTokenKind } from '@/lib/utils/pass-token'

const api = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({
  apiPost: api.post,
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))
vi.mock('@/components/shared/action-menu/action-menu', () => ({
  ActionMenu: ({
    actions,
  }: {
    actions: Array<{
      key: string
      label: string
      show: boolean
      onPress: () => void
    }>
  }) => (
    <div>
      {actions
        .filter((action) => action.show)
        .map((action) => (
          <button key={action.key} onClick={action.onPress}>
            {action.label}
          </button>
        ))}
    </div>
  ),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

function mount(
  resource: string,
  record: PortalRecord,
  permissions: Array<string>,
) {
  const onVerifyPass = vi.fn()
  const onAdjustPoints = vi.fn()
  const config = portalResourceConfig(resource)!
  const columns = getPortalColumns({
    config,
    fields: config.fields,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
    onVerifyPass,
    onAdjustPoints,
  })
  render(
    <>{columns.find((column) => column.uid === 'actions')?.render?.(record)}</>,
  )
  return { onVerifyPass, onAdjustPoints }
}

const token = (claims: object) =>
  `KM1.header.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`

describe('portal pass actions', () => {
  it('offers redeem for issued vouchers only with the dedicated permission', () => {
    const voucher = { id: 3, code: 'V-3', status: 'Issued' } as PortalRecord
    const { onVerifyPass } = mount('vouchers', voucher, [
      'portal.vouchers.redeem',
    ])
    fireEvent.click(screen.getByText('Redeem'))
    expect(onVerifyPass).toHaveBeenCalledWith(voucher)
    cleanup()
    mount('vouchers', voucher, ['portal.vouchers.update'])
    expect(screen.queryByText('Redeem')).toBeNull()
    cleanup()
    mount('vouchers', { ...voucher, status: 'Redeemed' }, [
      'portal.vouchers.redeem',
    ])
    expect(screen.queryByText('Redeem')).toBeNull()
  })

  it('offers check-in for issued tickets with the check-in permission', () => {
    mount('tickets', { id: 4, code: 'T-4', status: 'Issued' }, [
      'portal.tickets.check_in',
    ])
    expect(screen.getByText('Check in')).toBeTruthy()
  })

  it('routes verification and scans to the dedicated endpoints', async () => {
    api.post.mockResolvedValue({ verified: true })
    await verifyPortalPass('voucher', 3)
    await verifyPortalPass('ticket', 4)
    await scanPortalPass('ticket', 'KM1.x')
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      '/api/portal/admin/vouchers/3/redeem',
      {},
    )
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      '/api/portal/admin/tickets/4/check-in',
      {},
    )
    expect(api.post).toHaveBeenNthCalledWith(
      3,
      '/api/portal/admin/tickets/scan',
      { token: 'KM1.x' },
    )
  })

  it('reads the pass kind from the token and falls back when unreadable', () => {
    expect(passTokenKind(token({ k: 't' }), 'voucher')).toBe('ticket')
    expect(passTokenKind(token({ k: 'v' }), 'ticket')).toBe('voucher')
    expect(passTokenKind('garbage', 'ticket')).toBe('ticket')
    expect(passTokenKind('KM1.a.%%%.c', 'voucher')).toBe('voucher')
  })
})

describe('portal campaign progress', () => {
  it('is read-only and adjusted through the ledger', async () => {
    const progress = {
      id: 9,
      userId: 2,
      campaignId: 5,
      points: 10,
    } as PortalRecord
    const { onAdjustPoints } = mount('campaign-progress', progress, [
      'portal.campaign_progress.update',
      'portal.campaign_progress.delete',
      'portal.campaign_progress.adjust',
    ])
    expect(screen.queryByText('Edit campaign progress')).toBeNull()
    expect(screen.queryByText('Delete campaign progress')).toBeNull()
    fireEvent.click(screen.getByText('Adjust points'))
    expect(onAdjustPoints).toHaveBeenCalledWith(progress)
    api.post.mockResolvedValue({ adjusted: true })
    const input = {
      userId: 2,
      campaignId: 5,
      points: -3,
      reason: 'Duplicate scan',
      idempotencyKey: 'key-12345',
    }
    await adjustPortalCampaignPoints(input)
    expect(api.post).toHaveBeenCalledWith(
      '/api/portal/admin/campaign-progress/adjustments',
      input,
    )
  })
})

describe('portal resource capabilities', () => {
  it.each([
    [
      'reviews',
      { create: false, update: true, delete: true, bulkDelete: true },
    ],
    [
      'bookings',
      { create: false, update: true, delete: true, bulkDelete: true },
    ],
    [
      'promo-codes',
      { create: true, update: true, delete: true, bulkDelete: true },
    ],
    [
      'booking-slots',
      { create: true, update: true, delete: true, bulkDelete: true },
    ],
    [
      'orders',
      { create: false, update: true, delete: false, bulkDelete: false },
    ],
    [
      'campaign-progress',
      { create: false, update: false, delete: false, bulkDelete: false },
    ],
  ])('%s exposes only writes the backend accepts', (resource, expected) => {
    expect(portalCapabilities(portalResourceConfig(resource))).toEqual(expected)
  })

  it('keeps pass status fields read-only so status changes go through verification', () => {
    expect(
      portalResourceConfig('vouchers')!.fields.find(
        (field) => field.key === 'status',
      )?.readOnly,
    ).toBe(true)
    expect(
      portalResourceConfig('tickets')!.fields.find(
        (field) => field.key === 'checkedInAt',
      )?.readOnly,
    ).toBe(true)
  })
})

describe('campaign rules form', () => {
  const rules = {
    startsAt: '2026-10-01T00:00:00.000Z',
    paymentPoints: 10,
    usagePoints: 5,
    referralPoints: 20,
    couponIds: [1, 2],
    eventIds: [],
    reward: {
      kind: 'percentage' as const,
      value: 15,
      minimumOrder: 50000,
      maximumDiscount: 25000,
    },
  }

  it('round-trips rules through the flat form fields', () => {
    expect(campaignRulesFromForm(campaignRulesToForm(rules))).toEqual({
      success: true,
      rules,
    })
  })

  it('clears rules when disabled and rejects invalid input', () => {
    expect(
      campaignRulesFromForm({
        ...campaignRulesToForm(rules),
        rulesEnabled: false,
      }),
    ).toEqual({ success: true, rules: null })
    expect(
      campaignRulesFromForm({
        ...campaignRulesToForm(rules),
        rulesRewardValue: '150',
      }),
    ).toMatchObject({ success: false })
    expect(
      campaignRulesFromForm({
        ...campaignRulesToForm(rules),
        rulesCouponIds: '1, x',
      }),
    ).toMatchObject({ success: false })
  })
})
