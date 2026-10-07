import {
  Activity,
  Bell,
  HardDrive,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { ActivityChart } from '@/components/features/dashboard/components/activity-chart'
import { QuickLinkCard } from '@/components/features/dashboard/components/quick-link-card'
import { RecentActivity } from '@/components/features/dashboard/components/recent-activity'
import { StatCard } from '@/components/features/dashboard/components/stat-card'
import { formatBytes } from '@/components/features/dashboard/pages/dashboard/lib/dashboard-page-helpers'
import { PageHeader } from '@/components/layout/page-header'
import { StatCardSkeleton } from '@/components/features/dashboard/skeletons'
import { useAuth, useProfile } from '@/hooks/auth'
import {
  useHealth,
  useRecentActivity,
  useSignupsTrend,
  useStatsOverview,
} from '@/hooks/dashboard'
import { useUserPermission } from '@/hooks/permissions'

export function Dashboard() {
  const [reportTimeZone, setReportTimeZone] = useState('Asia/Jakarta')
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { hasPermission } = useUserPermission()
  const displayName =
    profile?.fullname?.split(' ')[0] || user?.email?.split('@')[0]

  // Every panel is gated by the permission its data needs, so a user without
  // it never fires the request rather than firing it and being refused.
  const canViewStats = hasPermission('stats.read')
  const canViewAudit = hasPermission('audit.read')

  const { data: overview, isLoading: overviewLoading } =
    useStatsOverview(canViewStats)
  const { data: signups = [], isLoading: signupsLoading } = useSignupsTrend(
    30,
    canViewStats,
    reportTimeZone,
  )
  const { data: activity, isLoading: activityLoading } = useRecentActivity(
    8,
    canViewAudit,
  )
  const { data: health } = useHealth(canViewStats)
  const healthy = health?.status === 'ok'

  return (
    <div className="mx-auto flex min-h-full w-full flex-col pb-10">
      <PageHeader
        title={`Welcome back, ${displayName}`}
        breadcrumbs={[{ label: 'Overview', isCurrent: true }]}
      />

      {canViewStats && (
        <>
          <div className="mt-2 mb-6 grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
            {overviewLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))
            ) : (
              <>
                <StatCard
                  title="Total Users"
                  value={overview?.totalUsers ?? 0}
                  icon={<Users size={18} />}
                  color="primary"
                />
                <StatCard
                  title="Active Sessions"
                  value={overview?.activeSessions ?? 0}
                  icon={<Activity size={18} />}
                  color="warning"
                />
                <StatCard
                  title="Failed Sign-ins (24h)"
                  value={overview?.failedLogins24h ?? 0}
                  icon={<ShieldAlert size={18} />}
                  color={overview?.failedLogins24h ? 'danger' : 'success'}
                />
                <StatCard
                  title="Unverified Accounts"
                  value={overview?.unverifiedUsers ?? 0}
                  icon={<ShieldCheck size={18} />}
                  color="default"
                />
              </>
            )}
          </div>

          <label className="mb-3 text-sm">
            Zona laporan
            <select
              aria-label="Zona laporan statistik"
              className="ml-3 rounded-lg border border-default-200 bg-default-50 p-2"
              value={reportTimeZone}
              onChange={(event) => setReportTimeZone(event.target.value)}
            >
              <option value="Asia/Jakarta">WIB</option>
              <option value="Asia/Makassar">WITA</option>
              <option value="Asia/Jayapura">WIT</option>
            </select>
          </label>
          <ActivityChart
            title="New Signups"
            description="Accounts created (last 30 days)"
            data={signups}
            loading={signupsLoading}
            className="mb-6"
          />

          <h2 className="mb-3 text-sm font-semibold text-default-500">
            System &amp; Operations
          </h2>
          <div className="mb-6 grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              title="System Health"
              value={health ? (healthy ? 'Healthy' : 'Degraded') : '—'}
              icon={<Activity size={18} />}
              color={health ? (healthy ? 'success' : 'danger') : 'default'}
            />
            <StatCard
              title="Media Storage"
              value={formatBytes(overview?.mediaTotalBytes ?? 0)}
              icon={<HardDrive size={18} />}
              loading={overviewLoading}
            />
            <StatCard
              title="Media Files"
              value={overview?.mediaCount ?? 0}
              icon={<HardDrive size={18} />}
              loading={overviewLoading}
            />
            <StatCard
              title="Unread Notifications"
              value={overview?.unreadNotifications ?? 0}
              icon={<Bell size={18} />}
              color="warning"
              loading={overviewLoading}
            />
          </div>
        </>
      )}

      {canViewAudit && (
        <RecentActivity
          data={activity?.data ?? []}
          loading={activityLoading}
          className="mb-6"
        />
      )}

      {/* Quick links — each gated by the permission its target needs. */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
        {hasPermission('users.read') && (
          <QuickLinkCard
            to="/users"
            title="Manage Users"
            description="View and manage team members"
            icon={<Users size={18} />}
            color="primary"
          />
        )}
        {hasPermission('roles.read') && (
          <QuickLinkCard
            to="/roles"
            title="Manage Roles"
            description="Configure roles and permissions"
            icon={<Shield size={18} />}
            color="primary"
          />
        )}
        {hasPermission('media.read') && (
          <QuickLinkCard
            to="/media"
            title="Media Library"
            description="Browse and manage uploaded assets"
            icon={<HardDrive size={18} />}
            color="primary"
          />
        )}
      </div>
    </div>
  )
}
