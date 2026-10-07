import {
  Ban,
  CheckCircle,
  Coins,
  Eye,
  ListTree,
  Pencil,
  ScanLine,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import type { PortalColumnOptions } from '@/components/features/portal/components/table-columns/types'
import type { Column } from '@/components/shared/datatable'
import type { PortalRecord } from '@/types/portal'
import { portalCapabilities } from '@/components/features/portal/lib/config'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'

import { valueLabel } from '@/components/features/portal/components/table-columns/lib/columns-helpers'

export const getPortalColumns = ({
  config,
  fields,
  onView,
  onEdit,
  onDelete,
  hasPermission,
  onManageRelation,
  onApproveRefund,
  onRejectRefund,
  approvingRefund = false,
  onVerifyPass,
  verifyingPass = false,
  onAdjustPoints,
  onRevokeGift,
  onAdjustWallet,
  onOpenCustomer,
}: PortalColumnOptions): Array<Column<PortalRecord>> => {
  const capabilities = portalCapabilities(config)
  return [
    { name: 'ID', uid: 'id', sortable: true },
    ...fields.slice(0, 4).map((field) => ({
      name: field.label,
      uid: field.key,
      sortable: true,
      truncate: true,
      maxWidth: 220,
      render: (item: PortalRecord) => valueLabel(item[field.key]),
      exportValue: (item: PortalRecord) => valueLabel(item[field.key]),
    })),
    {
      name: 'Updated At',
      uid: 'updatedAt',
      sortable: true,
      render: (item) => {
        const value = item.updatedAt
        return value ? format(new Date(String(value)), 'yyyy-MM-dd HH:mm') : '—'
      },
      exportValue: (item) => String(item.updatedAt ?? ''),
    },
    {
      name: 'Actions',
      uid: 'actions',
      render: (item) => (
        <ActionMenu
          actions={[
            {
              key: 'relation',
              label: 'Manage related records',
              icon: <ListTree size={16} />,
              onPress: () => onManageRelation?.(item),
              show:
                Boolean(onManageRelation) &&
                hasPermission(
                  config.resource === 'events'
                    ? 'portal.event_tickets.read'
                    : 'portal.order_items.read',
                ),
            },
            {
              key: 'reject-refund',
              label: 'Reject refund',
              icon: <Trash2 size={16} />,
              onPress: () => onRejectRefund?.(item),
              show:
                Boolean(onRejectRefund) &&
                config.resource === 'orders' &&
                item.refundStatus === 'Requested' &&
                hasPermission('portal.orders.refund'),
            },
            {
              key: 'refund',
              label: 'Approve refund',
              icon: <CheckCircle size={16} />,
              onPress: () => onApproveRefund?.(item),
              show:
                Boolean(onApproveRefund) &&
                !approvingRefund &&
                config.resource === 'orders' &&
                ((item.status === 'Paid' &&
                  ['Requested', 'Failed'].includes(
                    String(item.refundStatus),
                  )) ||
                  (item.paymentState === 'LateSettled' &&
                    item.refundStatus === 'Processing')) &&
                hasPermission('portal.orders.refund'),
            },
            {
              key: 'verify-pass',
              label: config.resource === 'tickets' ? 'Check in' : 'Redeem',
              icon: <ScanLine size={16} />,
              onPress: () => onVerifyPass?.(item),
              show:
                Boolean(onVerifyPass) &&
                !verifyingPass &&
                item.status === 'Issued' &&
                (config.resource === 'vouchers'
                  ? hasPermission('portal.vouchers.redeem')
                  : config.resource === 'tickets' &&
                    hasPermission('portal.tickets.check_in')),
            },
            {
              key: 'adjust-points',
              label: 'Adjust points',
              icon: <SlidersHorizontal size={16} />,
              onPress: () => onAdjustPoints?.(item),
              show:
                Boolean(onAdjustPoints) &&
                config.resource === 'campaign-progress' &&
                hasPermission('portal.campaign_progress.adjust'),
            },
            {
              key: 'revoke-gift',
              label: 'Revoke gift',
              icon: <Ban size={16} />,
              onPress: () => onRevokeGift?.(item),
              danger: true,
              show:
                Boolean(onRevokeGift) &&
                config.resource === 'gifts' &&
                item.status === 'Ready' &&
                hasPermission('portal.gifts.revoke'),
            },
            {
              key: 'adjust-wallet',
              label: 'Adjust balance',
              icon: <Coins size={16} />,
              onPress: () => onAdjustWallet?.(item),
              show:
                Boolean(onAdjustWallet) &&
                config.resource === 'wallets' &&
                hasPermission('portal.wallets.adjust'),
            },
            {
              key: 'open-customer',
              label: 'Open customer',
              icon: <UserRound size={16} />,
              onPress: () => onOpenCustomer?.(item),
              show:
                Boolean(onOpenCustomer) &&
                hasPermission('portal.customers.read'),
            },
            {
              key: 'view',
              label: 'View details',
              icon: <Eye size={16} />,
              onPress: () => onView(item),
              show: hasPermission(`${config.permission}.read`),
            },
            {
              key: 'edit',
              label: `Edit ${config.singular.toLowerCase()}`,
              icon: <Pencil size={16} />,
              onPress: () => onEdit(item),
              show:
                capabilities.update &&
                hasPermission(`${config.permission}.update`),
            },
            {
              key: 'delete',
              label: `Delete ${config.singular.toLowerCase()}`,
              icon: <Trash2 size={16} />,
              onPress: () => onDelete(item.id),
              danger: true,
              show:
                capabilities.delete &&
                hasPermission(`${config.permission}.delete`),
            },
          ]}
        />
      ),
    },
  ]
}
