import { Chip } from '@heroui/react'
import { Copy, RefreshCw, Trash2 } from 'lucide-react'
import type { GetColumnsParams } from '@/components/features/invitations/components/table-columns/types'
import type { Column } from '@/components/shared/datatable'
import type { Invitation } from '@/types/api'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'

import {
  STATUS_META,
  getInvitationStatus,
} from '@/components/features/invitations/components/table-columns/lib/columns-helpers'

export const getColumns = ({
  roles,
  onCopyLink,
  onResend,
  onRevoke,
  hasPermission,
}: GetColumnsParams): Array<Column<Invitation>> => {
  const roleNames = (ids: Array<number> | null) =>
    (ids ?? [])
      .map((id) => roles.find((r) => r.id === id)?.name)
      .filter(Boolean)
      .join(', ')

  return [
    { name: 'ID', uid: 'id', sortable: true },
    {
      name: 'Email',
      uid: 'email',
      sortable: true,
      truncate: true,
      maxWidth: 240,
    },
    {
      name: 'Roles',
      uid: 'roleIds',
      render: (item) => (
        <span className="text-small text-default-500">
          {roleNames(item.roleIds) || '—'}
        </span>
      ),
      exportValue: (item) => roleNames(item.roleIds),
    },
    {
      name: 'Status',
      uid: 'status',
      render: (item) => {
        const meta = STATUS_META[getInvitationStatus(item)]
        return (
          <Chip size="sm" variant="flat" color={meta.color}>
            {meta.label}
          </Chip>
        )
      },
      exportValue: (item) => STATUS_META[getInvitationStatus(item)].label,
    },
    {
      name: 'Expires At',
      uid: 'expiresAt',
      sortable: true,
      render: (item) => format(new Date(item.expiresAt), 'yyyy-MM-dd HH:mm'),
      exportValue: (item) =>
        format(new Date(item.expiresAt), 'yyyy-MM-dd HH:mm'),
    },
    {
      name: 'Actions',
      uid: 'actions',
      render: (item) => {
        const status = getInvitationStatus(item)
        const isPending = status === 'pending'
        return (
          <ActionMenu
            actions={[
              {
                key: 'copy',
                label: 'Copy invite link',
                icon: <Copy size={16} />,
                onPress: () => onCopyLink(item),
                show: hasPermission('users.invite') && isPending,
              },
              {
                key: 'resend',
                label: 'Resend invitation',
                icon: <RefreshCw size={16} />,
                onPress: () => onResend(item),
                show: hasPermission('users.invite') && status !== 'accepted',
              },
              {
                key: 'revoke',
                label: 'Revoke invitation',
                icon: <Trash2 size={16} />,
                onPress: () => onRevoke(item.id),
                danger: true,
                show: hasPermission('users.invite'),
              },
            ]}
          />
        )
      },
    },
  ]
}
