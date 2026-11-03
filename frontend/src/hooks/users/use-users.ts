import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { createElement } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { CreateUserData } from '@/lib/services/user.service'
import type { UserProfile } from '@/types/auth'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useExportExcel } from '@/hooks/global/use-export-excel'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useInviteModal } from '@/hooks/invitations/use-invite-modal'

import { getColumns } from '@/components/features/users/components/table-columns'
import { UsersFilters } from '@/components/features/users/components/users-filters'
import { useAuth } from '@/hooks/auth/use-auth'
import {
  useAllPermissions,
  useUserPermission,
} from '@/hooks/permissions/use-permissions'
import { useAllRoles } from '@/hooks/roles/use-roles'
import { useImpersonation } from '@/hooks/users/use-impersonation'
import { queryKeys } from '@/lib/query/keys'
import { usersQueryOptions } from '@/lib/query/options'
import {
  bulkDeleteUsers,
  deleteUser,
  getUsers,
  resetUserPassword,
  syncUserPermissions,
  syncUserRoles,
  updateUser,
  updateUserStatus,
} from '@/lib/services/user.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useUsersUiStore } from '@/lib/stores/users-ui.store'

const routeApi = getRouteApi('/(users)/users')

export const useUsers = () => {
  const searchParams = routeApi.useSearch()

  return useQuery({
    ...usersQueryOptions(searchParams),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('users.read') ?? false,
    ),
  })
}

export const useAllUsers = (enabled = true) => {
  return useQuery({
    queryKey: queryKeys.users.allList,
    queryFn: async () => {
      const response = await getUsers({ paginated: false })
      return Array.isArray(response) ? response : response?.data || []
    },
    enabled,
  })
}

// --- Page Hook ---

