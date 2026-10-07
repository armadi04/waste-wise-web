import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Column } from '@/components/shared/datatable'
import type { Permission } from '@/types/auth'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatBusinessDate as format } from '@/lib/utils/format'

interface GetColumnsParams {
  onView: (permission: Permission) => void
  onEdit: (permission: Permission) => void
  onDelete: (id: number) => void
  hasPermission: (permission: string) => boolean
}

export const getColumns = ({
  onView,
  onEdit,
  onDelete,
  hasPermission,
}: GetColumnsParams): Array<Column<Permission>> => [
  { name: 'ID', uid: 'id', sortable: true },
  { name: 'Name', uid: 'name', sortable: true, truncate: true, maxWidth: 200 },
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
            show: hasPermission('permissions.read'),
          },
          {
            key: 'edit',
            label: 'Edit permission',
            icon: <Pencil size={16} />,
            onPress: () => onEdit(item),
            show: hasPermission('permissions.update'),
          },
          {
            key: 'delete',
            label: 'Delete permission',
            icon: <Trash2 size={16} />,
            onPress: () => onDelete(item.id),
            danger: true,
            show: hasPermission('permissions.delete'),
          },
        ]}
      />
    ),
  },
]
