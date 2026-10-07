import type { TableSearch } from '@/lib/query/options'
import type { CurrentUser } from '@/types/auth'
import type { QueryClient } from '@tanstack/react-query'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import {
  auditLogsQueryOptions,
  changelogQueryOptions,
  invitationsQueryOptions,
  mediaQueryOptions,
  notificationsQueryOptions,
  oauthClientsQueryOptions,
  permissionsQueryOptions,
  portalContentQueryOptions,
  portalCustomerQueryOptions,
  portalDashboardQueryOptions,
  portalRecordsQueryOptions,
  profileQueryOptions,
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
  search: TableSearch = {},
  resource?: string,
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
    case '/oauth-clients':
      if (allowed('oauth.clients.read'))
        return queryClient.ensureQueryData(oauthClientsQueryOptions(search))
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
    case '/changelog':
      return queryClient.ensureQueryData(changelogQueryOptions())
    case '/portal':
      if (allowed('portal.dashboard.read'))
        return queryClient.ensureQueryData(portalDashboardQueryOptions())
      return null
    case '/portal/content':
      if (allowed('portal.content.read'))
        return queryClient.ensureQueryData(portalContentQueryOptions())
      return null
    case '/portal/customers/$customerId':
      if (allowed('portal.customers.read'))
        return queryClient.ensureQueryData(
          portalCustomerQueryOptions(Number(resource)),
        )
      return null
    case '/portal/$resource': {
      const config = portalResourceConfig(resource ?? '')
      if (config && allowed(config.permission + '.read'))
        return queryClient.ensureQueryData(
          portalRecordsQueryOptions(config.resource, search),
        )
      return null
    }
    default:
      return queryClient.ensureQueryData(sessionQueryOptions())
  }
}
