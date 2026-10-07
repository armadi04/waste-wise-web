import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { UserSession } from '@/lib/services/session.service'
import { getColumns } from '@/components/features/sessions/components/table-columns'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import {
  mySessionsQueryOptions,
  sessionsQueryOptions,
} from '@/lib/query/options'
import {
  revokeMyOtherSessions,
  revokeMySession,
  revokeSession,
} from '@/lib/services/session.service'
import { useAuthStore } from '@/lib/stores/auth.store'

const routeApi = getRouteApi('/(sessions)/sessions')

// --- Profile: the signed-in user's own devices ---

export const useMySessions = () => {
  return useQuery(mySessionsQueryOptions())
}

export const useMySessionsCard = () => {
  const { data, isLoading } = useMySessions()
  const { confirm } = useConfirmation()

  const revokeMutation = useAppMutation({
    mutationFn: revokeMySession,
    invalidateKeys: ['my-sessions'],
    successMessage: 'Session signed out',
  })

  const revokeOthersMutation = useAppMutation({
    mutationFn: revokeMyOtherSessions,
    invalidateKeys: ['my-sessions'],
    successMessage: 'Signed out of all other devices',
  })

  const handleRevoke = async (id: number) => {
    const isConfirmed = await confirm({
      title: 'Sign out device',
      message: 'That device will have to sign in again. Continue?',
      color: 'danger',
    })
    if (isConfirmed) revokeMutation.mutate(id)
  }

  const handleRevokeOthers = async () => {
    const isConfirmed = await confirm({
      title: 'Sign out everywhere else',
      message: 'Every device except this one will be signed out. Continue?',
      color: 'danger',
    })
    if (isConfirmed) revokeOthersMutation.mutate(undefined)
  }

  return {
    sessions: data ?? [],
    isLoading,
    onRevoke: handleRevoke,
    onRevokeOthers: handleRevokeOthers,
    pendingId: revokeMutation.isPending
      ? (revokeMutation.variables ?? null)
      : null,
    isRevokingOthers: revokeOthersMutation.isPending,
  }
}

// --- Admin: every session in the system ---

export const useSessions = () => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...sessionsQueryOptions({ page, limit, search, sort, direction }),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('sessions.read') ?? false,
    ),
  })
}

export const useSessionPage = () => {
  const tableState = useDataTable(routeApi)
  const { data, isLoading } = useSessions()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()

  const revokeMutation = useAppMutation({
    mutationFn: revokeSession,
    invalidateKeys: ['sessions', 'my-sessions'],
    successMessage: 'Session revoked',
  })

  const handleRevoke = async (session: UserSession) => {
    const isConfirmed = await confirm({
      title: 'Revoke session',
      message: `Sign out ${session.user?.email ?? 'this user'} on that device? Their tokens stop working immediately.`,
      color: 'danger',
    })
    if (isConfirmed) revokeMutation.mutate(session.id)
  }

  const columns = getColumns({ onRevoke: handleRevoke, hasPermission })

  return {
    tableProps: {
      data,
      columns,
      isLoading,
      enableSelection: false,
      showExport: false,
      searchPlaceholder: 'Search by user, IP or device…',
      emptyContent: 'No sessions found',
      pendingRowId: revokeMutation.isPending
        ? (revokeMutation.variables ?? null)
        : null,
      ...tableState,
      initialSearch: tableState.search,
    },
  }
}
