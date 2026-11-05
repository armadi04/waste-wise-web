import { useQuery } from '@tanstack/react-query'
import {
  healthQueryOptions,
  recentActivityQueryOptions,
  reportStatsQueryOptions,
  signupsTrendQueryOptions,
  statsOverviewQueryOptions,
} from '@/lib/query/options'

/** Dashboard counters. Every hook is gated so a user without the permission never asks. */
export const useStatsOverview = (enabled = true) =>
  useQuery(statsOverviewQueryOptions(enabled))

export const useSignupsTrend = (
  days = 30,
  enabled = true,
  timeZone = 'Asia/Jakarta',
) => useQuery(signupsTrendQueryOptions(days, enabled, timeZone))

/** The newest audit entries, reused as the dashboard's activity feed. */
export const useRecentActivity = (limit = 8, enabled = true) =>
  useQuery(recentActivityQueryOptions(limit, enabled))

export const useHealth = (enabled = true) =>
  useQuery(healthQueryOptions(enabled))

export const useReportStats = (enabled = true) =>
  useQuery(reportStatsQueryOptions(enabled))
