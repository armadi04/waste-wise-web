import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Column } from '@/components/shared/datatable'
import type { OAuthClient } from '@/lib/services/oauth-client.service'
import { Chip } from '@/components/shared/controls'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'

interface GetColumnsParams {
  onView: (client: OAuthClient) => void
  onEdit: (client: OAuthClient) => void
  onDelete: (id: number) => void
  hasPermission: (permission: string) => boolean
}

export const getColumns = ({
  onView,
  onEdit,
  onDelete,
  hasPermission,
}: GetColumnsParams): Array<Column<OAuthClient>> => [
  { name: 'ID', uid: 'id', sortable: true },
  { name: 'Name', uid: 'name', sortable: true, truncate: true, maxWidth: 200 },
  {
    name: 'Client ID',
    uid: 'clientId',
    truncate: true,
    maxWidth: 240,
    render: (item) => (
      <span className="font-mono text-xs">{item.clientId}</span>
    ),
    exportValue: (item) => item.clientId,
  },
  {
    name: 'Scopes',
    uid: 'scopes',
    render: (item) => (
      <Chip size="sm" variant="flat" color="primary" className="font-medium">
        {item.scopes.length} scope{item.scopes.length === 1 ? '' : 's'}
      </Chip>
    ),
    exportValue: (item) => item.scopes.join(' '),
  },
  {
    name: 'Status',
    uid: 'isActive',
    sortable: true,
    render: (item) => (
      <Chip
        size="sm"
        variant="flat"
        color={item.isActive ? 'success' : 'default'}
        className="font-medium"
      >
        {item.isActive ? 'Active' : 'Inactive'}
      </Chip>
    ),
    exportValue: (item) => (item.isActive ? 'Active' : 'Inactive'),
  },
  {
    name: 'Created At',
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
            key: 'view',
            label: 'View details',
            icon: <Eye size={16} />,
            onPress: () => onView(item),
            show: hasPermission('oauth.clients.read'),
          },
          {
            key: 'edit',
            label: 'Edit client',
            icon: <Pencil size={16} />,
            onPress: () => onEdit(item),
            show: hasPermission('oauth.clients.update'),
          },
          {
            key: 'delete',
            label: 'Revoke client',
            icon: <Trash2 size={16} />,
            onPress: () => onDelete(item.id),
            danger: true,
            show: hasPermission('oauth.clients.delete'),
          },
        ]}
      />
    ),
  },
]
