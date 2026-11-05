import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  HardDrive,
  Loader,
  Recycle,
  ShieldAlert,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { ActivityChart } from '@/components/features/dashboard/components/activity-chart'
import { DistributionChart } from '@/components/features/dashboard/components/distribution-chart'
import { QuickLinkCard } from '@/components/features/dashboard/components/quick-link-card'
import { RecentActivity } from '@/components/features/dashboard/components/recent-activity'
import { RecentReports } from '@/components/features/dashboard/components/recent-reports'
import { StatCard } from '@/components/features/dashboard/components/stat-card'
import { formatBytes } from '@/components/features/dashboard/pages/dashboard/lib/dashboard-page-helpers'
import { PageHeader } from '@/components/layout/page-header'
import { StatCardSkeleton } from '@/components/features/dashboard/skeletons'
import { useAuth, useProfile } from '@/hooks/auth'
import {
  useHealth,
  useRecentActivity,
  useReportStats,
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

  const canViewReports =
    hasPermission('reports.read.own') || hasPermission('reports.read.all')
  const canViewAllReports = hasPermission('reports.read.all')
  const canViewStats = hasPermission('stats.read')
  const canViewAudit = hasPermission('audit.read')
  const canCreateReport = hasPermission('reports.create')

  const { data: reportStats, isLoading: reportStatsLoading } =
    useReportStats(canViewReports)
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

  const statusData = [
    {
      label: 'Pending',
      value: reportStats?.pending ?? 0,
      color: 'var(--app-warning)',
    },
    {
      label: 'In Progress',
      value: reportStats?.inProgress ?? 0,
      color: 'var(--app-primary)',
    },
    {
      label: 'Completed',
      value: reportStats?.completed ?? 0,
      color: 'var(--app-success)',
    },
    {
      label: 'Rejected',
      value: reportStats?.rejected ?? 0,
      color: 'var(--app-danger)',
    },
  ]

  const categoryData = [
    {
      label: 'Organic',
      value: reportStats?.byCategory.organic ?? 0,
      color: 'var(--app-success)',
    },
    {
      label: 'Plastic',
      value: reportStats?.byCategory.plastic ?? 0,
      color: 'var(--app-primary)',
    },
    {
      label: 'Paper',
      value: reportStats?.byCategory.paper ?? 0,
      color: 'var(--app-warning)',
    },
    {
      label: 'Unclassified',
      value: reportStats?.byCategory.unclassified ?? 0,
      color: 'var(--app-muted-foreground)',
    },
  ]

  return (
    <div className="mx-auto flex min-h-full w-full flex-col pb-10">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${displayName}. Report activity and waste handling at a glance.`}
        breadcrumbs={[{ label: 'Dashboard', isCurrent: true }]}
      />

      {canViewReports && (
        <>
          <div className="mt-2 mb-6 grid w-full grid-cols-2 gap-4 lg:grid-cols-5">
            {reportStatsLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <StatCardSkeleton key={index} />
              ))
            ) : (
              <>
                <StatCard
                  title="Total Reports"
                  value={reportStats?.total ?? 0}
                  icon={<Recycle size={18} />}
                  color="primary"
                />
                <StatCard
                  title="Pending"
                  value={reportStats?.pending ?? 0}
                  icon={<Clock size={18} />}
                  color="warning"
                />
                <StatCard
                  title="In Progress"
                  value={reportStats?.inProgress ?? 0}
                  icon={<Loader size={18} />}
                  color="primary"
                />
                <StatCard
                  title="Completed"
                  value={reportStats?.completed ?? 0}
                  icon={<CheckCircle2 size={18} />}
                  color="success"
                />
                <StatCard
                  title="Rejected"
                  value={reportStats?.rejected ?? 0}
                  icon={<XCircle size={18} />}
                  color="danger"
                />
              </>
            )}
          </div>

          <div className="mb-6 grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
            <DistributionChart
              title="Reports by Status"
              description={
                canViewAllReports
                  ? 'All reports in the system.'
                  : 'Your reports only.'
              }
              data={statusData}
              loading={reportStatsLoading}
            />
            <DistributionChart
              title="Waste Categories"
              description="AI classification distribution."
              data={categoryData}
              loading={reportStatsLoading}
            />
          </div>

          <RecentReports
            reports={reportStats?.recentReports ?? []}
            loading={reportStatsLoading}
            className="mb-6"
          />
        </>
      )}

      <div className="mb-6 grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {canCreateReport && (
          <QuickLinkCard
            to="/reports/new"
            title="Create Report"
            description="Upload a waste photo and send it for handling"
            icon={<Recycle size={18} />}
            color="primary"
          />
        )}
        {canViewReports && (
          <QuickLinkCard
            to="/reports"
            title="Browse Reports"
            description="Search, filter, and track report status"
            icon={<Activity size={18} />}
            color="primary"
          />
        )}
        {hasPermission('users.read') && (
          <QuickLinkCard
            to="/users"
            title="Manage Users"
            description="View and manage team members"
            icon={<Users size={18} />}
            color="primary"
          />
        )}
      </div>

      {canViewStats && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            System &amp; Operations
          </h2>
          <div className="mt-2 mb-6 grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
            {overviewLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <StatCardSkeleton key={index} />
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
              className="app-field-control ml-3 rounded-lg p-2"
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
    </div>
  )
}
