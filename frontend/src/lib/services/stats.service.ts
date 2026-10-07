import { apiGet } from '@/lib/api'

/** Counters behind the dashboard. Derived server-side from the feature tables. */
export interface StatsOverview {
  totalUsers: number
  verifiedUsers: number
  unverifiedUsers: number
  newUsers7d: number
  activeSessions: number
  failedLogins24h: number
  mediaCount: number
  mediaTotalBytes: number
  unreadNotifications: number
}

export interface TrendPoint {
  label: string
  value: number
}

export const getStatsOverview = () => apiGet<StatsOverview>('/stats/overview')

export const getSignupsTrend = (days = 30, timeZone = 'Asia/Jakarta') =>
  apiGet<Array<TrendPoint>>('/stats/signups', {
    params: { days, timeZone },
  })
