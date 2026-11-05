import {
  Eye,
  KeyRound,
  Lock,
  LogIn,
  Pencil,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react'
import type { GetColumnsParams } from '@/components/features/users/components/table-columns/types'
import type { Column } from '@/components/shared/datatable'
import type { UserProfile } from '@/types/auth'
import { Chip } from '@/components/shared/controls'
import { ActionMenu } from '@/components/shared/action-menu'
import {
  REGISTER_METHOD_COLOR,
  REGISTER_METHOD_LABEL,
} from '@/lib/constants/register-method'
import { ACCOUNT_STATUS_LABEL } from '@/lib/constants/account-status'
import { AccountStatusBadge } from '@/components/features/users/components/account-status-badge'
import { formatBusinessDate as format } from '@/lib/utils/format'

export const getColumns = ({
  onView,
  onEdit,
  onDelete,
  onToggleActive,
  onManageRoles,
  onManagePermissions,
  onResetPassword,
  onImpersonate,
  hasPermission,
  currentUserId,
}: GetColumnsParams): Array<Column<UserProfile>> => [
  { name: 'ID', uid: 'id', sortable: true },
  {
    name: 'Full Name',
    uid: 'fullname',
    sortable: true,
    truncate: true,
    maxWidth: 180,
  },
  {
    name: 'Email',
    uid: 'email',
    sortable: true,
    truncate: true,
    maxWidth: 220,
  },
  {
    name: 'Roles',
    uid: 'roles',
    render: (item) => (
      <span className="text-small text-default-600">
        {item.roles?.map((role) => role.name).join(', ') || 'No role'}
      </span>
    ),
    exportValue: (item) => item.roles?.map((r) => r.name).join(', ') || '',
  },
  {
    name: 'Account Status',
    uid: 'accountStatus',
    render: (item) => (
      <AccountStatusBadge
        status={item.accountStatus}
        emailVerifiedAt={item.emailVerifiedAt}
      />
    ),
    exportValue: (item) =>
      ACCOUNT_STATUS_LABEL[
        item.accountStatus ?? (item.emailVerifiedAt ? 'ACTIVE' : 'UNVERIFIED')
      ],
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
    name: 'Register Method',
    uid: 'registerMethod',
    sortable: true,
    render: (item) => (
      <Chip
        size="sm"
        variant="flat"
        color={REGISTER_METHOD_COLOR[item.registerMethod ?? 'UNKNOWN']}
      >
        {REGISTER_METHOD_LABEL[item.registerMethod ?? 'UNKNOWN']}
      </Chip>
    ),
    exportValue: (item) =>
      REGISTER_METHOD_LABEL[item.registerMethod ?? 'UNKNOWN'],
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
        ariaLabel={`Actions for ${item.email}`}
        actions={[
          {
            key: 'view',
            label: 'View details',
            icon: <Eye size={16} />,
            onPress: () => onView(item),
            show: hasPermission('users.read'),
          },
          {
            key: 'roles',
            label: 'Manage Roles',
            icon: <Shield size={16} />,
            onPress: () => onManageRoles(item),
            show: hasPermission('users.manage_roles'),
          },
          {
            key: 'permissions',
            label: 'Manage Permissions',
            icon: <Lock size={16} />,
            onPress: () => onManagePermissions(item),
            show: hasPermission('users.manage_permissions'),
          },
          {
            key: 'edit',
            label: 'Edit user',
            icon: <Pencil size={16} />,
            onPress: () => onEdit(item),
            show: hasPermission('users.update'),
          },
          {
            key: 'reset',
            label: 'Reset password',
            icon: <KeyRound size={16} />,
            onPress: () => onResetPassword(item),
            show: hasPermission('users.update'),
          },
          {
            key: 'impersonate',
            label: 'Login as this user',
            icon: <LogIn size={16} />,
            onPress: () => onImpersonate(item),
            show:
              hasPermission('users.impersonate') && item.id !== currentUserId,
          },
          {
            key: 'toggle-active',
            label: item.isActive === false ? 'Activate user' : 'Deactivate user',
            icon:
              item.isActive === false ? (
                <UserCheck size={16} />
              ) : (
                <UserX size={16} />
              ),
            onPress: () => onToggleActive(item),
            danger: item.isActive !== false,
            show:
              hasPermission('users.manage_status') && item.id !== currentUserId,
          },
          {
            key: 'delete',
            label: 'Delete user',
            icon: <Trash2 size={16} />,
            onPress: () => onDelete(item.id),
            danger: true,
            show: hasPermission('users.delete'),
          },
        ]}
      />
    ),
  },
]
