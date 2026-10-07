import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useDataTable } from '@/hooks/global/use-data-table'
import {
  auditActionsQueryOptions,
  auditLogsQueryOptions,
} from '@/lib/query/options'
import { useAuthStore } from '@/lib/stores/auth.store'

import { getColumns } from '@/components/features/audit/components/table-columns'

const routeApi = getRouteApi('/(audit)/audit-logs')

export const useAuditActions = () => useQuery(auditActionsQueryOptions())

export const useAuditLogPage = () => {
  const tableState = useDataTable(routeApi)
  const navigate = routeApi.useNavigate()
  const { page, limit, search, sort, direction, action } = routeApi.useSearch()

  const { data, isLoading } = useQuery({
    ...auditLogsQueryOptions({ page, limit, search, sort, direction, action }),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('audit.read') ?? false,
    ),
  })

  const { data: actions } = useAuditActions()

  return {
    actions: actions ?? [],
    action: action ?? '',
    // The action filter is table state like search and sorting, so it lives in
    // the URL rather than component state.
    onActionChange: (next: string) =>
      void navigate({
        search: (prev) => ({ ...prev, action: next || undefined, page: 1 }),
      }),
    tableProps: {
      data,
      columns: getColumns(),
      isLoading,
      enableSelection: false,
      searchPlaceholder: 'Search by actor, action, summary or IP…',
      emptyContent: 'Nothing recorded yet',
      ...tableState,
      initialSearch: tableState.search,
    },
  }
}
