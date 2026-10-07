import { addToast } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Invitation } from '@/types/api'
import { getColumns } from '@/components/features/invitations/components/table-columns'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useExportExcel } from '@/hooks/global/use-export-excel'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useInviteModal } from '@/hooks/invitations/use-invite-modal'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { invitationsQueryOptions } from '@/lib/query/options'
import {
  bulkRevokeInvitations,
  getInvitations,
  resendInvitation,
  revokeInvitation,
} from '@/lib/services/invitation.service'
import { useAuthStore } from '@/lib/stores/auth.store'

const routeApi = getRouteApi('/(users)/invitations')

const buildInviteUrl = (token: string) =>
  `${window.location.origin}/accept-invite?token=${token}`

export const useInvitations = () => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...invitationsQueryOptions({ page, limit, search, sort, direction }),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('users.invite') ?? false,
    ),
  })
}

export const useInvitationPage = () => {
  const tableState = useDataTable(routeApi)
  const { data, isLoading } = useInvitations()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()

  const { openInvite, inviteModalProps } = useInviteModal()
  const { allRoles } = inviteModalProps

  const resendMutation = useAppMutation({
    mutationFn: resendInvitation,
    invalidateKeys: ['invitations'],
    successMessage: 'Invitation resent',
  })

  const revokeMutation = useAppMutation({
    mutationFn: revokeInvitation,
    invalidateKeys: ['invitations'],
    successMessage: 'Invitation revoked',
  })

  const bulkRevokeMutation = useAppMutation({
    mutationFn: bulkRevokeInvitations,
    invalidateKeys: ['invitations'],
    successMessage: 'Invitations revoked',
  })

  const handleCopyLink = async (item: Invitation) => {
    await navigator.clipboard.writeText(buildInviteUrl(item.token))
    addToast({ title: 'Invite link copied to clipboard', color: 'success' })
  }

  const handleResend = (item: Invitation) => resendMutation.mutate(item.id)

  const handleRevoke = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Revoke Invitation',
      message: 'Are you sure you want to revoke this invitation?',
      color: 'danger',
    })
    if (isConfirmed) revokeMutation.mutate(id)
  }

  const handleBulkDelete = async (ids: Array<number>, clear: () => void) => {
    const isConfirmed = await confirm({
      title: 'Revoke Invitations',
      message: `Revoke ${ids.length} selected invitation(s)? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) bulkRevokeMutation.mutate(ids, { onSuccess: clear })
  }

  const columns = getColumns({
    roles: allRoles,
    onCopyLink: handleCopyLink,
    onResend: handleResend,
    onRevoke: handleRevoke,
    hasPermission,
  })

  const { onExport, isExporting } = useExportExcel({
    filename: 'Invitations',
    sheetName: 'Invitations',
    columns,
    fetchAll: async () => {
      const res = await getInvitations({ paginated: false })
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
      onBulkDelete: hasPermission('users.invite')
        ? handleBulkDelete
        : undefined,
      ...tableState,
      initialSearch: tableState.search,
      searchPlaceholder: 'Search invitations...',
    },
    inviteModalProps,
  }
}
