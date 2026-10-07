// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PortalRecord } from '@/types/portal'
import { getPortalColumns } from '@/components/features/portal/components/table-columns'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import { approvePortalRefund } from '@/lib/services/portal.service'

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
  record: PortalRecord,
  permissions: Array<string>,
  approvingRefund = false,
) {
  const approve = vi.fn()
  const config = portalResourceConfig('orders')!
  const columns = getPortalColumns({
    config,
    fields: config.fields,
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    hasPermission: (permission) => permissions.includes(permission),
    onApproveRefund: approve,
    approvingRefund,
  })
  render(
    <>{columns.find((column) => column.uid === 'actions')?.render?.(record)}</>,
  )
  return approve
}
const requested = {
  id: 7,
  status: 'Paid',
  refundStatus: 'Requested',
  orderNumber: 'ORD-7',
} as PortalRecord
describe('portal admin refund approval', () => {
  it('shows approval only for paid requested refunds and passes the selected record', () => {
    const approve = mount(requested, ['portal.orders.refund'])
    fireEvent.click(screen.getByText('Approve refund'))
    expect(approve).toHaveBeenCalledWith(requested)
    expect(screen.queryByText('Delete order')).toBeNull()
  })
  it.each([
    [{ ...requested, refundStatus: null }, ['portal.orders.refund'], false],
    [{ ...requested, status: 'Refunded' }, ['portal.orders.refund'], false],
    [requested, ['portal.orders.read'], false],
    [requested, ['portal.orders.refund'], true],
  ])(
    'hides approval for an ineligible state or permission',
    (record, permissions, busy) => {
      mount(record, permissions, busy)
      expect(screen.queryByText('Approve refund')).toBeNull()
    },
  )
  it('uses the dedicated approval endpoint rather than generic record updates', async () => {
    api.post.mockResolvedValue({ id: 'ORD-7', status: 'Refunded' })
    await approvePortalRefund(7)
    expect(api.post).toHaveBeenCalledWith(
      '/api/portal/admin/orders/7/refund-approve',
      {},
    )
  })
  it('marks financial order and item fields read-only while retaining editable titles', () => {
    const fields = portalResourceConfig('order-items')!.fields
    expect(fields.find((field) => field.key === 'unitPrice')?.readOnly).toBe(
      true,
    )
    expect(fields.find((field) => field.key === 'title')?.readOnly).not.toBe(
      true,
    )
    expect(
      portalResourceConfig('orders')!.fields.find(
        (field) => field.key === 'refundStatus',
      )?.readOnly,
    ).toBe(true)
  })
})
