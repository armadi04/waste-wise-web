import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { UserSearchParams } from '@/lib/schemas/users'
import type { ReportSearchParams } from '@/lib/schemas/reports'
import type { OAuthClient } from '@/lib/services/oauth-client.service'
import type { Invitation, PaginatedData } from '@/types/api'
import type { Permission, Role, UserProfile } from '@/types/auth'
import type { Media } from '@/types/media'
import { apiGet } from '@/lib/api'
import { getAuditActions, getAuditLogs } from '@/lib/services/audit.service'
import {
  getCurrentUser,
  getInvitation,
  getProfile,
} from '@/lib/services/auth.service'
import { getInvitations } from '@/lib/services/invitation.service'
import { getMediaList } from '@/lib/services/media.service'
import {
  getNotifications,
  getUnreadCount,
} from '@/lib/services/notification.service'
import { getOAuthClients } from '@/lib/services/oauth-client.service'
import { getPermissions } from '@/lib/services/permission.service'
import { getRoles } from '@/lib/services/role.service'
import { getMySessions, getSessions } from '@/lib/services/session.service'
import { getSignupsTrend, getStatsOverview } from '@/lib/services/stats.service'
import { getTwoFactorStatus } from '@/lib/services/two-factor.service'
import { getUsers } from '@/lib/services/user.service'
import { queryKeys } from '@/lib/query/keys'
import {
  getReport,
  getReportStats,
  getReports,
} from '@/lib/services/report.service'

export interface TableSearch {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: 'asc' | 'desc'
  action?: string
  createdIn?: UserSearchParams['createdIn']
  registerMethod?: UserSearchParams['registerMethod']
  accountStatus?: UserSearchParams['accountStatus']
}

export function usersQueryOptions(params: UserSearchParams) {
  const {
    page,
    limit,
    search,
    sort,
    direction,
    createdIn,
    registerMethod,
    accountStatus,
    timeZone,
  } = params
  return queryOptions({
    queryKey: queryKeys.users.list({
      page,
      limit,
      search,
      sort,
      direction,
      createdIn,
      registerMethod,
      accountStatus,
      timeZone,
    }),
    queryFn: () =>
      getUsers({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
        createdIn,
        timeZone,
        registerMethod,
        accountStatus,
      }) as Promise<PaginatedData<UserProfile>>,
    placeholderData: keepPreviousData,
  })
}

export function rolesQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  return queryOptions({
    queryKey: queryKeys.roles.list({ page, limit, search, sort, direction }),
    queryFn: () =>
      getRoles({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
      }) as Promise<PaginatedData<Role>>,
    placeholderData: keepPreviousData,
  })
}

export function permissionsQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  return queryOptions({
    queryKey: queryKeys.permissions.list({ page, limit, search, sort, direction }),
    queryFn: () =>
      getPermissions({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
      }) as Promise<PaginatedData<Permission>>,
    placeholderData: keepPreviousData,
  })
}

export function invitationsQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  return queryOptions({
    queryKey: queryKeys.invitations.list({ page, limit, search, sort, direction }),
    queryFn: () =>
      getInvitations({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
      }) as Promise<PaginatedData<Invitation>>,
    placeholderData: keepPreviousData,
  })
}

export function oauthClientsQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  return queryOptions({
    queryKey: queryKeys.oauthClients.list({ page, limit, search, sort, direction }),
    queryFn: () =>
      getOAuthClients({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
      }) as Promise<PaginatedData<OAuthClient>>,
    placeholderData: keepPreviousData,
  })
}

export function mediaQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  const DEFAULT_LIMIT = 24
  return queryOptions({
    queryKey: queryKeys.media.list({ page, limit, search, sort, direction }),
    queryFn: async () => {
      const response = await getMediaList({
        page: page || 1,
        limit: limit || DEFAULT_LIMIT,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        paginated: true,
      })
      return response as unknown as PaginatedData<Media>
    },
    placeholderData: keepPreviousData,
  })
}

