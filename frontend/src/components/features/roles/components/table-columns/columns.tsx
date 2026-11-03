import { Eye, Pencil, Shield, Trash2 } from 'lucide-react'
import type { Column } from '@/components/shared/datatable'
import type { Role } from '@/types/auth'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'

interface GetColumnsParams {
  onView: (role: Role) => void
  onEdit: (role: Role) => void
  onDelete: (id: number) => void
  onManagePermissions: (role: Role) => void
  hasPermission: (permission: string) => boolean
}

export const getColumns = ({
  onView,
  onEdit,
  onDelete,
  onManagePermissions,
  hasPermission,
}: GetColumnsParams): Array<Column<Role>> => [
  { name: 'ID', uid: 'id', sortable: true },
  { name: 'Name', uid: 'name', sortable: true, truncate: true, maxWidth: 160 },
  {
    name: 'Description',
    uid: 'description',
    sortable: true,
    truncate: true,
    maxWidth: 280,
  },
  {
    name: 'Created At',
    uid: 'createdAt',
    sortable: true,
    render: (item) => format(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    exportValue: (item) => format(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
  },
  {
    name: 'Permissions',
    uid: 'permissions',
    render: (item) => (
      <div className="flex items-center gap-2">
        <span className="text-small text-default-500">
          {item.permissions?.length || 0} permissions
        </span>
      </div>
    ),
    exportValue: (item) =>
      item.permissions?.map((p) => p.name).join(', ') || '',
  },
  {
    name: 'Actions',
    uid: 'actions',
    render: (item) => (
      <ActionMenu
        ariaLabel={`Actions for role ${item.name}`}
        actions={[
          {
            key: 'view',
            label: 'View details',
            icon: <Eye size={16} />,
            onPress: () => onView(item),
            show: hasPermission('roles.read'),
          },
          {
            key: 'permissions',
            label: 'Manage Permissions',
            icon: <Shield size={16} />,
            onPress: () => onManagePermissions(item),
            show: hasPermission('roles.manage_permissions'),
          },
          {
            key: 'edit',
            label: 'Edit role',
            icon: <Pencil size={16} />,
            onPress: () => onEdit(item),
            show: hasPermission('roles.update'),
          },
          {
            key: 'delete',
            label: 'Delete role',
            icon: <Trash2 size={16} />,
            onPress: () => onDelete(item.id),
            danger: true,
            show: hasPermission('roles.delete'),
          },
        ]}
      />
    ),
  },
]
