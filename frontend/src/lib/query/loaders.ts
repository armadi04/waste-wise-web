import type { TableSearch } from '@/lib/query/options'
import type { ReportSearchParams } from '@/lib/schemas/reports'
import type { CurrentUser } from '@/types/auth'
import type { QueryClient } from '@tanstack/react-query'
import {
  auditLogsQueryOptions,
  invitationsQueryOptions,
  mediaQueryOptions,
  notificationsQueryOptions,
  permissionsQueryOptions,
  profileQueryOptions,
  reportQueryOptions,
  reportsQueryOptions,
  rolesQueryOptions,
  sessionQueryOptions,
  sessionsQueryOptions,
  statsOverviewQueryOptions,
  usersQueryOptions,
} from '@/lib/query/options'
import { requireAuth } from '@/lib/utils/route-guard'

type LoaderContext = { queryClient: QueryClient; session?: CurrentUser }
export async function loadAdminRoute(
  context: LoaderContext,
  route: string,
  search: TableSearch & Partial<ReportSearchParams> = {},
) {
  const session = context.session ?? (await requireAuth({ context })).session
  const queryClient = context.queryClient
  const allowed = (permission: string) =>
    session.permissions.includes(permission)
  switch (route) {
    case '/':
      if (allowed('stats.read'))
        return queryClient.ensureQueryData(statsOverviewQueryOptions())
      return null
    case '/reports':
      if (allowed('reports.read.all') || allowed('reports.read.own'))
        return queryClient.ensureQueryData(
          reportsQueryOptions(search as ReportSearchParams),
        )
      return null
    case '/reports/new':
      return null
    case '/users':
      if (allowed('users.read'))
        return queryClient.ensureQueryData(usersQueryOptions(search))
      return null
    case '/roles':
      if (allowed('roles.read'))
        return queryClient.ensureQueryData(rolesQueryOptions(search))
      return null
    case '/permissions':
      if (allowed('permissions.read'))
        return queryClient.ensureQueryData(permissionsQueryOptions(search))
      return null
    case '/invitations':
      if (allowed('users.invite'))
        return queryClient.ensureQueryData(invitationsQueryOptions(search))
      return null
    case '/media':
      if (allowed('media.read'))
        return queryClient.ensureQueryData(mediaQueryOptions(search))
      return null
    case '/audit-logs':
      if (allowed('audit.read'))
        return queryClient.ensureQueryData(auditLogsQueryOptions(search))
      return null
    case '/sessions':
      if (allowed('sessions.read'))
        return queryClient.ensureQueryData(sessionsQueryOptions(search))
      return null
    case '/profile':
      return queryClient.ensureQueryData(profileQueryOptions())
    case '/notifications':
      return queryClient.ensureQueryData(
        notificationsQueryOptions(search.page ?? 1, search.limit ?? 10),
      )
    default:
      return queryClient.ensureQueryData(sessionQueryOptions())
  }
}

export async function loadReportRoute(
  context: LoaderContext,
  reportId: number,
) {
  const session = context.session ?? (await requireAuth({ context })).session
  if (
    !session.permissions.includes('reports.read.all') &&
    !session.permissions.includes('reports.read.own')
  )
    return null
  return context.queryClient.ensureQueryData(reportQueryOptions(reportId))
}