export function auditActionsQueryOptions() {
  return queryOptions({ queryKey: queryKeys.audit.actions, queryFn: getAuditActions })
}

export function auditLogsQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction, action } = params
  return queryOptions({
    queryKey: queryKeys.audit.list({ page, limit, search, sort, direction, action }),
    queryFn: () =>
      getAuditLogs({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'createdAt',
        direction: direction || 'desc',
        action: action || undefined,
      }),
    placeholderData: keepPreviousData,
  })
}

export function mySessionsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.sessions.mine,
    queryFn: getMySessions,
  })
}

export function sessionsQueryOptions(params: TableSearch) {
  const { page, limit, search, sort, direction } = params
  return queryOptions({
    queryKey: queryKeys.sessions.list({ page, limit, search, sort, direction }),
    queryFn: () =>
      getSessions({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        sort: sort || 'lastActiveAt',
        direction: direction || 'desc',
      }),
    placeholderData: keepPreviousData,
  })
}


export function reportsQueryOptions(params: ReportSearchParams) {
  const {
    page,
    limit,
    search,
    status,
    category,
    from,
    to,
    reporterId,
    sort,
    direction,
  } = params
  return queryOptions({
    queryKey: queryKeys.reports.list({
      page,
      limit,
      search,
      status,
      category,
      from,
      to,
      reporterId,
      sort,
      direction,
    }),
    queryFn: () =>
      getReports({
        page: page || 1,
        limit: limit || 20,
        search: search || '',
        status,
        category,
        from,
        to,
        reporterId,
        sort: sort || 'createdAt',
        direction: direction || 'desc',
      }),
    placeholderData: keepPreviousData,
  })
}

export function reportQueryOptions(id: number) {
  return queryOptions({
    queryKey: queryKeys.reports.detail(id),
    queryFn: () => getReport(id),
    enabled: Number.isInteger(id) && id > 0,
  })
}

export function reportStatsQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: queryKeys.stats.reports,
    queryFn: getReportStats,
    enabled,
    staleTime: 1000 * 30,
  })
}

export function statsOverviewQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: queryKeys.stats.overview,
    queryFn: getStatsOverview,
    enabled,
    staleTime: 1000 * 60,
  })
}

export function signupsTrendQueryOptions(
  days = 30,
  enabled = true,
  timeZone = 'Asia/Jakarta',
) {
  return queryOptions({
    queryKey: queryKeys.stats.signups(days, timeZone),
    queryFn: () => getSignupsTrend(days, timeZone),
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export function recentActivityQueryOptions(limit = 8, enabled = true) {
  return queryOptions({
    queryKey: queryKeys.audit.recent(limit),
    queryFn: () =>
      getAuditLogs({ page: 1, limit, sort: 'createdAt', direction: 'desc' }),
    enabled,
    staleTime: 1000 * 30,
  })
}

export function healthQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: queryKeys.health,
    queryFn: () => apiGet<{ status: string }>('/health'),
    enabled,
    staleTime: 1000 * 30,
    retry: false,
  })
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.profile,
    queryFn: getProfile,

    staleTime: 1000 * 60 * 5,
  })
}

export function notificationsQueryOptions(page = 1, limit = 10) {
  return queryOptions({
    queryKey: queryKeys.notifications.list(page, limit),
    queryFn: () => getNotifications({ page, limit }),
    placeholderData: keepPreviousData,
  })
}

export function unreadCountQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: 60000, // Fallback polling every 1 minute
  })
}

export function twoFactorQueryOptions() {
  return queryOptions({ queryKey: queryKeys.twoFactor, queryFn: getTwoFactorStatus })
}

export function invitationQueryOptions(token?: string) {
  return queryOptions({
    queryKey: queryKeys.invitation(token),
    queryFn: () => getInvitation(token!),
    enabled: !!token,
    retry: false,
  })
}

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session,
    queryFn: getCurrentUser,
    staleTime: 30_000,
    retry: false,
  })
