import { Link } from '@tanstack/react-router'
import { Card } from '@heroui/react'
import type { Report } from '@/types/api'
import {
  ReportStatusBadge,
  WasteCategoryBadge,
} from '@/components/features/reports/components/report-badges'
import { formatDateTime } from '@/lib/utils/format'

export function RecentReports({
  reports,
  loading,
  className,
}: {
  reports: Array<Report>
  loading?: boolean
  className?: string
}) {
  return (
    <Card
      className={`bg-content1 rounded-large p-6 shadow-none border border-default-200${className ? ` ${className}` : ''}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-default-800">
            Recent Reports
          </h3>
          <p className="text-xs text-default-400 mt-0.5">
            Latest waste reports visible to you.
          </p>
        </div>
        <Link
          to="/reports"
          className="-my-2 shrink-0 py-2 text-sm text-[var(--app-link)]"
        >
          View all
        </Link>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-large bg-default-100"
            />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="py-8 text-center text-sm text-default-500">
          No reports yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-default-200">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                to="/reports/$reportId"
                params={{ reportId: String(report.id) }}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 hover:opacity-80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    #{report.id} {report.description}
                  </span>
                  <ReportStatusBadge status={report.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-default-500">
                  <WasteCategoryBadge category={report.predictedCategory} />
                  <span>{formatDateTime(report.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