export const useUserPage = () => {
  const tableState = useDataTable(routeApi)
  const searchParams = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { data, isLoading } = useUsers()
  const { data: allRoles = [] } = useAllRoles()
  const { data: allPermissions = [] } = useAllPermissions()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()
  const { user: currentUser } = useAuth()
  const impersonation = useImpersonation()

  const { openInvite, inviteModalProps } = useInviteModal()

  // Select only open/entity/readOnly (stable across modal search keystrokes) so
  // typing in a selection modal doesn't re-render the table.
  const ui = useUsersUiStore(
    useShallow((s) => ({
      open: s.open,
      close: s.close,
      onOpenChange: s.onOpenChange,
      isReadOnly: s.isReadOnly,
      formOpen: s.modals.form.isOpen,
      formEntity: s.modals.form.entity,
      rolesOpen: s.modals.roles.isOpen,
      rolesUser: s.modals.roles.entity,
      permissionsOpen: s.modals.permissions.isOpen,
      permissionsUser: s.modals.permissions.entity,
      resetOpen: s.modals.resetPassword.isOpen,
      resetUser: s.modals.resetPassword.entity,
    })),
  )
  const editingUser = ui.formEntity

  // Mutations
  const updateMutation = useAppMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateUserData> }) =>
      updateUser(id, data),
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'User updated successfully',
    onSuccess: () => ui.close('form'),
  })

  const statusMutation = useAppMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateUserStatus(id, isActive),
    invalidateKeys: [queryKeys.users.all, queryKeys.sessions.all],
    successMessage: 'User status updated',
  })

  const deleteMutation = useAppMutation({
    mutationFn: deleteUser,
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'User deleted successfully',
  })

  const bulkDeleteMutation = useAppMutation({
    mutationFn: bulkDeleteUsers,
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'Users deleted successfully',
  })

  const syncRolesMutation = useAppMutation({
    mutationFn: ({ id, roles }: { id: number; roles: Array<number> }) =>
      syncUserRoles(id, roles),
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'Roles updated successfully',
    onSuccess: () => ui.close('roles'),
  })

  const syncPermissionsMutation = useAppMutation({
    mutationFn: ({
      id,
      permissions,
    }: {
      id: number
      permissions: Array<number>
    }) => syncUserPermissions(id, permissions),
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'Permissions updated successfully',
    onSuccess: () => ui.close('permissions'),
  })

  const resetPasswordMutation = useAppMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      resetUserPassword(id, password),
    invalidateKeys: [queryKeys.users.all],
    successMessage: 'Password reset successfully',
    onSuccess: () => ui.close('resetPassword'),
  })

  // Handlers
  const handleView = (user: UserProfile) =>
    ui.open('form', user, { readOnly: true })

  const handleEdit = (user: UserProfile) => ui.open('form', user)

  const handleManageRoles = (user: UserProfile) =>
    ui.open('roles', user, {
      selected: (user.roles || []).map((r) => r.id),
    })

  const handleManagePermissions = (user: UserProfile) =>
    ui.open('permissions', user, {
      selected: (user.permissions || []).map((p) => p.id),
    })

  const handleResetPassword = (user: UserProfile) =>
    ui.open('resetPassword', user)

  const handleImpersonate = async (user: UserProfile) => {
    const isConfirmed = await confirm({
      title: 'Login as this user',
      message: `You will be signed in as ${user.fullname || user.email} until you return to your own account. Your current session ends here.`,
      color: 'warning',
    })
    if (!isConfirmed) return

    await impersonation.start(user.id)
  }

  const handleToggleActive = async (user: UserProfile) => {
    const next = user.isActive === false
    const isConfirmed = await confirm({
      title: next ? 'Activate User' : 'Deactivate User',
      message: next
        ? `${user.fullname || user.email} will be able to sign in again.`
        : `${user.fullname || user.email} will be signed out and cannot sign in until reactivated.`,
      color: next ? 'primary' : 'danger',
      confirmText: next ? 'Activate user' : 'Deactivate user',
      cancelText: 'Cancel',
    })
    if (isConfirmed) statusMutation.mutate({ id: user.id, isActive: next })
  }

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Delete User',
      message: 'Are you sure you want to delete this user?',
      color: 'danger',
    })
    if (isConfirmed) deleteMutation.mutate(id)
  }

  const handleBulkDelete = async (ids: Array<number>, clear: () => void) => {
    const isConfirmed = await confirm({
      title: 'Delete Users',
      message: `Delete ${ids.length} selected user(s)? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) bulkDeleteMutation.mutate(ids, { onSuccess: clear })
  }

  const onSubmit = (data: CreateUserData) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data })
    }
  }

  const columns = getColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onToggleActive: handleToggleActive,
    onManageRoles: handleManageRoles,
    onManagePermissions: handleManagePermissions,
    onResetPassword: handleResetPassword,
    onImpersonate: handleImpersonate,
    hasPermission,
    currentUserId: currentUser?.sub,
  })

  const { onExport, isExporting } = useExportExcel({
    filename: 'Users',
    sheetName: 'Users',
    columns,
    fetchAll: async () => {
      const {
        search,
        sort,
        direction,
        createdIn,
        registerMethod,
        accountStatus,
        timeZone,
      } = searchParams
      const filters = {
        search,
        sort,
        direction,
        createdIn,
        registerMethod,
        accountStatus,
        timeZone,
      }
      const res = await getUsers({ ...filters, paginated: false })
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  return {
    tableProps: {
      data,
      columns,
      isLoading,
      onCreate: hasPermission('users.invite') ? openInvite : undefined,
      onExport,
      isExporting,
      onBulkDelete: hasPermission('users.delete')
        ? handleBulkDelete
        : undefined,
      ...tableState,
      initialSearch: tableState.search,
      pendingRowId: statusMutation.isPending
        ? statusMutation.variables?.id
        : deleteMutation.isPending
          ? deleteMutation.variables
          : undefined,
      headerActions: createElement(UsersFilters, {
        value: searchParams,
        onChange: (filters) => {
          void navigate({
            search: (prev) => ({ ...prev, ...filters, page: 1 }),
          })
        },
      }),
    },
    inviteModalProps,
    modalProps: {
      isOpen: ui.formOpen,
      onOpenChange: ui.onOpenChange('form'),
      editingUser,
      onSubmit,
      isLoading: updateMutation.isPending,
      isReadOnly: ui.isReadOnly,
    },
    rolesModalProps: {
      isOpen: ui.rolesOpen,
      onOpenChange: ui.onOpenChange('roles'),
      user: ui.rolesUser,
      allRoles,
      isLoading: syncRolesMutation.isPending,
      onSave: (id: number, roles: Array<number>) =>
        syncRolesMutation.mutate({ id, roles }),
    },
    permissionsModalProps: {
      isOpen: ui.permissionsOpen,
      onOpenChange: ui.onOpenChange('permissions'),
      user: ui.permissionsUser,
      allPermissions,
      isLoading: syncPermissionsMutation.isPending,
      onSave: (id: number, permissions: Array<number>) =>
        syncPermissionsMutation.mutate({ id, permissions }),
    },
    resetPasswordModalProps: {
      isOpen: ui.resetOpen,
      onOpenChange: ui.onOpenChange('resetPassword'),
      user: ui.resetUser,
      isLoading: resetPasswordMutation.isPending,
      onSubmit: (id: number, password: string) =>
        resetPasswordMutation.mutate({ id, password }),
    },
  }
}
