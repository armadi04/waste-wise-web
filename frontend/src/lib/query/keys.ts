type Filters = Record<string, unknown>

export const queryKeys = {
  users: {
    all: ['users'],
    list: (filters: Filters) => ['users', filters],
    allList: ['users', 'all'],
  },
  roles: {
    all: ['roles'],
    list: (filters: Filters) => ['roles', filters],
  },
  permissions: {
    all: ['permissions'],
    list: (filters: Filters) => ['permissions', filters],
    allList: ['permissions', 'all'],
  },
  invitations: {
    all: ['invitations'],
    list: (filters: Filters) => ['invitations', filters],
  },
  media: {
    all: ['media'],
    list: (filters: Filters) => ['media', filters],
  },
  audit: {
    all: ['audit-logs'],
    list: (filters: Filters) => ['audit-logs', filters],
    recent: (limit: number) => ['audit-logs', 'recent', limit],
    actions: ['audit-actions'],
  },
  sessions: {
    all: ['sessions'],
    list: (filters: Filters) => ['sessions', filters],
    mine: ['my-sessions'],
  },
  reports: {
    all: ['reports'],
    list: (filters: Filters) => ['reports', filters],
    detail: (id: number) => ['reports', 'detail', id],
  },
  stats: {
    reports: ['stats', 'reports'],
    overview: ['stats', 'overview'],
    signups: (days: number, timeZone: string) => [
      'stats',
      'signups',
      days,
      timeZone,
    ],
  },
  notifications: {
    all: ['notifications'],
    list: (page: number, limit: number) => ['notifications', { page, limit }],
    unreadCount: ['notifications', 'unread-count'],
  },
  profile: ['profile'],
  twoFactor: ['two-factor'],
  invitation: (token?: string) => ['invitation', token],
  session: ['session'],
  health: ['health'],
}
