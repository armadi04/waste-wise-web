import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import type { OAuthClientFormData } from '@/lib/schemas/oauth-clients'
import type {
  CreateOAuthClientData,
  OAuthClient,
} from '@/lib/services/oauth-client.service'
import { getColumns } from '@/components/features/oauth-clients/components/table-columns'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useExportExcel } from '@/hooks/global/use-export-excel'
import { useAppMutation } from '@/hooks/global/use-mutations'
import {
  useAllPermissions,
  useUserPermission,
} from '@/hooks/permissions/use-permissions'
import { oauthClientsQueryOptions } from '@/lib/query/options'
import {
  bulkDeleteOAuthClients,
  createOAuthClient,
  deleteOAuthClient,
  getOAuthClients,
  updateOAuthClient,
} from '@/lib/services/oauth-client.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useOAuthClientsUiStore } from '@/lib/stores/oauth-clients-ui.store'

const routeApi = getRouteApi('/(databases)/(oauth)/oauth-clients')

// --- Data Hooks ---

export const useOAuthClients = () => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...oauthClientsQueryOptions({ page, limit, search, sort, direction }),
    enabled: useAuthStore(
      (state) =>
        state.user?.permissions.includes('oauth.clients.read') ?? false,
    ),
  })
}

// --- Page Hook ---

export const useOAuthClientPage = () => {
  const tableState = useDataTable(routeApi)
  const { data, isLoading } = useOAuthClients()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()
  const { data: allPermissions } = useAllPermissions()
  const scopeOptions = (allPermissions ?? []).map((p) => p.name)

  const [createdSecret, setCreatedSecret] = useState<{
    clientId: string
    clientSecret: string
  } | null>(null)

  const ui = useOAuthClientsUiStore(
    useShallow((s) => ({
      open: s.open,
      close: s.close,
      onOpenChange: s.onOpenChange,
      isReadOnly: s.isReadOnly,
      formOpen: s.modals.form.isOpen,
      formEntity: s.modals.form.entity,
    })),
  )
  const editingClient = ui.formEntity

  // Mutations
  const createMutation = useAppMutation({
    mutationFn: createOAuthClient,
    invalidateKeys: ['oauth-clients'],
    successMessage: 'OAuth client created successfully',
    // Keep the modal open to reveal the one-time secret instead of closing.
    onSuccess: (issued) =>
      setCreatedSecret({
        clientId: issued.client.clientId,
        clientSecret: issued.clientSecret,
      }),
  })

  const updateMutation = useAppMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<CreateOAuthClientData> & {
        isActive?: boolean
      }) => updateOAuthClient(id, data),
    invalidateKeys: ['oauth-clients'],
    successMessage: 'OAuth client updated successfully',
    onSuccess: () => ui.close('form'),
  })

  const deleteMutation = useAppMutation({
    mutationFn: deleteOAuthClient,
    invalidateKeys: ['oauth-clients'],
    successMessage: 'OAuth client revoked successfully',
  })

  const bulkDeleteMutation = useAppMutation({
    mutationFn: bulkDeleteOAuthClients,
    invalidateKeys: ['oauth-clients'],
    successMessage: 'OAuth clients revoked successfully',
  })

  // Handlers
  const handleCreate = () => {
    setCreatedSecret(null)
    ui.open('form', null)
  }

  const handleView = (client: OAuthClient) =>
    ui.open('form', client, { readOnly: true })

  const handleEdit = (client: OAuthClient) => ui.open('form', client)

  const handleDelete = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Revoke OAuth Client',
      message:
        'Are you sure? Any tokens issued to this client will stop working.',
      color: 'danger',
    })
    if (isConfirmed) deleteMutation.mutate(id)
  }

  const handleBulkDelete = async (ids: Array<number>, clear: () => void) => {
    const isConfirmed = await confirm({
      title: 'Revoke OAuth Clients',
      message: `Revoke ${ids.length} selected client(s)? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) bulkDeleteMutation.mutate(ids, { onSuccess: clear })
  }

  const onSubmit = (formData: OAuthClientFormData) => {
    if (editingClient) {
      updateMutation.mutate({
        id: editingClient.id,
        name: formData.name,
        scopes: formData.scopes,
        isActive: formData.isActive,
      })
    } else {
      createMutation.mutate({ name: formData.name, scopes: formData.scopes })
    }
  }

  // Wrap close so dismissing the modal also clears any revealed secret.
  const handleOpenChange = (open: boolean) => {
    if (!open) setCreatedSecret(null)
    ui.onOpenChange('form')(open)
  }

  const columns = getColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasPermission,
  })

  const { onExport, isExporting } = useExportExcel({
    filename: 'OAuthClients',
    sheetName: 'OAuthClients',
    columns,
    fetchAll: async () => {
      const res = await getOAuthClients({ paginated: false })
      return Array.isArray(res) ? res : res?.data || []
    },
  })

  return {
    tableProps: {
      data,
      columns,
      isLoading,
      onCreate: hasPermission('oauth.clients.create')
        ? handleCreate
        : undefined,
      onExport,
      isExporting,
      onBulkDelete: hasPermission('oauth.clients.delete')
        ? handleBulkDelete
        : undefined,
      ...tableState,
      initialSearch: tableState.search,
    },
    modalProps: {
      isOpen: ui.formOpen,
      onOpenChange: handleOpenChange,
      editingClient,
      onSubmit,
      isLoading: createMutation.isPending || updateMutation.isPending,
      isReadOnly: ui.isReadOnly,
      scopeOptions,
      createdSecret,
    },
  }
}
