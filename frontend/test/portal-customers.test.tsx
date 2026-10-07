// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PortalRecord } from '@/types/portal'
import { getPortalColumns } from '@/components/features/portal/components/table-columns'
import {
  portalCapabilities,
  portalResourceConfig,
} from '@/components/features/portal/lib/config'
import { portalCustomerRecordsQueryOptions } from '@/lib/query/options'
import { portalCustomerSearchSchema } from '@/lib/schemas/portal'
import {
  adjustPortalWallet,
  getPortalCustomer,
  revokePortalGift,
} from '@/lib/services/portal.service'

const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/api', () => ({
  apiPost: api.post,
  apiGet: api.get,
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
  const handlers = {
    onRevokeGift: vi.fn(),
    onAdjustWallet: vi.fn(),
    onOpenCustomer: vi.fn(),
  }
  const config = portalResourceConfig(resource)!
  const columns = getPortalColumns({
    config,
    fields: config.fields,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
    ...handlers,
  })
  render(
    <>{columns.find((column) => column.uid === 'actions')?.render?.(record)}</>,
  )
  return handlers
}

describe('portal customer data views', () => {
  it.each([
    'customers',
    'gifts',
    'referrals',
    'wallets',
    'wallet-transactions',
    'saved-offers',
    'campaign-ledger',
    'commerce-outbox',
  ])('%s is read-only through generic CRUD', (resource) => {
    expect(portalCapabilities(portalResourceConfig(resource))).toEqual({
      create: false,
      update: false,
      delete: false,
      bulkDelete: false,
    })
    expect(
      portalResourceConfig(resource)!.fields.every((field) => field.readOnly),
    ).toBe(true)
  })

  it('offers gift revocation only for ready gifts with the revoke permission', () => {
    const gift = { id: 5, code: 'GFT-1', status: 'Ready' } as PortalRecord
    const { onRevokeGift } = mount('gifts', gift, ['portal.gifts.revoke'])
    fireEvent.click(screen.getByText('Revoke gift'))
    expect(onRevokeGift).toHaveBeenCalledWith(gift)
    cleanup()
    mount('gifts', { ...gift, status: 'Redeemed' }, ['portal.gifts.revoke'])
    expect(screen.queryByText('Revoke gift')).toBeNull()
  })

  it('offers wallet adjustment and customer links by permission', () => {
    const wallet = { id: 2, userId: 7, balance: 100 } as PortalRecord
    const { onAdjustWallet, onOpenCustomer } = mount('wallets', wallet, [
      'portal.wallets.adjust',
      'portal.customers.read',
    ])
    fireEvent.click(screen.getByText('Adjust balance'))
    fireEvent.click(screen.getByText('Open customer'))
    expect(onAdjustWallet).toHaveBeenCalledWith(wallet)
    expect(onOpenCustomer).toHaveBeenCalledWith(wallet)
    cleanup()
    mount('wallets', wallet, ['portal.wallets.read'])
    expect(screen.queryByText('Adjust balance')).toBeNull()
    expect(screen.queryByText('Open customer')).toBeNull()
  })

  it('calls the dedicated customer, gift and wallet endpoints', async () => {
    api.post.mockResolvedValue({})
    api.get.mockResolvedValue({})
    await getPortalCustomer(7)
    await revokePortalGift(5, 'Wrong recipient')
    const input = {
      userId: 7,
      amount: -50,
      reason: 'Fraud reversal',
      idempotencyKey: 'key-00001',
    }
    await adjustPortalWallet(input)
    expect(api.get).toHaveBeenCalledWith('/api/portal/admin/customers/7')
    expect(api.post).toHaveBeenCalledWith('/api/portal/admin/gifts/5/revoke', {
      reason: 'Wrong recipient',
    })
    expect(api.post).toHaveBeenCalledWith(
      '/api/portal/admin/wallets/adjustments',
      input,
    )
  })

  it('loads customer tabs through the userId list filter', async () => {
    api.get.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 2, lastPage: 1 },
    })
    const options = portalCustomerRecordsQueryOptions('orders', 7, 2)
    expect(options.queryKey).toEqual([
      'portal',
      'orders',
      { userId: 7, page: 2 },
    ])
    await options.queryFn!({} as never)
    expect(api.get).toHaveBeenCalledWith(
      '/api/portal/admin/orders',
      expect.objectContaining({
        params: expect.objectContaining({
          userId: 7,
          page: 2,
          paginated: true,
        }),
      }),
    )
  })

  it('validates the customer tab search state', () => {
    expect(portalCustomerSearchSchema.parse({ tab: 'gifts', page: 2 })).toEqual(
      { tab: 'gifts', page: 2 },
    )
    expect(() => portalCustomerSearchSchema.parse({ tab: 'users' })).toThrow()
  })
})
