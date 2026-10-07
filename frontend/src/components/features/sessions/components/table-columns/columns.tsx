import { Chip } from '@heroui/react'
import { LogOut } from 'lucide-react'
import type { GetColumnsParams } from '@/components/features/sessions/components/table-columns/types'
import type { Column } from '@/components/shared/datatable'
import type { UserSession } from '@/lib/services/session.service'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'
import { describeUserAgent } from '@/lib/utils/user-agent'

import { statusOf } from '@/components/features/sessions/components/table-columns/lib/columns-helpers'

export const getColumns = ({
  onRevoke,
  hasPermission,
}: GetColumnsParams): Array<Column<UserSession>> => [
  {
    name: 'User',
    uid: 'user',
    truncate: true,
    maxWidth: 220,
    render: (item) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {item.user?.fullname ?? `User #${item.userId}`}
        </p>
        <p className="truncate text-xs text-default-400">{item.user?.email}</p>
      </div>
    ),
    exportValue: (item) => item.user?.email ?? String(item.userId),
  },
  {
    name: 'Device',
    uid: 'userAgent',
    truncate: true,
    maxWidth: 200,
    render: (item) => (
      <div className="flex items-center gap-2">
        <span className="text-sm">{describeUserAgent(item.userAgent)}</span>
        <Chip
          size="sm"
          variant="flat"
          color={item.audience === 'portal' ? 'primary' : 'default'}
        >
          {item.audience === 'portal' ? 'Portal' : 'Admin'}
        </Chip>
        {item.isSso && (
          <Chip size="sm" variant="flat" color="secondary">
            SSO
          </Chip>
        )}
        {item.impersonatedById !== null && (
          <Chip size="sm" variant="flat" color="warning">
            Impersonated
          </Chip>
        )}
      </div>
    ),
    exportValue: (item) => describeUserAgent(item.userAgent),
  },
  {
    name: 'IP Address',
    uid: 'ipAddress',
    render: (item) => (
      <span className="font-mono text-xs">{item.ipAddress ?? '—'}</span>
    ),
    exportValue: (item) => item.ipAddress ?? '',
  },
  {
    name: 'Status',
    uid: 'revokedAt',
    sortable: true,
    render: (item) => {
      const status = statusOf(item)
      return (
        <Chip
          size="sm"
          variant="flat"
          color={status.color}
          className="font-medium"
        >
          {status.label}
        </Chip>
      )
    },
    exportValue: (item) => statusOf(item).label,
  },
  {
    name: 'Last Active',
    uid: 'lastActiveAt',
    sortable: true,
    render: (item) => format(item.lastActiveAt, 'yyyy-MM-dd HH:mm:ss'),
    exportValue: (item) => format(item.lastActiveAt, 'yyyy-MM-dd HH:mm:ss'),
  },
  {
    name: 'Signed In',
    uid: 'createdAt',
    sortable: true,
    render: (item) => format(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    exportValue: (item) => format(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
  },
  {
    name: 'Actions',
    uid: 'actions',
    render: (item) => (
      <ActionMenu
        actions={[
          {
            key: 'revoke',
            label: 'Revoke session',
            icon: <LogOut size={16} />,
            onPress: () => onRevoke(item),
            danger: true,
            show:
              hasPermission('sessions.delete') &&
              statusOf(item).label === 'Active',
          },
        ]}
      />
    ),
  },
]
