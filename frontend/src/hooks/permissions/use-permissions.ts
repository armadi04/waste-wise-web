import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { CreatePermissionData } from '@/lib/services/permission.service'
import type { Permission } from '@/types/auth'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useExportExcel } from '@/hooks/global/use-export-excel'
import { useAppMutation } from '@/hooks/global/use-mutations'

import { getColumns } from '@/components/features/permissions/components/table-columns'
import { useAuth, useProfile } from '@/hooks/auth/use-auth'
import { permissionsQueryOptions } from '@/lib/query/options'
import {
  bulkDeletePermissions,
  createPermission,
  deletePermission,
  getPermissions,
  updatePermission,
} from '@/lib/services/permission.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { usePermissionsUiStore } from '@/lib/stores/permissions-ui.store'

const routeApi = getRouteApi('/(databases)/(permissions)/permissions')

// --- Data Hooks ---

export const useUserPermission = () => {
  const { data: profile } = useProfile()
  const { hasPermission: hasTokenPermission, user } = useAuth()
  const activeRole = user?.activeRole

  const checkPermission = useCallback(
    (permission: string) => {
      if (profile) {
        // Direct (role-independent) permissions always count.
        if (profile.permissions?.some((p) => p.name === permission)) return true
        // A multi-role user who has not picked an active role holds no role
        // permissions (the backend token grants direct-only), so deny — the
        // RoleSelectionGate blocks the app in this state anyway.
        if (!activeRole && (profile.roles?.length ?? 0) > 1) return false
        // Scope to the active role when chosen; a single-role user has no
        // choice to make, so their sole role's permissions apply.
        const roles = activeRole
          ? profile.roles?.filter((r) => r.name === activeRole)
          : profile.roles
        return (
          roles?.some((role) =>
            role.permissions?.some((p) => p.name === permission),
          ) ?? false
        )
      }
      return hasTokenPermission(permission)
    },
    [profile, activeRole, hasTokenPermission],
  )

  return { hasPermission: checkPermission }
}

export const usePermissions = () => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...permissionsQueryOptions({ page, limit, search, sort, direction }),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('permissions.read') ?? false,
    ),
  })
}

export const useAllPermissions = () => {
  return useQuery({
    queryKey: ['permissions', 'all'],
    queryFn: async () => {
      const response = await getPermissions({ paginated: false })
      return Array.isArray(response) ? response : response?.data || []
    },
  })
}

// --- Page Hook ---

export const usePermissionPage = () => {
  const tableState = useDataTable(routeApi)
  const { data, isLoading } = usePermissions()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()

  const ui = usePermissionsUiStore(
    useShallow((s) => ({
      open: s.open,
      close: s.close,
      onOpenChange: s.onOpenChange,
      isReadOnly: s.isReadOnly,
      formOpen: s.modals.form.isOpen,
      formEntity: s.modals.form.entity,
    })),
  )
  const editingPermission = ui.formEntity

  // Mutations
  const createMutation = useAppMutation({
    mutationFn: createPermission,
    invalidateKeys: ['permissions', 'roles', 'users'],
    successMessage: 'Permission created successfully',
    onSuccess: () => ui.close('form'),
  })

  const updateMutation = useAppMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<CreatePermissionData>) =>
      updatePermission(id, data),
    invalidateKeys: ['permissions', 'roles', 'users'],
    successMessage: 'Permission updated successfully',
    onSuccess: () => ui.close('form'),
  })

  const deleteMutation = useAppMutation({
    mutationFn: deletePermission,
    invalidateKeys: ['permissions', 'roles', 'users'],
    successMessage: 'Permission deleted successfully',
  })

  const bulkDeleteMutation = useAppMutation({
    mutationFn: bulkDeletePermissions,
    invalidateKeys: ['permissions', 'roles', 'users'],
    successMessage: 'Permissions deleted successfully',
  })

  // Handlers
  const handleCreate = () => ui.open('form', null)

  const handleView = (permission: Permission) =>
    ui.open('form', permission, { readOnly: true })

  const handleEdit = (permission: Permission) => ui.open('form', permission)

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Delete Permission',
      message: 'Are you sure?',
      color: 'danger',
    })
    if (isConfirmed) deleteMutation.mutate(id)
  }

  const handleBulkDelete = async (ids: Array<number>, clear: () => void) => {
    const isConfirmed = await confirm({
      title: 'Delete Permissions',
      message: `Delete ${ids.length} selected permission(s)? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) bulkDeleteMutation.mutate(ids, { onSuccess: clear })
  }

  const onSubmit = (data: CreatePermissionData) => {
    if (editingPermission) {
      updateMutation.mutate({ id: editingPermission.id, ...data })
    } else {
      createMutation.mutate(data)
    }
  }

  const columns = getColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasPermission,
  })

  const { onExport, isExporting } = useExportExcel({
    filename: 'Permissions',
    sheetName: 'Permissions',
    columns,
    fetchAll: async () => {
      const res = await getPermissions({ paginated: false })
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  return {
    tableProps: {
      data,
      columns,
      isLoading,
      onCreate: handleCreate,
      onExport,
      isExporting,
      onBulkDelete: hasPermission('permissions.delete')
        ? handleBulkDelete
        : undefined,
      ...tableState,
      initialSearch: tableState.search,
    },
    modalProps: {
      isOpen: ui.formOpen,
      onOpenChange: ui.onOpenChange('form'),
      editingPermission,
      onSubmit,
      isLoading: createMutation.isPending || updateMutation.isPending,
      isReadOnly: ui.isReadOnly,
    },
  }
}
